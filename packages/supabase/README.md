# @bosguega/supabase

Package compartilhado de infraestrutura Supabase para o monorepo.

## Filosofia

- **Simples** — sem abstrações desnecessárias
- **Explícito** — sem estado global, sem mágica
- **Agnóstico** — zero dependência de framework, bundler ou runtime
- **Composable** — funções puras que recebem o client como parâmetro

## Instalação

```bash
pnpm add @bosguega/supabase
```

## Uso

### Client

```ts
import { createSupabaseClient } from '@bosguega/supabase'

const supabase = createSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
})
```

O app é responsável por armazenar e exportar a instância do client.

### Auth

```ts
import { signIn, signUp, signOut, getUser } from '@bosguega/supabase'

// Login
const data = await signIn(supabase, 'email@exemplo.com', 'senha')

// Cadastro
const data = await signUp(supabase, 'email@exemplo.com', 'senha')

// Logout
await signOut(supabase)

// Verificar usuário logado
const user = await getUser(supabase)
if (user) {
  console.log('Logado como', user.email)
}
```

### Edge Functions

```ts
import { invoke } from '@bosguega/supabase'

const result = await invoke(supabase, 'send-email', {
  body: { to: 'user@email.com' },
  timeoutMs: 10000,
  retries: 2,
})
```

### Storage

```ts
import { upload, download, remove, getPublicUrl } from '@bosguega/supabase'

// Upload
await upload(supabase, 'bucket', 'caminho/arquivo.pdf', file)

// Download
const blob = await download(supabase, 'bucket', 'caminho/arquivo.pdf')

// Remover
await remove(supabase, 'bucket', ['arquivo1.pdf', 'arquivo2.pdf'])

// URL pública
const url = getPublicUrl(supabase, 'bucket', 'caminho/arquivo.pdf')
```

### Retry e Timeout

```ts
import { withRetry, withTimeout } from '@bosguega/supabase'

// Retry com backoff exponencial
const data = await withRetry(
  () => supabase.from('users').select('*'),
  { attempts: 3, baseDelayMs: 500 }
)

// Timeout
const data = await withTimeout(
  supabase.from('users').select('*'),
  5000
)
```

### Tratamento de Erro

```ts
import { SupabaseError, isAuthError, isNetworkError } from '@bosguega/supabase'

try {
  await signIn(supabase, 'email', 'senha errada')
} catch (err) {
  if (isAuthError(err)) {
    console.error('Erro de autenticação:', err.message)
  }
  if (err instanceof SupabaseError) {
    console.error(`[${err.code}] ${err.message}`)
  }
}
```

## Módulos

| Módulo | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Client | `create-client.ts` | Factory para criar instância do Supabase |
| Errors | `errors.ts` | Classes de erro e helpers |
| Auth | `auth.ts` | Login, cadastro, logout, sessão |
| Retry | `retry.ts` | Retry com backoff exponencial |
| Timeout | `timeout.ts` | Timeout para operações assíncronas |
| Functions | `services/functions.ts` | Invocação de edge functions |
| Storage | `services/storage.ts` | Upload, download, remoção |

## O que NÃO está incluído

- Estado global / singleton
- Dependência de framework (Vue, React)
- `import.meta.env` — o app passa as credenciais explicitamente
- Tipos de tabelas do banco — o app gera com `supabase gen types`
- Realtime (adiado até surgir padrão repetitivo)
- Logger (adiado até surgir necessidade real)