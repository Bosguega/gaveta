/**
 * Analisador de descontos a partir de imagem.
 *
 * Complementa uma nota já importada (ex.: via QR Code) identificando, por
 * foto, os preços efetivamente pagos (descontos por item). NÃO faz nova
 * extração completa nem cria nota: apenas sugere `paid_price` por item para
 * resolver descontos pendentes, relacionando cada produto ao item já
 * registrado na nota.
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
 * da nota. Só sugere quando há correspondência confiável com um item existente
 * e quando o valor pago é estritamente menor que o preço cheio (desconto real).
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
            return `${index}. "${name}" | unidade: ${unit} | qtd: ${item.quantity} | preço unitário cheio: R$ ${item.price}`;
        })
        .join("\n");

    const prompt = `Você é um especialista em ler cupons e notas fiscais brasileiras (NFC-e) a partir de imagens, com foco em DESCONTOS por item.

A imagem mostra a parte da nota com os itens e seus preços (possivelmente com descontos aplicados).

Abaixo estão os produtos JÁ REGISTRADOS nesta nota (com índice, nome, unidade, quantidade e preço unitário CHEIO):
${productList}

Sua tarefa: para CADA produto da lista acima, tente identificar na imagem o preço unitário EFETIVAMENTE PAGO (após desconto).

REGRAS IMPORTANTES:
- Use o campo "index" da lista acima para indicar a qual produto cada valor se refere.
- "paid_price" é o preço UNITÁRIO pago (já com desconto), em reais.
- Só inclua um item se você tiver CERTEZA de que aquele valor pago pertence àquele produto (correspondência confiável pelo nome).
- Se um produto NÃO teve desconto (preço pago == preço cheio), OMITA-o.
- Se não conseguir identificar um valor com segurança, OMITA-o. NUNCA invente valores.
- Não repita o preço cheio como se fosse desconto.
- Se a imagem estiver ilegível ou não der para relacionar os produtos, retorne uma lista vazia.

AVALIE a qualidade/legibilidade e classifique a confiança:
- "alta" -> tudo legível e correspondências claras
- "media" -> razoavelmente legível, algumas correspondências incertas
- "baixa" -> imagem ruim, correspondências pouco confiáveis

Responda APENAS com o JSON abaixo, sem explicações:

{
  "confidence": "alta|media|baixa",
  "suggestions": [
    { "index": 0, "paid_price": 9.90 }
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
        suggestions?: Array<{ index?: number; paid_price?: number }>;
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
        if (typeof raw.paid_price !== "number" || !Number.isFinite(raw.paid_price) || raw.paid_price < 0) continue;

        const item = items[raw.index];
        // Só considera desconto real (pago estritamente menor que o preço cheio).
        if (raw.paid_price >= item.price) continue;

        suggestions.push({ itemIndex: raw.index, paidPrice: raw.paid_price });
    }

    return { suggestions, confidence, rawJson: jsonStr };
}