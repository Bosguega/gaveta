/**
 * Serviço de extração de dados de notas fiscais a partir de imagens
 * usando Gemini Vision API.
 *
 * Converte a imagem para base64, envia para o Gemini com um prompt
 * especializado e retorna os dados estruturados com nível de confiança.
 */

import { getApiKey, getApiModel } from "../utils/ai/aiConfig";
import { logger } from "../utils/logger";
import { generateGalleryReceiptId } from "../utils/receiptId";
import type { Receipt } from "../types/domain";

export interface ImageParseResult {
    receipt: Receipt;
    confidence: "alta" | "media" | "baixa";
    rawJson: string;
}

/**
 * Converte um File para base64
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove o prefixo "data:image/...;base64," para ficar só o base64 puro
            const base64 = result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
        reader.readAsDataURL(file);
    });
}

/**
 * Extrai dados de uma nota fiscal a partir de uma imagem usando Gemini Vision
 */
export async function parseReceiptFromImage(file: File): Promise<ImageParseResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API key não configurada. Configure nas configurações de IA.");
    }

    const model = getApiModel() || "gemini-1.5-flash";
    const mimeType = file.type || "image/jpeg";

    logger.debug("ImageParser", `Processando imagem: ${file.name} (${mimeType}, ${(file.size / 1024).toFixed(1)}KB)`);

    const base64 = await fileToBase64(file);

    const prompt = `Você é um especialista em ler notas fiscais brasileiras (NFC-e) a partir de imagens.

Analise a imagem fornecida e extraia os dados da nota fiscal no formato JSON abaixo.

AVALIE a qualidade da imagem e a clareza do texto visível. Considere:
- A foto está nítida e legível?
- Todos os campos (estabelecimento, itens, preços) estão claramente visíveis?
- Há cortes, borrões ou reflexos que prejudicam a leitura?

Com base nisso, classifique a confiança como:
- "alta" -> texto perfeitamente legível, todos os campos visíveis
- "media" -> texto razoavelmente legível mas alguns caracteres podem estar errados
- "baixa" -> imagem ruim, texto ilegível, muitos dados podem estar incorretos

REGRAS DE PREÇOS (fundamentais):
- Separe SEMPRE o preço de ETIQUETA (cheio) do preço EFETIVAMENTE PAGO.
- "price" é o preço UNITÁRIO CHEIO (de etiqueta), antes de qualquer desconto.
- "total" é o valor total do item NO PREÇO CHEIO (price * quantity), antes de qualquer desconto.
- "paid_price" é o preço UNITÁRIO efetivamente pago, já com o desconto daquele item aplicado.
- "paid_total" é o valor total efetivamente pago daquele item (paid_price * quantity).
- Se um item NÃO teve desconto, OMITA "paid_price" e "paid_total" (não repita o valor cheio neles).
- Se um item teve desconto, calcule paid_price = paid_total / quantity quando necessário.
- "total_discount" é o desconto GERAL da nota (campo "Descontos R$ X"), se visível. Se não houver, use 0.
- NÃO invente valores. Se algo estiver ilegível ou ambíguo, use o que estiver legível, omita os campos de desconto incertos e rebaixe a "confidence".

Responda APENAS com o JSON abaixo, sem explicações adicionais:

{
  "confidence": "alta|media|baixa",
  "establishment": "Nome completo do estabelecimento/mercado",
  "date": "DD/MM/AAAA HH:mm:ss",
  "total_discount": 0.00,
  "items": [
    {
      "name": "Nome do produto",
      "quantity": 1,
      "price": 10.50,
      "total": 10.50,
      "paid_price": 9.90,
      "paid_total": 9.90
    }
  ]
}

Regras adicionais:
- O campo "name" deve ser o nome completo do produto como aparece na nota
- "quantity" é um número (ex: 2, 1, 0.5)
- "price" e "total" usam o PREÇO CHEIO; "paid_price" e "paid_total" usam o valor com desconto
- Para "date", use o formato DD/MM/AAAA HH:mm:ss. Se não houver horário visível, use apenas a data com 00:00:00
- Se não conseguir identificar o estabelecimento, use "Imagem de Nota"
- Se não houver data visível, use a data atual
- Retorne SEMPRE um array de itens, mesmo que vazio`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64,
                            },
                        },
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error("ImageParser", "Erro na API Gemini", { status: response.status, error: errorText });
        throw new Error(`Erro na API Gemini: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Resposta vazia da API Gemini.");
    }

    logger.debug("ImageParser", "Resposta Gemini recebida", text.slice(0, 300));

    // Extrair JSON da resposta (remover ```json ... ``` se presente)
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    let parsed: {
        confidence?: string;
        establishment?: string;
        date?: string;
        total_discount?: number;
        items?: Array<{
            name?: string;
            quantity?: number;
            price?: number;
            total?: number;
            paid_price?: number;
            paid_total?: number;
        }>;
    };

    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        logger.error("ImageParser", "Falha ao parsear JSON da resposta", jsonStr);
        throw new Error("Resposta da IA não pôde ser interpretada como JSON.");
    }

    // Validar confidence
    const confidence = parsed.confidence === "alta" || parsed.confidence === "media" || parsed.confidence === "baixa"
        ? parsed.confidence
        : "baixa";

    // Data de referência (usada como fallback quando a IA não informa)
    const now = new Date();

    const establishment = parsed.establishment?.trim() || "Imagem de Nota";

    // Data
    let date = parsed.date || "";
    if (!date) {
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = String(now.getFullYear());
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        date = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    }

    // Desconto geral da nota (marcador informativo, não entra no gasto).
    const totalDiscount =
        typeof parsed.total_discount === "number" && Number.isFinite(parsed.total_discount) && parsed.total_discount > 0.005
            ? parsed.total_discount
            : undefined;

    // Itens
    const items = (parsed.items || []).map((item) => {
        const quantity = typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
        const fullPrice = typeof item.price === "number" && item.price >= 0 ? item.price : 0;
        const fullTotal =
            typeof item.total === "number" && item.total >= 0 ? item.total : fullPrice * quantity;

        // Desconto por item: só consideramos quando houver um valor pago
        // finito E estritamente menor que o preço cheio. Caso contrário, o item
        // é tratado como sem desconto (paid_price ausente).
        let paidPrice: number | undefined;
        if (typeof item.paid_price === "number" && Number.isFinite(item.paid_price) && item.paid_price >= 0) {
            paidPrice = item.paid_price;
        } else if (
            typeof item.paid_total === "number" &&
            Number.isFinite(item.paid_total) &&
            item.paid_total >= 0 &&
            quantity > 0
        ) {
            paidPrice = item.paid_total / quantity;
        }

        if (paidPrice !== undefined && fullPrice > 0 && paidPrice >= fullPrice) {
            // Sem desconto efetivo: não polui o modelo com paid_price == price.
            paidPrice = undefined;
        }

        return {
            name: item.name?.trim() || "Item não identificado",
            quantity,
            price: fullPrice,
            total: fullTotal,
            paid_price: paidPrice,
        };
    });

    const receiptItems = items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        // Preserva o desconto por item apenas quando existir.
        ...(item.paid_price !== undefined ? { paid_price: item.paid_price } : {}),
    }));

    // ID determinístico (fingerprint) — permite detectar re-escaneamento da
    // mesma imagem, como nos fluxos de QR/texto.
    const receiptId = await generateGalleryReceiptId(establishment, date, receiptItems);

    const receipt: Receipt = {
        id: receiptId,
        establishment,
        date,
        source: "gallery",
        items: receiptItems,
        ...(totalDiscount !== undefined ? { total_discount: totalDiscount } : {}),
    };

    return { receipt, confidence, rawJson: jsonStr };
}