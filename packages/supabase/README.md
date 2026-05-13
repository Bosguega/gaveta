# @bosguega/supabase

Infraestrutura Supabase reutilizavel para o monorepo.

O pacote permanece agnostico: nao cria singleton, nao le `import.meta.env`, nao conhece tabelas/RPCs do app e nao depende de React/Vue. Apps passam o client explicitamente e mantem regras de dominio localmente.

## Client

```ts
import { createSupabaseClient } from '@bosguega/supabase'

const supabase = createSupabaseClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  options: {
    auth: { persistSession: true },
  },
})
```

O factory aceita generics de database:

```ts
const supabase = createSupabaseClient<Database>({ url, anonKey })
```

## Auth

```ts
import {
  signIn,
  signUp,
  signOut,
  getUser,
  requireUser,
  getAuthenticatedContext,
} from '@bosguega/supabase'

await signIn(supabase, email, password)
const user = await requireUser(supabase)
const { client, user: currentUser } = await getAuthenticatedContext(supabase)
```

`getUser` e `getSession` retornam `null` em falha. `requireUser`, `requireSession` e `getAuthenticatedContext` lancam `SupabaseError` preservando a causa.

## Edge Functions

```ts
import { invoke } from '@bosguega/supabase'

const result = await invoke<MyResponse>(supabase, 'fetch-nfce', {
  body: { url },
  headers: { 'x-request-id': requestId },
  timeoutMs: 30_000,
  retries: 2,
})
```

`invoke` repassa opcoes de `FunctionInvokeOptions`, aplica timeout, retry seletivo e unwrap de `{ data, error }`.

## Retry e Timeout

```ts
import { withRetry, withTimeout } from '@bosguega/supabase'

const data = await withRetry(
  () => supabase.from('receipts').select('*'),
  { attempts: 3, baseDelayMs: 500 }
)

await withTimeout(operation, 5000)
```

Retry padrao ocorre apenas para falhas recuperaveis: rede, timeout, HTTP 408/429 e 5xx. Apps podem passar `shouldRetry`.

## Errors

```ts
import {
  SupabaseError,
  getSupabaseErrorInfo,
  isRetryableError,
  mapSupabaseError,
} from '@bosguega/supabase'

const info = getSupabaseErrorInfo(error)
```

O package normaliza erros Supabase/PostgREST/Postgres/Functions em informacoes genericas (`code`, `message`, `details`, `hint`, `status`). Apps devem converter isso para erros de dominio quando necessario.

## Storage

```ts
import { upload, download, remove, getPublicUrl } from '@bosguega/supabase'

await upload(supabase, 'bucket', 'path/file.pdf', file)
const blob = await download(supabase, 'bucket', 'path/file.pdf')
await remove(supabase, 'bucket', ['path/file.pdf'])
```

## Desenvolvimento

```bash
npm run build
npm run test
```

No workspace atual, o script de teste usa o Vitest instalado pelo app `my_mercado`.
