# @bosguega/ai-core

Infraestrutura reutilizável de IA para os apps do monorepo **gaveta**.

O pacote é **agnóstico de framework e de domínio**: ele sabe chamar providers, guardar configuração, aplicar retry/fallback, extrair JSON genérico, calcular hash e similaridade vetorial. **Prompts, categorias, schemas de produto, logging de app e fallbacks de negócio ficam nos apps consumidores.**

## Stack

- TypeScript puro — **zero dependências de runtime** (React, Vue, DOM)
- Única dependência opcional: SDK do provider (ex: OpenAI)
- Testes com Vitest

## Instalação

```bash
pnpm --filter @bosguega/ai-core build
```

O pacote é privado e consumido internamente pelos workspaces.

---

## API Principal

```ts
import {
  createAiClient,
  detectProvider,
  initializeAiConfig,
  invalidateAiConfigCache,
  getApiKeyCached,
  getApiModelCached,
} from '@bosguega/ai-core'
```

### Inicialização

Antes de usar o cliente unificado, é necessário popular o cache chamando `initializeAiConfig()` uma vez no bootstrap do app:

```ts
import { initializeAiConfig } from '@bosguega/ai-core'

await initializeAiConfig()
// Agora os getters sync (getApiKeyCached, etc.) estão disponíveis
```

Use `invalidateAiConfigCache()` para forçar uma releitura após alterar chave/modelo.

### Cliente Unificado

```ts
const ai = createAiClient()
const result = await ai.generateText({
  userPrompt: 'Resuma TypeScript em uma frase.',
  temperature: 0.5,
  maxTokens: 512,
})

console.log(result.text)    // string
console.log(result.model)   // string
console.log(result.provider) // 'gemini' | 'openai' | 'ollama'
```

`createAiClient` detecta automaticamente o provider pela chave configurada, usa o modelo salvo e aplica **retry** por padrão. Também aceita configuração explícita:

```ts
const ai = createAiClient({
  apiKey: 'sk-...',
  provider: 'openai',
  model: 'gpt-4o-mini',
  retry: { maxRetries: 3, delayMs: 1000 },
})

// Fallback: se openai falhar, tenta gemini
const aiWithFallback = createAiClient({
  primary: openAiClient,
  secondary: geminiClient,
})
```

### Teste de Conexão

```ts
const { success, error } = await ai.testConnection()
```

---

## Providers

### Gemini (`src/gemini/`)

APIs diretas do Google Gemini, exportadas sem prefixo por compatibilidade:

```ts
import {
  generateText,
  testConnection,
  listModels,
  parseGeminiError,
  generateEmbedding,
  createGeminiClient,
} from '@bosguega/ai-core'

// Geração de texto
const { text } = await generateText(prompt, apiKey, model, options?)

// Listagem de modelos
const models: ModelInfo[] = await listModels(apiKey)

// Embeddings
const { embedding, model } = await generateEmbedding(text, apiKey, model)

// Cliente programático
const client = createGeminiClient(apiKey, model)
```

### OpenAI (`src/openai/`)

Exportado com prefixo `openai` para evitar colisão com Gemini:

```ts
import {
  createOpenAiClient,
  openaiGenerateText,
  openaiTestConnection,
} from '@bosguega/ai-core'

const client = createOpenAiClient(apiKey, model)
const { text } = await client.generateText({ userPrompt: '...' })

// Chamada direta
const { text } = await openaiGenerateText(prompt, apiKey, model, options?)
```

### Ollama (`src/ollama/`)

Provider local HTTP, prefixado com `ollama`:

```ts
import {
  createOllamaClient,
  ollamaGenerateText,
  ollamaListModels,
  ollamaTestConnection,
  DEFAULT_OLLAMA_BASE_URL,
} from '@bosguega/ai-core'

const client = createOllamaClient(model, 'http://localhost:11434')
const { text } = await client.generateText({ userPrompt: '...' })

// Listar modelos disponíveis localmente
const models: OllamaModelInfo[] = await ollamaListModels(baseUrl)
```

