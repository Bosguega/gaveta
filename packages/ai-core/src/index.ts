// Re-exports dos módulos internos (evitando conflitos de nome)
export { generateText as geminiGenerateText } from './gemini'
export type { GenerateTextOptions as GeminiGenerateTextOptions, GenerateTextResult as GeminiGenerateTextResult } from './gemini'

export { listModels } from './gemini'
export type { ModelInfo } from './gemini'

export { parseGeminiError } from './gemini'
export type { ParsedError } from './gemini'

export { testConnection as geminiTestConnection } from './gemini'
export type { TestConnectionResult as GeminiTestConnectionResult } from './gemini'

export { createGeminiClient } from './gemini'

// OpenAI
export * from './openai'

// Client (ProviderClient, createAiClient, wrappers)
export {
    createAiClient,
    withRetry,
    withFallback,
} from './client'
export type {
    ProviderClient,
    GenerateTextOptions,
    GenerateTextResult,
    TestConnectionResult,
    ProviderName,
    RetryOptions,
} from './client'

// Storage (inclui cache sync)
export * from './storage'
export type { ConfigStore, KeyValueStore, Provider } from './storage'

// Similarity e Hash
export * from './similarity'
export * from './hash'

// Parsing
export * from './parsing'

// Errors
export { AiApiError, friendlyMessages, getFriendlyMessage, createAiApiError } from './gemini/errors'
export type { ApiErrorCode, ApiErrorLike } from './errors'
export { isAuthError, isRetryableError, isNetworkError } from './errors'