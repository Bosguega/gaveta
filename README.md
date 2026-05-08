# 🧰 Gaveta de Bagunça

> **Compartilhe lógica entre apps sem reinventar a roda.**

Um monorepo que centraliza infraestrutura reutilizável — começando com integração com IA (Gemini) — para evitar reescrever a mesma coisa em cada projeto novo.

---

## 📦 Visão Geral

```txt
gaveta/
├── package.json                    ← workspace root (pnpm)
├── pnpm-workspace.yaml             ← workspaces: packages/* e apps/*
├── tsconfig.json                   ← config TS base
│
├── *.code-workspace                ← atalhos do editor (abrir só o que precisa)
│   ├── app-teste.code-workspace
│   └── memoria-auxiliar.code-workspace
│
├── packages/
│   └── gaveta-de-bagunca/          ← @bosguega/gaveta-de-bagunca (core)
│       ├── src/
│       │   ├── index.ts            ← exporta gemini/ + storage/
│       │   │
│       │   ├── gemini/             ← integração com Google Gemini
│       │   │   ├── generateText.ts  ← chamada fetch à API
│       │   │   ├── listModels.ts    ← listagem de modelos
│       │   │   ├── parseError.ts    ← parser de erros HTTP
│       │   │   ├── testConnection.ts ← teste rápido de conectividade
│       │   │   ├── errors.ts        ← AiApiError + mensagens amigáveis
│       │   │   └── index.ts         ← barrel
│       │   │
│       │   └── storage/            ← gerenciamento de chave/modelo
│       │       ├── aiConfig.ts      ← getApiKey, detectProvider, etc.
│       │       └── index.ts         ← barrel
│       │
│       ├── tsconfig.json
│       └── package.json
│
└── apps/
    ├── app-teste/                  ← app de exemplo (Vite + vanilla TS)
    │   ├── src/main.ts             ← testa importação do core
    │   ├── index.html
    │   ├── vite.config.ts
    │   └── package.json
    │
    └── memoria-auxiliar/           ← app Tauri + Vue (IA no backend Rust)
        ├── src/
        ├── src-tauri/
        ├── vite.config.ts
        └── package.json
```

---

## 🚀 Começando

### Pré-requisitos

