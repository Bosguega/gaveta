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