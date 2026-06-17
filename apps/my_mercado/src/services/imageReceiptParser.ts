/**
 * Serviço de extração de dados de notas fiscais a partir de imagens
 * usando Gemini Vision API.
 *
 * Converte a imagem para base64, envia para o Gemini com um prompt
 * especializado e retorna os dados estruturados com nível de confiança.
 */

import { getApiKey, getApiModel } from "../utils/ai/aiConfig";
import { logger } from "../utils/logger";
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

Responda APENAS com o JSON abaixo, sem explicações adicionais:

{
  "confidence": "alta|media|baixa",
  "establishment": "Nome completo do estabelecimento/mercado",
  "date": "DD/MM/AAAA HH:mm:ss",
  "items": [
    {
      "name": "Nome do produto",
      "quantity": 1,
      "price": 10.50,
      "total": 10.50
    }
  ]
}

Regras:
- O campo "name" deve ser o nome completo do produto como aparece na nota
- "quantity" é um número (ex: 2, 1, 0.5)
- "price" é o preço unitário em reais
- "total" é o valor total do item em reais
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
        items?: Array<{ name?: string; quantity?: number; price?: number; total?: number }>;
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

    // Gerar ID único para o receipt
    const now = new Date();
    const timestamp = now.getTime().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    const receiptId = `img-${timestamp}-${random}`;

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

    // Itens
    const items = (parsed.items || []).map((item) => ({
        name: item.name?.trim() || "Item não identificado",
        quantity: typeof item.quantity === "number" ? item.quantity : 1,
        price: typeof item.price === "number" ? item.price : 0,
        total: typeof item.total === "number" ? item.total : (typeof item.price === "number" ? item.price : 0),
    }));

    const receipt: Receipt = {
        id: receiptId,
        establishment,
        date,
        items: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
        })),
    };

    return { receipt, confidence, rawJson: jsonStr };
}