- [pnpm](https://pnpm.io/) 10+

```bash
# Instalar pnpm globalmente (se não tiver)
npm install -g pnpm
```

### Instalar

```bash
pnpm install
```

### Rodar o app de teste

```bash
cd apps/app-teste
npx vite
```

Acesse `http://localhost:XXXX` — o app testa as funções do core e mostra o resultado na tela.

---

## 📚 API — `@bosguega/gaveta-de-bagunca`

### Gemini

#### `generateText(prompt, apiKey, model, options?)`

Envia um prompt para o Gemini e retorna o texto gerado.

```ts
import { generateText } from '@bosguega/gaveta-de-bagunca'

const result = await generateText(
  'Resuma o que é TypeScript em uma frase.',
  'AIza...',                           // sua API key
  'gemini-2.0-flash',                  // modelo
  { temperature: 0.5 }                 // opcional
)

console.log(result.text)
// "TypeScript é um superset do JavaScript que adiciona tipos estáticos opcionais."
```

| Parâmetro | Tipo | Obrigatório | Padrão |
|-----------|------|-------------|--------|
| `prompt` | `string` | ✅ | — |
| `apiKey` | `string` | ✅ | — |
| `model` | `string` | ✅ | — |
| `options.temperature` | `number` | ❌ | `0.7` |
| `options.maxOutputTokens` | `number` | ❌ | `2048` |

#### `listModels(apiKey)`

Lista os modelos disponíveis que suportam `generateContent`.

```ts
import { listModels } from '@bosguega/gaveta-de-bagunca'

const models = await listModels('AIza...')
// [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }, ...]
```

#### `testConnection(apiKey, model)`

Testa se a API key + modelo funcionam enviando um prompt mínimo.

```ts
import { testConnection } from '@bosguega/gaveta-de-bagunca'

const result = await testConnection('AIza...', 'gemini-2.0-flash')
// { success: true } ou { success: false, error: '...' }
```

#### `parseGeminiError(status, body)`

Analisa o erro HTTP retornado pela API e retorna um `AiApiError` com mensagem amigável.

```ts
import { parseGeminiError } from '@bosguega/gaveta-de-bagunca'

const err = parseGeminiError(403, '{"error":{"message":"API_KEY_INVALID"}}')
// AiApiError { message: 'A chave de API informada não é válida...', code: 'INVALID_API_KEY' }
```

### Tratamento de Erros

Todas as funções que chamam a API disparam `AiApiError`. Você pode capturar e identificar o tipo de erro:

```ts
import { generateText, AiApiError } from '@bosguega/gaveta-de-bagunca'

try {
  await generateText('...', 'AIza...', 'gemini-2.0-flash')
} catch (err) {
  if (err instanceof AiApiError) {
    console.log(err.message)      // mensagem amigável em português
    console.log(err.code)         // ex: 'INVALID_API_KEY', 'RATE_LIMIT_EXCEEDED'
    console.log(err.statusCode)   // ex: 403

    err.isAuthError()      // true se chave inválida
    err.isRateLimit()      // true se 429
    err.isClientError()    // true se 4xx (exceto 429)
    err.isServerError()    // true se 5xx
    err.isNetworkError()   // true se timeout / falha de rede
  }
}
```

**Códigos de erro:**

| Código | Significado |
|--------|-------------|
| `INVALID_API_KEY` | Chave inválida ou sem permissão |
| `RATE_LIMIT_EXCEEDED` | Muitas requisições em pouco tempo |
| `TIMEOUT` | Servidor não respondeu a tempo |
| `SERVICE_UNAVAILABLE` | Serviço temporariamente fora do ar |
| `SERVER_ERROR` | Erro interno do servidor (5xx) |
| `INVALID_RESPONSE_FORMAT` | Resposta inesperada da API |
| `NETWORK_ERROR` | Falha de conexão de rede |

### Storage

Funções para gerenciar a API key e modelo selecionado no navegador. Framework-agnostic (funciona com React, Vue, vanilla TS, etc.).

```ts
import {
  getApiKey, setApiKey, clearApiKey, hasApiKey,
  getApiModel, setApiModel,
  detectProvider,
  isPersistenceEnabled, setPersistenceEnabled
} from '@bosguega/gaveta-de-bagunca'
```

#### `getApiKey()` / `setApiKey(key)` / `clearApiKey()`

Gerencia a chave no `sessionStorage` (padrão) ou `localStorage` (se persistência ativada).

```ts
setApiKey('AIza...')
const key = getApiKey() // 'AIza...'
clearApiKey()
```

#### `getApiModel()` / `setApiModel(model)`

O modelo é sempre salvo no `localStorage` (não é dado sensível).

```ts
getApiModel()          // 'gemini-2.0-flash' (padrão)
setApiModel('gemini-1.5-pro')
```

#### `detectProvider(key)`

Identifica o provedor pelo prefixo da chave.

```ts
detectProvider('AIza...')   // 'Google AI Studio'
detectProvider('sk-...')    // 'OpenAI'
detectProvider(null)        // 'Nenhum'
detectProvider('abc')       // 'Desconhecido'
```

#### `hasApiKey()`

Retorna `true` se existe uma chave configurada.

```ts
if (hasApiKey()) {
  // chave já foi configurada
}
```

#### `isPersistenceEnabled()` / `setPersistenceEnabled(bool)`

Controla se a chave persiste entre sessões (localStorage) ou é limpa ao fechar o navegador (sessionStorage).

```ts
setPersistenceEnabled(true)   // chave fica salva mesmo fechando o navegador
setPersistenceEnabled(false)  // chave some ao fechar a aba
```

---

## 🏗️ Filosofia

Esse projeto é uma **gaveta de bagunça útil**.

- **Nada de overengineering.** Cada função só existe porque tem uso real.
- **Evolução incremental.** Começamos com Gemini puro. OpenAI, Claude, etc. entram quando houver demanda.
- **Core agnóstico de framework.** Zero dependência de React, Vue ou DOM. Funciona em qualquer lugar.
- **Preferir funções a classes.** Simples, previsível, fácil de entender.
- **Erros em português.** O usuário final não precisa saber inglês pra entender o que deu errado.

---

## 🧪 Apps de exemplo

| App | Descrição |
|-----|-----------|
| `app-teste` | Interface simples que testa as funções do core (input de API key, listar modelos, enviar prompt) |

---

## 🔧 Workspaces do Editor

Na raiz do projeto existem arquivos `.code-workspace` que funcionam como atalhos para abrir **apenas as pastas necessárias** no Antigravity / VS Code, sem carregar o monorepo inteiro.

Cada workspace inclui o **core** (`packages/gaveta-de-bagunca`) + **um app específico**.

### Como usar

1. **File → Open Workspace** no Antigravity / VS Code
2. Seleciona o workspace desejado, ex: `memoria-auxiliar.code-workspace`
3. Pronto — o editor abre só o core + o app, com TypeScript funcionando

### Workspaces disponíveis

| Arquivo | Pastas incluídas |
|---------|-----------------|
| `app-teste.code-workspace` | core + app-teste |
| `memoria-auxiliar.code-workspace` | core + memoria-auxiliar |

Para criar um workspace novo, copie um existente e troque o nome da pasta em `folders[].path`.

---

## 🛠️ Desenvolvimento

### Adicionar um novo app

```bash
mkdir apps/meu-app
cd apps/meu-app
pnpm init
pnpm add @bosguega/gaveta-de-bagunca
```

O `pnpm-workspace.yaml` já inclui `apps/*`.

### Instalar dependências (raiz)

```bash
pnpm install
```

### Build do core

```bash
pnpm --filter @bosguega/gaveta-de-bagunca build
```

### Script principal

```bash
pnpm dev    # build do core + start do app-teste
