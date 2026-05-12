/**
 * AI Configuration - app adapter.
 *
 * Keeps the app's synchronous read API backed by ai-core's cached config.
 */

import {
  clearApiKey as coreClearApiKey,
  detectProvider as coreDetectProvider,
  getApiKeyCached,
  getApiModelCached,
  hasApiKeyCached,
  initializeAiConfig,
  invalidateAiConfigCache,
  isPersistenceEnabledCached,
  setApiKey as coreSetApiKey,
  setApiModel as coreSetApiModel,
  setPersistenceEnabled as coreSetPersistenceEnabled,
  type Provider,
} from '@bosguega/ai-core'

export { hasApiKeyCached as hasApiKey }

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google AI Studio',
  openai: 'OpenAI',
  none: 'Nenhum',
  unknown: 'Desconhecido',
}

async function refreshAiConfigCache(): Promise<void> {
  invalidateAiConfigCache()
  await initializeAiConfig()
}

export function detectProvider(key: string | null | undefined): string {
  return PROVIDER_LABELS[coreDetectProvider(key)]
}

export function getApiKey(): string | null {
  return getApiKeyCached()
}

export async function setApiKey(key: string | null | undefined): Promise<void> {
  await coreSetApiKey(key)
  await refreshAiConfigCache()
}

export async function clearApiKey(): Promise<void> {
  await coreClearApiKey()
  await refreshAiConfigCache()
}

export function getApiModel(): string {
  return getApiModelCached()
}

export async function setApiModel(model: string): Promise<void> {
  await coreSetApiModel(model)
  await refreshAiConfigCache()
}

export function isPersistenceEnabled(): boolean {
  return isPersistenceEnabledCached()
}

export async function setPersistenceEnabled(enabled: boolean): Promise<void> {
  await coreSetPersistenceEnabled(enabled)
  await refreshAiConfigCache()
}
