import { logger } from "../utils/logger";
import type { RawReceiptItem, Receipt } from "../types/domain";
import { fetchNfceHtmlFromEdge } from "./nfceEdgeFetch";

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];
const PROXY_TIMEOUT_MS = 10000;
const SUPPORTED_HOST_SUFFIX = "fazenda.sp.gov.br";

// ==============================
// Utils
// ==============================

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
  const normalizedTime =
    baseTime.length === 5 ? `${baseTime}:00` : baseTime || "00:00:00";
  return `${datePart.trim()} ${normalizedTime}`;
}

function extractEmissionDate(value: string | null | undefined): string | null {
  const text = normalizeSpaces(value);
  if (!text) return null;

  // "Emissao: DD/MM/AAAA HH:mm:ss" (including mojibake variants where "Emiss" is still intact)
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

function getFallbackDateAtMidnight(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}/${mm}/${yyyy} 00:00:00`;
}

function validateNfceSpUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("QR Code inválido: URL não reconhecida.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("URL inválida para consulta da NFC-e. Somente HTTPS é permitido.");
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(SUPPORTED_HOST_SUFFIX)) {
    throw new Error(
      "Somente URLs da NFC-e de São Paulo (fazenda.sp.gov.br) são suportadas.",
    );
  }

  const hasKnownQuery = parsed.searchParams.has("p") || parsed.searchParams.has("chNFe");
  if (!hasKnownQuery) {
    throw new Error("Link da NFC-e sem parâmetros esperados (p/chNFe).");
  }

  return parsed.toString();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
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

// ==============================
// Parser principal
// ==============================

export async function parseNFCeSP(url: string): Promise<Receipt> {
  if (import.meta.env.DEV) {
    logger.info('Parser', '🔍 parseNFCeSP chamado com URL:', url);
  }
  const targetUrl = validateNfceSpUrl(url);
  let html: string | null = null;
  const attemptErrors: string[] = [];

  if (import.meta.env.DEV) {
    logger.info('Parser', '🔍 Tentando buscar via Edge Function fetch-nfce...');
  }

  const edgeResult = await fetchNfceHtmlFromEdge(targetUrl);
  if (edgeResult.ok) {
    html = edgeResult.html;
  } else if (edgeResult.detail !== "supabase_desabilitado") {
    attemptErrors.push(`Edge: ${edgeResult.detail}`);
  }

  if (!html) {
    if (import.meta.env.DEV) {
      logger.info('Parser', '🔍 Tentando buscar via proxies (fallback)...');
    }

    for (let index = 0; index < PROXIES.length; index += 1) {
      const getProxyUrl = PROXIES[index];
      try {
        const proxyUrl = getProxyUrl(targetUrl);

        if (import.meta.env.DEV) {
          logger.info('Parser', `🔍 Tentativa ${index + 1}/${PROXIES.length}: ${proxyUrl.substring(0, 80)}...`);
        }

        const response = await fetchWithTimeout(proxyUrl, PROXY_TIMEOUT_MS);

        if (response.ok) {
          const text = await response.text();

          if (text && (text.includes("tabResult") || text.includes("txtTopo"))) {
            html = text;
            break;
          }

          attemptErrors.push(`Proxy ${index + 1}: resposta sem dados da NFC-e.`);
        } else {
          attemptErrors.push(`Proxy ${index + 1}: HTTP ${response.status}.`);
        }
      } catch (err) {
        const errorName = err instanceof Error ? err.name : "";
        const errorMessage = err instanceof Error ? err.message : "falha desconhecida";
        if (errorName === "AbortError") {
          attemptErrors.push(`Proxy ${index + 1}: timeout após ${PROXY_TIMEOUT_MS}ms.`);
        } else {
          attemptErrors.push(`Proxy ${index + 1}: ${errorMessage}.`);
        }
        logger.warn('Parser', 'Proxy falhou', err);
      }
    }
  }

  if (!html) {
    if (import.meta.env.DEV) {
      logger.error('Parser', '❌ Edge e proxies falharam:', attemptErrors);
    }
    throw new Error(`Falha ao obter HTML da NFC-e. ${attemptErrors.join(" ")}`.trim());
  }

  if (import.meta.env.DEV) {
    logger.info('Parser', '✅ HTML obtido com sucesso, parseando...');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let establishment = "Estabelecimento Desconhecido";
    let date = "";
    const items: RawReceiptItem[] = [];

    const companyDiv = doc.querySelector(".txtTopo");
    if (companyDiv) {
      establishment = normalizeSpaces(companyDiv.textContent || "") || establishment;
    }

    const infoCandidates = [
      ...Array.from(doc.querySelectorAll("li"), (li) => li.textContent || ""),
      ...Array.from(doc.querySelectorAll(".txtCenter, #infos, .txtChave"), (el) => el.textContent || ""),
      doc.body?.textContent || "",
    ];

    for (const candidate of infoCandidates) {
      const extractedDate = extractEmissionDate(candidate);
      if (extractedDate) {
        date = extractedDate;
        break;
      }
    }

    if (!date) {
      date = getFallbackDateAtMidnight();
      logger.warn('Parser', 'Nao foi possivel extrair data/hora da emissao. Usando fallback com meia-noite.');
    }

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

    if (!items.length) {
      throw new Error("Nenhum item encontrado na nota.");
    }

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

    // Fallback determinístico: hash dos dados da nota evita colisões por timestamp
    let receiptId: string;
    if (accessKey) {
      receiptId = accessKey;
    } else {
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
      receiptId = `nfce-${hashHex.slice(0, 16)}`;
    }

    return {
      id: receiptId,
      establishment,
      date,
      items: items.map((rawItem) => ({
        name: rawItem.name,
        quantity: parseFloat(rawItem.qty.replace(",", ".")) || 1,
        unit: rawItem.unit,
        price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
        total: parseFloat(rawItem.total.replace(",", ".")) || 0,
      })),
    };
  } catch (error) {
    logger.error('Parser', 'Erro ao parsear NFC-e:', error);
    throw error;
  }
}

/**
 * Parser para o conteúdo de texto "copiado e colado" da visualização da nota.
 * Exemplo de formato esperado:
 * LINGUICA SADIA Kg (Código: 597 )
 * Qtde.:0,472   UN: KG   Vl. Unit.:   19,9 	Vl. Total
 * 9,39
 */
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
        total: total,
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

  return {
    id: `pasted-${uniqueSuffix}`,
    establishment,
    date,
    items: items.map((rawItem) => ({
      name: rawItem.name,
      quantity: parseFloat(rawItem.qty.replace(",", ".")) || 1,
      unit: rawItem.unit,
      price: parseFloat(rawItem.unitPrice.replace(",", ".")) || 0,
      total: parseFloat(rawItem.total.replace(",", ".")) || 0,
    })),
  };
}
