import { defaultFetchHeaders } from "./http.ts";
import type { ErrorBody, SefazResult } from "./types.ts";

export const FETCH_TIMEOUT_MS = 5000;
export const MAX_HTML_CHARS = 2_000_000;
export const RETRY_DELAY_MS = 400;
export const MAX_FETCH_ATTEMPTS = 3;

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

export async function fetchSefazOnce(targetUrl: string): Promise<SefazResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(targetUrl, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: defaultFetchHeaders,
        });

        if (!res.ok) {
            return {
                ok: false,
                body: {
                    success: false,
                    error: "UPSTREAM_ERROR",
                    message: `Sefaz retornou HTTP ${res.status}.`,
                    status: res.status,
                },
            };
        }

        const html = await res.text();

        if (html.length > MAX_HTML_CHARS) {
            return {
                ok: false,
                body: {
                    success: false,
                    error: "RESPONSE_TOO_LARGE",
                    message: `Resposta excede o limite de ${MAX_HTML_CHARS} caracteres.`,
                    status: 413,
                },
            };
        }

        if (!html.includes("tabResult") && !html.includes("txtTopo")) {
            return {
                ok: false,
                body: {
                    success: false,
                    error: "INVALID_NFCE_HTML",
                    message: "Resposta não contém o HTML esperado da NFC-e.",
                    status: 502,
                },
            };
        }

        return { ok: true, html, status: res.status };
    } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "AbortError") {
            return {
                ok: false,
                body: {
                    success: false,
                    error: "TIMEOUT",
                    message: `Tempo esgotado após ${FETCH_TIMEOUT_MS}ms.`,
                    status: 504,
                },
            };
        }
        return {
            ok: false,
            body: {
                success: false,
                error: "FETCH_FAILED",
                message: e instanceof Error ? e.message : "Falha ao contatar o Sefaz.",
                status: 502,
            },
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

function shouldRetrySefaz(last: SefazResult): boolean {
    if (!last.ok) {
        const { error, status } = last.body;
        if (error === "RESPONSE_TOO_LARGE") return false;
        if (error === "INVALID_NFCE_HTML") return false;
        if (error === "UPSTREAM_ERROR" && status >= 400 && status < 500 && status !== 429) {
            return false;
        }
        if (error === "TIMEOUT") return true;
        if (error === "FETCH_FAILED") return true;
        if (error === "UPSTREAM_ERROR" && (status >= 500 || status === 429)) return true;
        return false;
    }
    return false;
}

export async function fetchSefazWithRetries(targetUrl: string): Promise<SefazResult> {
    let last: SefazResult | null = null;

    for (let attempt = 0; attempt < MAX_FETCH_ATTEMPTS; attempt++) {
        if (attempt > 0) {
            await sleep(RETRY_DELAY_MS * attempt);
        }
        const result = await fetchSefazOnce(targetUrl);
        if (result.ok) return result;
        last = result;
        if (!shouldRetrySefaz(result)) return result;
    }

    return (
        last ?? {
            ok: false,
            body: {
                success: false,
                error: "FETCH_FAILED",
                message: "Falha após tentativas.",
                status: 502,
            },
        }
    );
}