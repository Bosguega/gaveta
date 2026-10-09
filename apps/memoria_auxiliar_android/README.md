# 📱 Memória Auxiliar — Android

> Extensão Android nativa do `memoria_auxiliar` (PC). Captura rápida de
> memórias no celular, guarda temporariamente no aparelho e sincroniza com
> o PC quando ele estiver disponível.

---

## Estado atual (etapas 1–3 + widget)

- **Captura**: tela única (conteúdo + tags + salvar) e **widget** `🧠 + Memória`
  no launcher, que abre uma captura rápida em diálogo; ambos escrevem na
  mesma `PendingMemoryStore`.
- **Persistência local**: `SharedPreferences + JSON` (`org.json`, sem
  dependências). Sobrevive a fechar/reabrir; gravação com `commit()`
  síncrono.
- **Sincronização manual**: configuração de IP:porta + token, `POST /memories`
  com Bearer, remoção **somente** dos ids listados em `accepted[]`.
- `PendingMemory` com UUID gerado na captura e `created_at` RFC 3339 UTC
  (mesmo formato do `Utc::now().to_rfc3339()` do backend Rust).

## O que este app NÃO é

- não roda IA local (sem LLM, embeddings, busca semântica ou RAG);
- não acessa o SQLite do PC nem copia a base de memórias;
- não usa Supabase (futuramente apenas no fluxo de lembretes);
- não é PWA nem multiplataforma — Android puro (Kotlin + framework).

A memória principal continua pertencendo ao PC: banco, BGE-M3,
embeddings, Bonsai/llama.cpp e processamento ficam todos no desktop.

---

## Contrato PC ↔ Android (implementado)

| Compartilhado | Exclusivo do PC |
|---|---|
| `content` | `embedding` (BGE-M3) |
| `tags` (mesma convenção de string) | `id` inteiro (rowid do SQLite) |
| `created_at` RFC 3339 UTC (momento da captura) | busca semântica, RAG, chat |
| `client_id` (UUID gerado na captura) + protocolo sync com ACK | `embedding_cache`/`embedding_profile` |

Servidor no PC: HTTP em thread dedicada no Tauri (`0.0.0.0:32173` por
padrão), `POST /memories` + `GET /health`, token Bearer em `sync_token`.
Ver `SYNC_*` em `apps/memoria_auxiliar/src-tauri/src/lib.rs`.

### Identidade e duplicação

- O Android gera um **UUID na captura** (`PendingMemory.id`). O `id`
  inteiro do PC é local e não serve entre dispositivos.
- O PC tem a coluna `client_id TEXT` (nullable, índice único) — notas
  antigas e do PC ficam `NULL`. O insert é idempotente por `client_id`:
  reenvio após timeout retorna "já existia" como aceito, sem duplicar.

### Confirmação antes de apagar

- O celular só remove memórias listadas em `accepted[]` de um HTTP 200.
  Qualquer erro de rede, timeout, HTTP ≠ 200 ou resposta inválida mantém
  tudo pendente.
- Envio at-least-once + idempotência no PC = seguro contra timeout.

### Descoberta do PC

v1 manual: IP:porta + token digitados no app (o emulador alcança o host
via `10.0.2.2`). mDNS/NSD automático é decisão futura (v2).

---

## Widget

- `MemoryWidgetProvider` (110×40dp, `updatePeriodMillis="0"`) + layout
  `widget_memory.xml`; toque abre `QuickCaptureActivity` em tema de diálogo
  via `PendingIntent` — `RemoteViews` não permite `EditText` digitável no
  próprio widget, por isso o diálogo é a forma mais próxima e simples.
- A captura do widget gera o mesmo UUID + `createdAt`, **sem tags** (v1),
  e mostra apenas `✓ Memória salva.` — nunca "sincronizada".
- O widget não conhece PC, IP, token ou sincronização: é entrada
  alternativa para a mesma caixa de pendentes.

---

## Decisões pendentes (não tomadas aqui)

- transporte além do HTTP atual, sync em background (WorkManager ou outra);
- descoberta automática do PC (mDNS/NSD);
- notificações locais ("PC detectado") vs. lembretes via Supabase/FCM.

---

## Ideia futura: sincronização híbrida Android ↔ PC (NÃO implementar por enquanto)

Atualmente o Android mantém as memórias pendentes localmente e sincroniza
diretamente com o PC quando o servidor do Memória Auxiliar está disponível.

Como evolução futura, avaliar uma **caixa postal temporária no Supabase**
para armazenar notas quando o PC estiver indisponível, permitindo que o
aplicativo desktop as receba posteriormente.

**Não implementar por enquanto.** A sincronização direta atende ao uso
individual atual. Reavaliar somente se a necessidade de sincronizar com o
PC indisponível se tornar frequente.

Se implementada, preservar:

- SQLite do PC como armazenamento definitivo das memórias;
- `client_id` e idempotência existentes (a caixa postal transporta os mesmos
  `client_id`s — o PC continua descartando duplicatas do mesmo jeito);
- remoção das pendências somente após confirmação segura de recebimento
  pelo PC (o ACK continuaria vindo do PC, não do Supabase — a caixa postal
  é transporte, não destino);
- separação entre sincronização de memórias e sistema de lembretes.

Ponderações para quando (e se) essa hora chegar:

- **A caixa postal não substitui a caixa de entrada local**: o Android
  continuaria guardando as pendentes em `PendingMemoryStore` e só as
  apagaria após o ACK do PC. O Supabase seria um *retransmissor*, nunca
  o lugar onde a memória "mora".
- **Ordem de tentativa**: direto primeiro (LAN, sem custo nem dependência
  externa), caixa postal como fallback quando o PC não responde — não o
  contrário.
- **Não colocar as memórias no Supabase apenas para facilitar a
  sincronização**: a motivação legítima seria cobrir o caso "PC
  indisponível", não conveniência de implementação.
- **Expiração**: itens na caixa postal deveriam ter TTL curto (dias, não
  meses) — é trânsito, não arquivo. Sem expiração, vira uma segunda base
  de dados para administrar.
- **Custo de superfície**: autenticação, regras de acesso por usuário,
  limpeza de itens já entregues e depuração de "foi entregue ou não?"
  são complexidade real para um uso individual — por isso a reavaliação
  deve ser por necessidade observada, não por antecipação.

---

## Estrutura

```text
app/src/main/java/com/bosguega/memoriaauxiliar/
├── MainActivity.kt          ← captura + lista + sincronização manual
├── QuickCaptureActivity.kt  ← captura rápida em diálogo (aberta pelo widget)
├── MemoryWidgetProvider.kt  ← widget compacto → PendingIntent → QuickCapture
└── data/
    ├── PendingMemory.kt     ← contrato: UUID + content + tags + createdAt
    ├── PendingMemoryStore.kt← caixa de entrada (SharedPreferences + JSON)
    ├── SyncClient.kt        ← POST /memories; só accepted[] pode ser removido
    └── SyncConfig.kt        ← host/porta/token (config manual v1)
```

A UI fala apenas com `PendingMemoryStore`/`SyncConfig`/`SyncClient` — o
widget entra pelo mesmo ponto, sem depender de Activity.

---

## Build

Pré-requisitos: JDK 17, Android SDK (platform 35) e `local.properties`
apontando para o SDK desta máquina.

```bash
cd apps/memoria_auxiliar_android
./gradlew assembleDebug   # Windows: gradlew.bat assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

Este diretório **não tem `package.json` de propósito**: o workspace pnpm
(`apps/*`) ignora diretórios sem `package.json`, então o Gradle do Android
convive com o monorepo sem participar do build de JavaScript.
