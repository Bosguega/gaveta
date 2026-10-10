/**
 * Analisador de descontos a partir de imagem.
 *
 * Complementa uma nota já importada (ex.: via QR Code) identificando, por
 * foto, o VALOR DO DESCONTO impresso por item. NÃO faz nova extração completa
 * nem cria nota: lê o desconto de cada item e calcula o `paid_price`
 * correspondente (desconto aplicado sobre o total cheio da linha, como na
 * nota), relacionando cada produto ao item já registrado.
 *
 * Reaproveita o padrão do imageReceiptParser (fileToBase64, chamada ao Gemini
 * e avaliação de confiança "alta|media|baixa").
 */

import { getApiKey, getApiModel } from "../utils/ai/aiConfig";
import { logger } from "../utils/logger";
import type { ReceiptItem } from "../types/domain";

export interface DiscountSuggestion {
    /** Índice do item correspondente na lista de itens da nota. */
    itemIndex: number;
    /** Preço unitário efetivamente pago sugerido (após desconto). */
    paidPrice: number;
}

export interface DiscountAnalysisResult {
    suggestions: DiscountSuggestion[];
    confidence: "alta" | "media" | "baixa";
    rawJson: string;
}

/** Normaliza um nome para comparação de correspondência produto↔item. */
export function normalizeForMatch(value: string | null | undefined): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Converte um File para base64 (igual ao imageReceiptParser).
 */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
        reader.readAsDataURL(file);
    });
}

/**
 * Analisa a imagem e retorna sugestões de `paid_price` relacionadas aos itens
 * da nota. A IA informa APENAS o desconto impresso por item ("discount"); o
 * valor pago é calculado pelo app sobre o total cheio da linha (ex.: chuchu
 * 0,765 kg x 6,98 = 5,34 com desconto 3,06 -> paid 2,28). Só sugere quando há
 * correspondência confiável com um item existente e quando o desconto é real
 * (menor que o total cheio da linha).
 */
