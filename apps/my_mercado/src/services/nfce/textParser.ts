import type { RawReceiptItem, Receipt } from "../../types/domain";
import { getFallbackDateAtMidnight, extractEmissionDate } from "./htmlParser";

function cleanProductName(name: string | null | undefined): string {
    if (!name) return "";

    return name
        .replace(/\(C[óo]digo:.*?\)/i, "")
        .replace(/(?<!\d)\s+(KG|G|ML|L|UN|PC|CX)\b$/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseRawTextReceipt(text: string): Receipt {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    const items: RawReceiptItem[] = [];

    // 1. Tentar extrair o estabelecimento (Geralmente a primeira linha)
    let establishment = "Nota Colada";
    if (lines.length > 0) {
        const firstLine = lines[0];
        // Se a primeira linha não parecer um item e não for meta-informação óbvia
        if (!firstLine.includes("Qtde.:") && !firstLine.includes("Código:") && firstLine.length > 3) {
            establishment = firstLine;
        }
    }

    // 2. Tentar extrair a data percorrendo as linhas
    let date = getFallbackDateAtMidnight();
    for (const line of lines) {
        const extractedDate = extractEmissionDate(line);
        if (extractedDate) {
            date = extractedDate;
            break;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Verifica se a próxima linha contém os detalhes (Qtde, UN, etc)
        if (i + 1 < lines.length && lines[i + 1].includes("Qtde.:")) {
            const name = cleanProductName(line);
            const detailsLine = lines[i + 1];

            const qtyMatch = detailsLine.match(/Qtde\.:\s*([\d,.]+)/i);
            const unitMatch = detailsLine.match(/UN:\s*([A-Z]+)/i);
            const priceMatch = detailsLine.match(/Vl\.\s*Unit\.:\s*([\d,.]+)/i);

            let total = "0,00";
            // O total geralmente está na linha seguinte ou no final da linha de detalhes
            if (i + 2 < lines.length && /^[\d,.]+$/.test(lines[i + 2])) {
                total = lines[i + 2];
            } else {
                const totalMatch = detailsLine.match(/Vl\.\s*Total\s*([\d,.]+)/i);
                if (totalMatch) {
                    total = totalMatch[1];
                }
            }

            items.push({
                name,
                qty: qtyMatch ? qtyMatch[1] : "1",
                unit: unitMatch ? unitMatch[1].toUpperCase() : "UN",
                unitPrice: priceMatch ? priceMatch[1] : "0,00",
                total,
            });

            // Pula as linhas processadas
            if (i + 2 < lines.length && /^[\d,.]+$/.test(lines[i + 2])) {
                i += 2;
            } else {
                i += 1;
            }
        }
    }

    if (!items.length) {
        throw new Error("Não foi possível encontrar itens no texto fornecido. Verifique o formato.");
    }

    // 3. Tentar extrair identificadores únicos para evitar duplicatas
    let uniqueSuffix = Date.now().toString();
    const metaLine = lines.find(l => l.includes("Número:") && l.includes("Série:"));
    const protocolLine = lines.find(l => l.includes("Protocolo de Autorização:"));

    if (metaLine || protocolLine) {
        const numMatch = metaLine?.match(/Número:\s*(\d+)/i);
        const serieMatch = metaLine?.match(/Série:\s*(\d+)/i);
        const protMatch = protocolLine?.match(/Protocolo de Autorização:\s*(\d+)/i);

        if (numMatch || protMatch) {
            uniqueSuffix = `${numMatch?.[1] || ""}-${serieMatch?.[1] || ""}-${protMatch?.[1] || ""}`;
        }
    } else {
        // Fallback: usar fingerprint de estabelecimento + data + total
        const totalValue = items.reduce((acc, item) => {
            return acc + (parseFloat(item.total.replace(",", ".")) || 0);
        }, 0);
        uniqueSuffix = `${establishment}-${date}-${totalValue.toFixed(2)}`.replace(/\s+/g, "");
    }

    const parsedItems = items.map((rawItem) => ({
        name: rawItem.name,
        quantity: parseFloat(rawItem.qty.replace(",", ".")) || 1,
        unit: rawItem.unit,
        price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
        paid_price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
        total: parseFloat(rawItem.total.replace(",", ".")) || 0,
    }));

    return {
        id: `pasted-${uniqueSuffix}`,
        establishment,
        date,
        items: parsedItems,
    };
}