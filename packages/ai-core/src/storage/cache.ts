/** AI Config Cache — sync access after bootstrap. */
import {
    DEFAULT_AI_BASE_URL, DEFAULT_AI_MODE, DEFAULT_AI_MODEL, DEFAULT_AI_PROVIDER,
    detectProvider, getAiBaseUrl, getAiLocalModel, getAiMode, getAiProvider,
    getApiKey, getApiModel, isPersistenceEnabled,
} from './aiConfig'
import type { AIProvider, AIMode, Provider } from './types'

let _key: string | null = null
let _model: string | null = null
let _localModel: string | null = null
let _mode: AIMode | null = null
let _provider: AIProvider | null = null
let _baseUrl: string | null = null
let _persist = false
let _initialized = false

export async function initializeAiConfig(): Promise<void> {
    if (_initialized) return
    _key = await getApiKey()
    _model = await getApiModel()
    _localModel = await getAiLocalModel()
    _mode = await getAiMode()
    _provider = await getAiProvider()
    _baseUrl = await getAiBaseUrl()
    _persist = await isPersistenceEnabled()
    _initialized = true
}
function assertInitialized(): void {
    if (!_initialized) throw new Error('ai-core não inicializado. Execute await initializeAiConfig() antes de usar getters cacheados.')
}
export function getApiKeyCached(): string | null { assertInitialized(); return _key }
export function getApiModelCached(): string { assertInitialized(); return _model ?? DEFAULT_AI_MODEL }
export function getAiLocalModelCached(): string { assertInitialized(); return _localModel ?? '' }
export function getAiModeCached(): AIMode { assertInitialized(); return _mode ?? DEFAULT_AI_MODE }
export function getAiProviderCached(): AIProvider { assertInitialized(); return _provider ?? DEFAULT_AI_PROVIDER }
export function getAiBaseUrlCached(): string { assertInitialized(); return _baseUrl ?? DEFAULT_AI_BASE_URL }
export function isPersistenceEnabledCached(): boolean { assertInitialized(); return _persist }
export function detectProviderCached(): Provider { assertInitialized(); return detectProvider(_key) }
export function getEffectiveProviderCached(): Provider {
    assertInitialized()
    return (_mode ?? DEFAULT_AI_MODE) === 'local' ? (_provider ?? DEFAULT_AI_PROVIDER) : detectProvider(_key)
}
export function hasApiKeyCached(): boolean { assertInitialized(); return !!_key }
export function hasAiConfigCached(): boolean {
    assertInitialized()
    return (_mode ?? DEFAULT_AI_MODE) === 'local'
        ? (_provider ?? DEFAULT_AI_PROVIDER) === 'llama-cpp' && !!_localModel?.trim()
        : hasApiKeyCached()
}
export function invalidateAiConfigCache(): void {
    _key = null; _model = null; _localModel = null; _mode = null; _provider = null; _baseUrl = null; _persist = false; _initialized = false
}
