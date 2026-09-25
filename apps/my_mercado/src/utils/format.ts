/**
 * Formatadores auxiliares para o app My Mercado.
 */

/**
 * Formata uma quantidade para exibição, preservando casas decimais significativas.
 * Ex: 0.472 -> "0,472", 3 -> "3", 1.5 -> "1,5"
 */
export function formatQuantity(value: number | null | undefined): string {
    if (value === null || value === undefined) return "1";
    if (Number.isInteger(value)) return value.toString();

    // Preserva a precisão real do número removendo zeros à direita
    const str = value.toFixed(10).replace(/\.?0+$/, "");
    return str.replace(".", ",");
}

/**
 * Converte um valor (string ou número) para quantidade numérica segura,
 * preservando todas as casas decimais recebidas (ex: "0,434" -> 0.434, "0.434" -> 0.434).
 */
export function parseQuantity(value: string | number | null | undefined, fallback = 1): number {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : fallback;

    const stringValue = String(value).trim();
    if (!stringValue) return fallback;

    let normalized = stringValue;
    if (stringValue.includes(",") && stringValue.includes(".")) {
        if (stringValue.indexOf(".") < stringValue.indexOf(",")) {
            // Formato pt-BR: 1.250,5
            normalized = stringValue.replace(/\./g, "").replace(",", ".");
        } else {
            // Formato en-US: 1,250.5
            normalized = stringValue.replace(/,/g, "");
        }
    } else if (stringValue.includes(",")) {
        normalized = stringValue.replace(",", ".");
    }

    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