### Detecção de Provider

`detectProvider(key)` retorna IDs canônicos, sem rótulos de UI:

| Chave | Retorno |
|---|---|
| `AIza...` | `gemini` |
| `sk-...` ou `sk_...` | `openai` |
| vazio/null | `none` |
| outro formato | `unknown` |

Apps devem mapear esses IDs para textos de interface, como "Google AI Studio" ou "OpenAI".

---

## Storage e Configuração

Armazenamento padrão usa `sessionStorage` para API key e `localStorage` para preferências. Ambientes como Tauri, React Native ou Node podem injetar um `ConfigStore` personalizado.

```ts
import {
  setApiKey,
  setApiModel,
  setAiProvider,
  setAiMode,
  setAiBaseUrl,
  setPersistenceEnabled,
  setConfigStore,
  getApiKey,
  getApiModel,
  getAiProvider,
  getAiMode,
  getAiBaseUrl,
  detectProvider,
  hasApiKey,
  hasAiConfig,
  browserStore,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODE,
  DEFAULT_AI_BASE_URL,
} from '@bosguega/ai-core'

// Configurar chave e modelo
await setApiKey('AIza...')
await setApiModel('gemini-1.5-flash-lite')
await setAiProvider('ollama')
await setAiMode('local')
await setAiBaseUrl('http://localhost:11434')
await setPersistenceEnabled(true)

// Injetar store customizado (ex: Tauri)
import { TauriStore } from './meu-tauri-store'
setConfigStore(new TauriStore())

// Verificar se há configuração válida
const ready = await hasAiConfig()
```

### Constantes Padrão

| Constante | Valor |
|---|---|
| `DEFAULT_AI_MODEL` | `gemini-1.5-flash-lite` |
| `DEFAULT_AI_PROVIDER` | `gemini` |
| `DEFAULT_AI_MODE` | `online` |
| `DEFAULT_AI_BASE_URL` | `http://localhost:11434` (Ollama) |

### Cache Síncrono (para UI)

Após `initializeAiConfig()`, use os getters sync para evitar `await` em componentes:

```ts
import {
  initializeAiConfig,
  getApiKeyCached,
  getApiModelCached,
  getAiModeCached,
  getAiProviderCached,
  getAiBaseUrlCached,
  getEffectiveProviderCached,
  hasApiKeyCached,
  hasAiConfigCached,
  detectProviderCached,
  isPersistenceEnabledCached,
  invalidateAiConfigCache,
} from '@bosguega/ai-core'

await initializeAiConfig()

// Sync — sem async/await
const key = getApiKeyCached()
const model = getApiModelCached()
const provider = getEffectiveProviderCached()
const ready = hasAiConfigCached()
```

---

## Wrappers

### Retry

Aplica retry com backoff em chamadas de IA:

```ts
import { withRetry } from '@bosguega/ai-core'

const client = withRetry(baseClient, { maxRetries: 3, delayMs: 1000 })
```

### Fallback

Tenta um client secundário se o primário falhar:

```ts
import { withFallback } from '@bosguega/ai-core'

const client = withFallback(primaryClient, secondaryClient)
```

---

## Parsing

Extrai JSON de respostas textuais de LLM:

```ts
import { extractJsonFromResponse } from '@bosguega/ai-core'

const json = extractJsonFromResponse<{ name: string; price: number }>(
  'Aqui está o JSON: ```json\n{"name": "Leite", "price": 5.50}\n```'
)
// { name: 'Leite', price: 5.50 }
```

Remove markdown, encontra o primeiro objeto/array JSON válido e faz parse automaticamente.

---

## Similaridade Vetorial

```ts
import { cosineSimilarity } from '@bosguega/ai-core'

const a = [0.1, 0.3, 0.5]
const b = [0.2, 0.4, 0.6]

const similarity = cosineSimilarity(a, b)
// 0.98...
```

---

## Hash

```ts
import { sha256 } from '@bosguega/ai-core'

const hash = await sha256('hello world')
// 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
```

---

## Erros

