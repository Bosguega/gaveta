/**
 * AI Configuration — Adapter
 *
 * Este arquivo existe para compatibilidade com imports existentes.
 * Delega todas as funções para o cache sync do @bosguega/ai-core.
 *
 * NOTA: Requer que initializeAiConfig() tenha sido chamado no bootstrap do app.
 *
 * @deprecated Importe diretamente de '@bosguega/ai-core' em novos códigos.
 */

import {
  getApiKeyCached,
  getApiModelCached,
  hasApiKeyCached,
  invalidateAiConfigCache,
  detectProvider as coreDetectProvider,
  setApiKey as coreSetApiKey,
  setApiModel as coreSetApiModel,
  setPersistenceEnabled as coreSetPersistenceEnabled,
  clearApiKey as coreClearApiKey,
} from '@bosguega/ai-core'

// ------ API Key (cache sync) ------

export { hasApiKeyCached as hasApiKey }

// detectProvider mantém a assinatura original (aceita key como argumento)
export function detectProvider(key: string | null | undefined): string {
  return coreDetectProvider(key)
}

export function getApiKey(): string | null {
  return getApiKeyCached()
}

export function setApiKey(key: string | null | undefined): void {
  // Salva no core (fire-and-forget async) e invalida cache
  coreSetApiKey(key).catch(() => { })
  invalidateAiConfigCache()
}

export function clearApiKey(): void {
  coreClearApiKey().catch(() => { })
  invalidateAiConfigCache()
}

// ------ Modelo ------

export function getApiModel(): string {
  return getApiModelCached()
}

export function setApiModel(model: string): void {
  coreSetApiModel(model).catch(() => { })
}

// ------ Persistência ------

export function isPersistenceEnabled(): boolean {
  // Temporariamente retorna o valor em memória
  return _persistenceEnabled
}

export function setPersistenceEnabled(enabled: boolean): void {
  _persistenceEnabled = enabled
  coreSetPersistenceEnabled(enabled).catch(() => { })
}

let _persistenceEnabled = false