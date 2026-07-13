import type { ErrorBody } from "./types.ts";

const ALLOWED_HOST_SUFFIX = "fazenda.sp.gov.br";

export function validateNfceUrl(rawUrl: unknown): { ok: true; url: URL } | { ok: false; body: ErrorBody } {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        return {
            ok: false,
            body: {
                success: false,
                error: "INVALID_INPUT",
                message: "Informe uma URL válida no campo url.",
                status: 400,
            },
        };
    }

    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return {
            ok: false,
            body: {
                success: false,
                error: "INVALID_URL",
                message: "URL não reconhecida.",
                status: 400,
            },
        };
    }

    if (parsed.protocol !== "https:") {
        return {
            ok: false,
            body: {
                success: false,
                error: "INVALID_PROTOCOL",
                message: "Somente HTTPS é permitido.",
                status: 400,
            },
        };
    }

    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(ALLOWED_HOST_SUFFIX)) {
        return {
            ok: false,
            body: {
                success: false,
                error: "HOST_NOT_ALLOWED",
                message: `Host não permitido. Permitido: *.${ALLOWED_HOST_SUFFIX}`,
                status: 400,
            },
        };
    }

    if (!parsed.searchParams.has("p") && !parsed.searchParams.has("chNFe")) {
        return {
            ok: false,
            body: {
                success: false,
                error: "MISSING_QUERY",
                message: "Link sem parâmetros esperados (p ou chNFe).",
                status: 400,
            },
        };
    }

    return { ok: true, url: parsed };
}