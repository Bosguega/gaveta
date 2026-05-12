/**
 * Provider Client Interface
 *
 * Contrato que cada provider (gemini, openai) deve implementar.
 * Mantido simples e mínimo — sem abstrações prematuras.
 */

export interface GenerateTextOptions {
    systemPrompt?: string
    userPrompt: string
    temperature?: number
    maxTokens?: number
}

export interface GenerateTextResult {
    text: string
    model: string
    provider: ProviderName
}

export type ProviderName = 'gemini' | 'openai'

export interface TestConnectionResult {
    success: boolean
    error?: string
}

export interface ProviderClient {
    generateText(options: GenerateTextOptions): Promise<GenerateTextResult>
    testConnection(): Promise<TestConnectionResult>
}