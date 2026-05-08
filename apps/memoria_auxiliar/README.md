# Memoria Auxiliar

Aplicativo desktop simples com Tauri, Vue 3, TypeScript e SQLite para salvar notas curtas e buscar por similaridade semantica usando embeddings do Gemini.

## Requisitos

- Node.js
- Rust/Cargo
- Chave da Gemini API

## Configuracao

```bash
npm install
cp .env.example .env
```

Edite `.env` e preencha:

```bash
GEMINI_API_KEY=sua_chave
```

## Rodar em desenvolvimento

```bash
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

## Arquitetura

- `src/views/HomeView.vue`: tela unica do MVP.
- `src/components`: formulario de nota, busca e lista de resultados.
- `src/services/databaseService.ts`: acesso ao SQLite via comandos Tauri.
- `src/services/embeddingService.ts`: cache por hash SHA-256 e chamada ao comando Tauri de embeddings.
- `src/services/similarityService.ts`: similaridade de cosseno em TypeScript.
- `src/services/llmService.ts`: resumo e respostas via comandos Tauri.
- `src-tauri/src/lib.rs`: comandos Rust, inicializacao do SQLite local e chamadas Gemini sem expor a chave no bundle frontend.

## Banco

Tabela principal:

```sql
notes (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  created_at TEXT
)
```

O app tambem cria `embedding_cache` para evitar chamadas repetidas de embedding para textos iguais.
