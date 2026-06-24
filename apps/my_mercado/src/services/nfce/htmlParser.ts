import { logger } from "../../utils/logger";
import type { RawReceiptItem } from "../../types/domain";

function parseNumber(value: string | null | undefined, fallback = "0"): string {
    if (!value) return fallback;
    return value.replace(/[^\d,.-]/g, "").trim();
}

function normalizeSpaces(value: string | null | undefined): string {
    if (!value) return "";
    return value.replace(/\s+/g, " ").trim();
}

function toBRDateTime(datePart: string, timePart?: string): string {
    const baseTime = timePart ? timePart.trim() : "";
    if (baseTime) {
        const normalizedTime = baseTime.length === 5 ? `${baseTime}:00` : baseTime;
        return `${datePart.trim()} ${normalizedTime}`;
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${datePart.trim()} ${hh}:${mm}:${ss}`;
}

export function extractEmissionDate(value: string | null | undefined): string | null {
    const text = normalizeSpaces(value);
    if (!text) return null;

    const aroundEmission = text.match(
        /emiss[\s\S]{0,60}?(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/i,
    );
    if (aroundEmission?.[1]) {
        return toBRDateTime(aroundEmission[1], aroundEmission[2]);
    }

    const genericDate = text.match(
        /(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/,
    );
    if (genericDate?.[1]) {
        return toBRDateTime(genericDate[1], genericDate[2]);
    }

    return null;
}

export function getFallbackDateAtMidnight(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function extractQtyAndUnit(text: string | null | undefined): { qty: string; unit: string } {
    if (!text) return { qty: "1", unit: "UN" };

    const qtyMatch = text.match(/Qtde\.?:\s*([\d.,]+)/i);
    const unitMatch = text.match(/UN:\s*([A-Z]+)/i);

    return {
        qty: qtyMatch ? qtyMatch[1] : "1",
        unit: unitMatch ? unitMatch[1].toUpperCase() : "UN",
    };
}

function extractUnitPrice(text: string | null | undefined): string {
    const match = text?.match(/Vl\.?\s*Unit\.?:\s*([\d.,]+)/i);
    return match ? match[1] : "0,00";
}

function cleanProductName(name: string | null | undefined): string {
    if (!name) return "";

    return name
        .replace(/\(C[óo]digo:.*?\)/i, "")
        .replace(/(?<!\d)\s+(KG|G|ML|L|UN|PC|CX)\b$/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseItemsFromHtml(doc: Document): RawReceiptItem[] {
    const items: RawReceiptItem[] = [];
    const rows = doc.querySelectorAll("table#tabResult tr");

    rows.forEach((row) => {
        const titleEl = row.querySelector(".txtTit");
        if (!titleEl) return;

        const rawName = (titleEl.textContent || "").trim();
        const fullText = row.textContent || "";

        const { qty, unit } = extractQtyAndUnit(fullText);
        const unitPrice = extractUnitPrice(fullText);

        const totalEl = row.querySelector(".valor");
        const total = totalEl ? parseNumber(totalEl.textContent) : "0,00";

        const name = cleanProductName(rawName);

        items.push({
            name,
            qty,
            unit,
            unitPrice,
            total,
        });
    });

    return items;
}

export function extractEstablishment(doc: Document): string {
    let establishment = "Estabelecimento Desconhecido";
    const companyDiv = doc.querySelector(".txtTopo");
    if (companyDiv) {
        establishment = normalizeSpaces(companyDiv.textContent || "") || establishment;
    }
    return establishment;
}

export function extractDateFromHtml(doc: Document): string {
    const infoCandidates = [
        ...Array.from(doc.querySelectorAll("li"), (li) => li.textContent || ""),
        ...Array.from(doc.querySelectorAll(".txtCenter, #infos, .txtChave"), (el) => el.textContent || ""),
        doc.body?.textContent || "",
    ];

    for (const candidate of infoCandidates) {
        const extractedDate = extractEmissionDate(candidate);
        if (extractedDate) {
            return extractedDate;
        }
    }

    const fallback = getFallbackDateAtMidnight();
    logger.warn("Parser", "Nao foi possivel extrair data/hora da emissao. Usando fallback com meia-noite.");
    return fallback;
}

export function extractTotalDiscount(doc: Document): number | undefined {
    const bodyText = doc.body?.textContent || "";
    const discountMatch = bodyText.match(/Descontos\s*R?\$?\s*:?\s*([\d.,]+)/i);
    if (discountMatch) {
        return parseFloat(discountMatch[1].replace(",", "."));
    }
    return undefined;
}

export async function generateReceiptId(establishment: string, date: string, items: RawReceiptItem[], targetUrl: string): Promise<string> {
    let accessKey: string | null = null;
    try {
        const urlObj = new URL(targetUrl);
        const p = urlObj.searchParams.get("p");
        const chNFe = urlObj.searchParams.get("chNFe");
        if (p) {
            accessKey = decodeURIComponent(p).split("|")[0];
        } else if (chNFe) {
            accessKey = chNFe;
        }
    } catch {
        // noop
    }

    if (accessKey) {
        return accessKey;
    }

    const fingerprint = [
        establishment,
        date,
        ...items.map((i) => `${i.name}:${i.total}`),
    ].join("|");
    const data = new TextEncoder().encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return `nfce-${hashHex.slice(0, 16)}`;
}