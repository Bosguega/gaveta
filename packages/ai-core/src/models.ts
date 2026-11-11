/**
 * Constantes e funções puras relacionadas a modelos de IA.
 *
 * Aqui ficam apenas regras de domínio — sem labels, sem toasts, sem
 * qualquer coisa específica de framework. A UI consome estes símbolos
 * mas o template fica em cada app.
 */

import type { AIProvider } from './storage/types'

/** Provedores que operam online (exclui 'ollama'). */
export type OnlineProvider = Exclude<AIProvider, 'ollama'>

/**
 * Catálogo de modelos por provedor online.
 *
 * Usado como:
 *  - sugestões iniciais no seletor de modelos;
 *  - fallback quando a API não retorna uma lista (ex.: OpenAI).
 */
export const ONLINE_DEFAULT_MODELS: Record<OnlineProvider, string[]> = {
    gemini: [
        'gemini-1.5-flash',
        'gemini-1.5-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.0-pro',
    ],
    openai: ['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o'],
}

/**
 * Modelo padrão aplicado por provedor quando o usuário ainda não
 * escolheu nenhum. Para 'ollama' é vazio — modelos locais precisam
 * ser descobertos via `ollamaListModels`.
 */
export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
    gemini: 'gemini-1.5-flash-lite',
    openai: 'gpt-4o-mini',
    ollama: '',
}

/**
 * Combina o catálogo hardcoded com os modelos retornados pela API,
 * preservando o modelo atualmente selecionado (mesmo se ele não
 * estiver em nenhuma das duas listas — evita perder a escolha do
 * usuário quando a API devolve uma lista diferente).
 *
 * @param hardcoded Lista estática (catálogo de fallback).
 * @param fetched   Lista retornada pela API.
 * @param selected  Modelo atualmente selecionado.
 */
export function mergeModelOptions(
    hardcoded: readonly string[],
    fetched: readonly string[],
    selected: string,
): string[] {
    const all = Array.from(new Set([...hardcoded, ...fetched]))
    if (selected && !all.includes(selected)) {
        all.push(selected)
    }
    return all
}

/**
 * Heurística: detecta se o modelo selecionado claramente "não pertence"
 * ao provider efetivo. Usada pelos modais para auto-correção quando o
 * usuário troca de provider sem trocar de modelo.
 *
 * Regra: detecta por prefixo.
 *   - provider=gemini  + modelo começa com 'gpt-'    → mismatch
 *   - provider=openai  + modelo começa com 'gemini-' → mismatch
 *
 * Retorna `false` para qualquer outro caso (incluindo 'ollama' e
 * 'unknown'), porque nesses casos o modelo pode coexistir com o
 * provider — não há prefixo canônico a comparar.
 */
export function isModelProviderMismatch(
    selectedModel: string,
    effectiveProvider: AIProvider | 'unknown',
): boolean {
    if (!selectedModel) return false
    if (effectiveProvider === 'gemini') {
        return selectedModel.startsWith('gpt-')
    }
    if (effectiveProvider === 'openai') {
        return selectedModel.startsWith('gemini-')
    }
    return false
}
