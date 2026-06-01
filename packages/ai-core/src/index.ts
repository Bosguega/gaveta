// Gemini raw API kept unprefixed for backwards compatibility.
export { generateText, generateText as geminiGenerateText } from './gemini'
export type {
    GenerateTextOptions as GeminiGenerateTextOptions,
    GenerateTextResult as GeminiGenerateTextResult,
} from './gemini'

export { generateEmbedding, generateEmbedding as geminiGenerateEmbedding } from './gemini'
export type { GenerateEmbeddingResult as GeminiGenerateEmbeddingResult } from './gemini'

export { listModels } from './gemini'
export type { ModelInfo } from './gemini'

export { parseGeminiError } from './gemini'
export type { ParsedError } from './gemini'

export { testConnection, testConnection as geminiTestConnection } from './gemini'
export type { TestConnectionResult as GeminiTestConnectionResult } from './gemini'

export { createGeminiClient } from './gemini'

// OpenAI raw API is prefixed to avoid colliding with Gemini's legacy exports.
export {
    createOpenAiClient,
    generateText as openaiGenerateText,
    testConnection as openaiTestConnection,
} from './openai'
export type { TestConnectionResult as OpenAiTestConnectionResult } from './openai'

// Ollama local HTTP API.
export {
    createOllamaClient,
    DEFAULT_OLLAMA_BASE_URL,
    generateText as ollamaGenerateText,
    listModels as ollamaListModels,
    testConnection as ollamaTestConnection,
} from './ollama'
export type {
    OllamaModelInfo,
    TestConnectionResult as OllamaTestConnectionResult,
} from './ollama'

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

// Storage
export * from './storage'
export type { ConfigStore, KeyValueStore, Provider } from './storage'

// Similarity and hash
export * from './similarity'
export * from './hash'

// Parsing
export * from './parsing'

// Models (domain rules — no UI)
export {
    ONLINE_DEFAULT_MODELS,
    DEFAULT_MODEL_BY_PROVIDER,
    mergeModelOptions,
    isModelProviderMismatch,
} from './models'
export type { OnlineProvider } from './models'

// Errors
export {
    AiApiError,
    createAiApiError,
    friendlyMessages,
    getFriendlyMessage,
    isAuthError,
    isRetryableError,
    isNetworkError,
} from './errors'
export type { ApiErrorCode, ApiErrorLike } from './errors'
