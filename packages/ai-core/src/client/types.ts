/**
 * Provider Client Interface
 *
 * Contrato que cada provider (gemini, openai) deve implementar.
 * Mantido simples e mínimo — sem abstrações prematuras.
 */

export interface ImageInput {
    /** MIME type da imagem, por exemplo image/jpeg ou image/png. */
    mimeType: string
    /** Conteúdo binário da imagem codificado em base64, sem prefixo data URI. */
    data: string
}

export interface GenerateTextOptions {
    systemPrompt?: string
    userPrompt: string
    /** Imagens opcionais anexadas ao prompt. O modelo configurado precisa oferecer visão. */
    images?: ImageInput[]
    temperature?: number
    maxTokens?: number
    /** Desativa o modo de raciocínio em modelos llama.cpp que oferecem esse controle. */
    enableThinking?: boolean
}

export interface GenerateTextResult {
    text: string
    model: string
    provider: ProviderName
}

export type ProviderName = 'gemini' | 'openai' | 'ollama' | 'llama-cpp'

export interface TestConnectionResult {
    success: boolean
    error?: string
}

export interface ProviderClient {
    generateText(options: GenerateTextOptions): Promise<GenerateTextResult>
    testConnection(): Promise<TestConnectionResult>
}
