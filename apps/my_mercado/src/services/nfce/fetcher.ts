import { fetchNfceHtmlFromEdge } from "../nfceEdgeFetch";
import { logger } from "../../utils/logger";

export const PROXIES = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];
export const PROXY_TIMEOUT_MS = 10000;

export async function fetchNfceHtml(targetUrl: string): Promise<string> {
    const attemptErrors: string[] = [];

    if (import.meta.env.DEV) {
        logger.info("Parser", "Tentando buscar via Edge Function fetch-nfce...");
    }

    const edgeResult = await fetchNfceHtmlFromEdge(targetUrl);
    if (edgeResult.ok) {
        return edgeResult.html;
    }
    if (edgeResult.detail !== "supabase_desabilitado") {
        attemptErrors.push(`Edge: ${edgeResult.detail}`);
    }

    if (import.meta.env.DEV) {
        logger.info("Parser", "Tentando buscar via proxies (fallback)...");
    }

    for (let index = 0; index < PROXIES.length; index += 1) {
        const getProxyUrl = PROXIES[index];
        try {
            const proxyUrl = getProxyUrl(targetUrl);

            if (import.meta.env.DEV) {
                logger.info("Parser", `Tentativa ${index + 1}/${PROXIES.length}: ${proxyUrl.substring(0, 80)}...`);
            }

            const response = await fetchWithTimeout(proxyUrl, PROXY_TIMEOUT_MS);

            if (response.ok) {
                const text = await response.text();
                if (text && (text.includes("tabResult") || text.includes("txtTopo"))) {
                    return text;
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
            logger.warn("Parser", "Proxy falhou", err);
        }
    }

    if (import.meta.env.DEV) {
        logger.error("Parser", "Edge e proxies falharam:", attemptErrors);
    }
    throw new Error(`Falha ao obter HTML da NFC-e. ${attemptErrors.join(" ")}`.trim());
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