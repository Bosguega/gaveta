/**
 * AI Configuration - app adapter.
 *
 * Keeps the app's synchronous read API backed by ai-core's cached config.
 */

import {
  clearApiKey as coreClearApiKey,
  DEFAULT_AI_BASE_URL,
  detectProvider as coreDetectProvider,
  getAiBaseUrlCached,
  getAiModeCached,
  getAiProviderCached,
  getApiKeyCached,
  getApiModelCached,
  hasAiConfigCached,
  hasApiKeyCached,
  initializeAiConfig,
  invalidateAiConfigCache,
  isPersistenceEnabledCached,
  setAiBaseUrl as coreSetAiBaseUrl,
  setAiMode as coreSetAiMode,
  setAiProvider as coreSetAiProvider,
  setApiKey as coreSetApiKey,
  setApiModel as coreSetApiModel,
  setPersistenceEnabled as coreSetPersistenceEnabled,
  type AIMode,
  type AIProvider,
  type Provider,
} from '@bosguega/ai-core'

export { hasApiKeyCached as hasApiKey }
export { hasAiConfigCached as hasAiConfig }
export type { AIMode, AIProvider }

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google AI Studio',
  openai: 'OpenAI',
  ollama: 'Ollama',
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

export function getProviderLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider]
}

export function getAiMode(): AIMode {
  return getAiModeCached()
}

export async function setAiMode(mode: AIMode): Promise<void> {
  await coreSetAiMode(mode)
  await refreshAiConfigCache()
}

export function getAiProvider(): AIProvider {
  return getAiProviderCached()
}

export async function setAiProvider(provider: AIProvider): Promise<void> {
  await coreSetAiProvider(provider)
  await refreshAiConfigCache()
}

export function getAiBaseUrl(): string {
  return getAiBaseUrlCached()
}

export async function setAiBaseUrl(baseUrl: string | null | undefined): Promise<void> {
  await coreSetAiBaseUrl(baseUrl || DEFAULT_AI_BASE_URL)
  await refreshAiConfigCache()
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