Todas as chamadas HTTP usam `AiApiError` com códigos canônicos e mensagens em **pt-BR**:

```ts
import {
  AiApiError,
  createAiApiError,
  friendlyMessages,
  getFriendlyMessage,
  isAuthError,
  isRetryableError,
  isNetworkError,
} from '@bosguega/ai-core'

try {
  await ai.generateText({ userPrompt: 'ok' })
} catch (err) {
  if (err instanceof AiApiError) {
    console.log(err.code)       // 'INVALID_API_KEY'
    console.log(err.statusCode)  // 403
    console.log(err.isAuthError())    // true
    console.log(err.isNetworkError()) // false
    console.log(err.isRateLimit())    // false
    console.log(err.isClientError())  // true
    console.log(err.isServerError())  // false
    console.log(err.message)    // pt-BR: "A chave de API informada não é válida..."
  }
}
```

### Códigos de Erro

| Código | Descrição |
|---|---|
| `INVALID_API_KEY` | Chave inválida ou expirada |
| `RATE_LIMIT_EXCEEDED` | Muitas requisições |
| `NETWORK_ERROR` | Falha de conexão |
| `SERVICE_UNAVAILABLE` | Serviço temporariamente fora |
| `SERVER_ERROR` | Erro interno do servidor (5xx) |
| `TIMEOUT` | Requisição excedeu tempo limite |
| `INVALID_RESPONSE` | Resposta inesperada da API |
| `INVALID_RESPONSE_FORMAT` | Formato de resposta inválido |
| `UNKNOWN_ERROR` | Erro não categorizado |

### Helpers

```ts
isAuthError(code)       // true para INVALID_API_KEY
isRetryableError(code)  // true para RATE_LIMIT_EXCEEDED, SERVER_ERROR, SERVICE_UNAVAILABLE
isNetworkError(code)    // true para NETWORK_ERROR, TIMEOUT
```

---

## Tipos Exportados

```ts
import type {
  ProviderClient,
  GenerateTextOptions,
  GenerateTextResult,
  TestConnectionResult,
  ProviderName,
  RetryOptions,
  ConfigStore,
  KeyValueStore,
  Provider,
  AIProvider,
  AIMode,
  ModelInfo,
  OllamaModelInfo,
  ApiErrorCode,
  ApiErrorLike,
  GeminiGenerateTextOptions,
  GeminiGenerateTextResult,
  GeminiGenerateEmbeddingResult,
  GeminiTestConnectionResult,
  OpenAiTestConnectionResult,
  OllamaTestConnectionResult,
} from '@bosguega/ai-core'
```

---

## Estrutura do Pacote

```
src/
├── client/        — Factory unificada, wrappers de retry/fallback, tipos do contrato
│   ├── createAiClient.ts
│   ├── retryWrapper.ts
│   ├── fallbackWrapper.ts
│   └── types.ts
├── gemini/        — Provider Google Gemini (texto, embedding, listagem, teste)
├── openai/        — Provider OpenAI (texto, teste)
├── ollama/        — Provider Ollama local HTTP (texto, listagem, teste)
├── errors/        — AiApiError, helpers, códigos canônicos, mensagens pt-BR
├── parsing/       — extractJsonFromResponse para respostas de LLM
├── hash/          — sha256
├── similarity/    — similaridade de cosseno
├── storage/       — ConfigStore, cache sync, persistência (session/localStorage)
└── index.ts       — Barrel export
```

---

## Desenvolvimento

```bash
# Na raiz do monorepo
pnpm install

# Build (type-check)
pnpm --filter @bosguega/ai-core build

# Testes (usa Vitest do my_mercado)
pnpm --filter @bosguega/ai-core test
```

## Convenções (`.clinerules`)

- TypeScript puro, **zero dependências de framework**
- **Sempre exportar funções, nunca classes** (exceção: `AiApiError` que estende `Error`)
- JSDoc em inglês para API pública
- Mensagens de erro em **pt-BR**
- Código autoexplicativo — comentários mínimos, nomes descritivos
- Cada provider em seu próprio diretório, sem acoplamento entre eles