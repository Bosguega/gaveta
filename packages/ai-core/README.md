# ai-core

Infraestrutura reutilizavel de IA para apps do workspace `gaveta`.

O pacote deve permanecer agnostico de framework e de dominio: ele sabe chamar providers, guardar configuracao, aplicar retry/fallback, extrair JSON generico, calcular hash e similaridade. Prompts, categorias, schemas de produto, logging de app e fallbacks de negocio ficam nos apps consumidores.

## API Principal

```ts
import {
  createAiClient,
  detectProvider,
  extractJsonFromResponse,
  initializeAiConfig,
  listModels,
  setApiKey,
  setApiModel,
} from '@bosguega/ai-core'
```

### Providers

`detectProvider(key)` retorna ids canonicos, sem rotulos de UI:

| Chave | Retorno |
| --- | --- |
| `AIza...` | `gemini` |
| `sk-...` ou `sk_...` | `openai` |
| vazio/null | `none` |
| outro formato | `unknown` |

Apps devem mapear esses ids para textos de interface, como "Google AI Studio" ou "OpenAI".

### Cliente Unificado

```ts
await initializeAiConfig()

const ai = createAiClient()
const result = await ai.generateText({
  userPrompt: 'Resuma TypeScript em uma frase.',
  temperature: 0.5,
  maxTokens: 512,
})

console.log(result.text)
```

`createAiClient` detecta `gemini` ou `openai` pela chave, usa o modelo salvo e aplica retry por padrao. Tambem aceita configuracao explicita:

```ts
const ai = createAiClient({
  apiKey: 'sk-...',
  provider: 'openai',
  model: 'gpt-4o-mini',
  retry: { maxRetries: 2, delayMs: 1000 },
})
```

### APIs Diretas

Para compatibilidade, `generateText`, `testConnection`, `listModels` e `parseGeminiError` continuam apontando para Gemini. A API direta da OpenAI e exportada com prefixo: `openaiGenerateText` e `openaiTestConnection`.

### Storage

O storage padrao usa `sessionStorage` para API key e `localStorage` para preferencias. Ambientes como Tauri, React Native ou Node podem injetar outro `ConfigStore`.

```ts
await setApiKey('AIza...')
await setApiModel('gemini-1.5-flash-lite')
await initializeAiConfig()
```

O modelo padrao canonico do pacote e `gemini-1.5-flash-lite`.

### Erros

As chamadas HTTP usam `AiApiError` e codigos genericos:

```ts
try {
  await ai.generateText({ userPrompt: 'ok' })
} catch (err) {
  if (err instanceof AiApiError) {
    console.log(err.code)
    console.log(err.isAuthError())
    console.log(err.isNetworkError())
  }
}
```

Codigos principais: `INVALID_API_KEY`, `RATE_LIMIT_EXCEEDED`, `NETWORK_ERROR`, `SERVICE_UNAVAILABLE`, `SERVER_ERROR`, `TIMEOUT`, `INVALID_RESPONSE_FORMAT`.

## Modulos

- `gemini/`: chamada de texto, listagem de modelos e teste de conexao do Google Gemini.
- `openai/`: chamada de texto e teste de conexao da OpenAI.
- `client/`: `createAiClient`, `withRetry`, `withFallback` e contrato `ProviderClient`.
- `storage/`: configuracao de API key, modelo, persistencia e cache sync.
- `parsing/`: `extractJsonFromResponse` para respostas textuais de LLM.
- `hash/`: `sha256`.
- `similarity/`: similaridade de cosseno e busca por embedding.

## Desenvolvimento

```bash
npm run build
npm run test
```

No workspace atual, o script de teste usa o Vitest instalado pelo app `my_mercado`.