export async function analyzeDiscountsFromImage(
    file: File,
    items: ReceiptItem[],
): Promise<DiscountAnalysisResult> {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("API key não configurada. Configure nas configurações de IA.");
    }

    const model = getApiModel() || "gemini-1.5-flash";
    const mimeType = file.type || "image/jpeg";

    const base64 = await fileToBase64(file);

    // Lista de produtos já registrados na nota, para a IA relacionar.
    const productList = items
        .map((item, index) => {
            const name = item.normalized_name || item.name;
            const unit = item.unit || "un";
            const fullTotal =
                typeof item.total === "number" && item.total > 0 ? item.total : item.price * (item.quantity || 1);
            return `${index}. "${name}" | unidade: ${unit} | qtd: ${item.quantity} | preço unitário cheio: R$ ${item.price} | total cheio da linha: R$ ${fullTotal}`;
        })
        .join("\n");

    const prompt = `Você é um especialista em ler cupons e notas fiscais brasileiras (NFC-e) a partir de imagens, com foco em DESCONTOS por item.

A imagem mostra a parte da nota com os itens e seus preços (possivelmente com descontos aplicados).

Abaixo estão os produtos JÁ REGISTRADOS nesta nota (com índice, nome, unidade, quantidade e preço unitário CHEIO):
${productList}

Sua tarefa: para CADA produto da lista acima, identifique na imagem o VALOR DO DESCONTO impresso para a linha daquele item (em reais).

REGRAS IMPORTANTES:
- Use o campo "index" da lista acima para indicar a qual produto cada desconto se refere.
- "discount" é APENAS o valor do desconto daquele item, exatamente como impresso na nota (em reais). Exemplo: a linha "Desconto Item-09: -3.06" corresponde a "discount": 3.06 para o produto de índice 8 da lista.
- NÃO faça subtrações nem cálculos. Leia SOMENTE o número do desconto que está impresso e informe-o em "discount". O cálculo do valor pago será feito pelo aplicativo.
- Em notas que imprimem "Desconto Item-XX", relacione cada desconto ao item correto pelo NOME do produto (o XX é o número da linha na nota, use o "index" da lista acima).
- Se um produto NÃO teve desconto impresso, OMITA-o.
- Se não conseguir ler o desconto com segurança, OMITA-o. NUNCA invente valores.
- Se a imagem estiver ilegível ou não der para relacionar os produtos, retorne uma lista vazia.

AVALIE a qualidade/legibilidade e classifique a confiança:
- "alta" -> tudo legível e correspondências claras
- "media" -> razoavelmente legível, algumas correspondências incertas
- "baixa" -> imagem ruim, correspondências pouco confiáveis

Responda APENAS com o JSON abaixo, sem explicações:

{
  "confidence": "alta|media|baixa",
  "suggestions": [
    { "index": 0, "discount": 3.06 }
  ]
}

Se não houver nenhum desconto identificável, retorne "suggestions": [].`;

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
                        { inline_data: { mime_type: mimeType, data: base64 } },
                        { text: prompt },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error("DiscountAnalyzer", "Erro na API Gemini", { status: response.status, error: errorText });
        throw new Error(`Erro na API Gemini: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("Resposta vazia da API Gemini.");
    }

    logger.debug("DiscountAnalyzer", "Resposta Gemini recebida", text.slice(0, 300));

    // Extrair JSON da resposta (remover ```json ... ``` se presente)
    let jsonStr = text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
    }

    let parsed: {
        confidence?: string;
        suggestions?: Array<{ index?: number; discount?: number; paid_total?: number; paid_price?: number }>;
    };

    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        logger.error("DiscountAnalyzer", "Falha ao parsear JSON da resposta", jsonStr);
        throw new Error("Resposta da IA não pôde ser interpretada como JSON.");
    }

    const confidence = parsed.confidence === "alta" || parsed.confidence === "media" || parsed.confidence === "baixa"
        ? parsed.confidence
        : "baixa";

    // Valida cada sugestão contra os itens da nota.
    const suggestions: DiscountSuggestion[] = [];
    for (const raw of parsed.suggestions || []) {
        if (typeof raw.index !== "number" || !Number.isInteger(raw.index)) continue;
        if (raw.index < 0 || raw.index >= items.length) continue;
        const item = items[raw.index];
        const quantity = item.quantity > 0 ? item.quantity : 1;
        const fullTotal =
            typeof item.total === "number" && item.total > 0 ? item.total : item.price * quantity;

        let paidPrice: number | undefined;
        if (typeof raw.discount === "number" && Number.isFinite(raw.discount) && raw.discount > 0) {
            // Campo principal: a IA LÊ o desconto impresso (ex.: "Desconto Item-09:
            // -3.06") e o cálculo do valor pago é feito AQUI, deterministicamente.
            // Assim não dependemos da aritmética da IA (que errava 5,34 - 3,06).
            if (raw.discount >= fullTotal) continue; // desconto impossível
            const paidTotal = Math.round((fullTotal - raw.discount) * 100) / 100; // evita erro de float
            paidPrice = paidTotal / quantity;
        } else if (typeof raw.paid_total === "number" && Number.isFinite(raw.paid_total) && raw.paid_total >= 0) {
            // Fallback: total pago da linha informado diretamente pela IA.
            if (raw.paid_total >= fullTotal) continue; // sem desconto real
            paidPrice = raw.paid_total / quantity;
        } else if (typeof raw.paid_price === "number" && Number.isFinite(raw.paid_price) && raw.paid_price >= 0) {
            // Último fallback: preço unitário pago informado diretamente pela IA.
            if (raw.paid_price >= item.price) continue; // sem desconto real
            paidPrice = raw.paid_price;
        }

        if (paidPrice === undefined) continue;
        suggestions.push({ itemIndex: raw.index, paidPrice });
    }

    return { suggestions, confidence, rawJson: jsonStr };
}