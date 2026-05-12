export { generateText } from './generateText'
export type { GenerateTextOptions, GenerateTextResult } from './generateText'

export { listModels } from './listModels'
export type { ModelInfo } from './listModels'

export { parseGeminiError } from './parseError'
export type { ParsedError } from './parseError'

export { testConnection } from './testConnection'
export type { TestConnectionResult } from './testConnection'

export { createGeminiClient } from './createGeminiClient'

export { AiApiError, friendlyMessages, getFriendlyMessage, createAiApiError } from './errors'
