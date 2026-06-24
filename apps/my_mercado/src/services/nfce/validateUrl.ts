const SUPPORTED_HOST_SUFFIX = "fazenda.sp.gov.br";

export function validateNfceSpUrl(rawUrl: string): string {
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