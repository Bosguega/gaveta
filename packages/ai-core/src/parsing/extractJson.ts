/**
 * JSON Extraction from LLM Responses
 *
 * Utilitário genérico para extrair JSON de respostas textuais de LLMs.
 * Não contém nenhuma lógica de domínio — apenas parsing.
 */

/**
 * Tenta extrair um objeto JSON de uma resposta textual.
 *
 * Estratégias (em ordem):
 * 1. Parse direto
 * 2. Extrair de dentro de ```json ... ``` (markdown code block)
 * 3. Extrair primeiro { ... } ou [ ... ] encontrado
 *
 * Retorna null se não conseguir extrair JSON válido.
 */
export function extractJsonFromResponse(text: string): unknown {
    if (!text || typeof text !== 'string') return null

    const trimmed = text.trim()
    if (!trimmed) return null

    // 1. Tenta parse direto
    try {
        return JSON.parse(trimmed)
    } catch {
        // fallthrough
    }

    // 2. Tenta extrair de ```json ... ``` ou ``` ... ```
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (markdownMatch) {
        try {
            return JSON.parse(markdownMatch[1].trim())
        } catch {
            // fallthrough
        }
    }

    // 3. Tenta extrair primeiro { ... } ou [ ... ] do texto
    const braceMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    if (braceMatch) {
        try {
            return JSON.parse(braceMatch[0])
        } catch {
            // fallthrough
        }
    }

    return null
}