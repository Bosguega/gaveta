# pdf-collection-viewer

Biblioteca visual de arquivos organizada por **coleções**, com busca global, tags geradas por IA e busca de conteúdo dentro dos PDFs.

App desktop **Tauri 2 + React 18 + TypeScript + Tailwind CSS v4**, com armazenamento local em SQLite.

## Funcionalidades

- **Coleções** — grupos lógicos de pastas (qualquer tipo de arquivo), com ícone, capa, fixação e varredura incremental (`walkdir`), incluindo subpastas opcionalmente.
- **Thumbnails** — miniaturas em WebP com cache (chave = sha256 do caminho); renderizadores por tipo: PDF (pdfium), bordado (dst/exp/pes/pec/jef/vp3/xxx/vip/hus/sew) e imagens.
- **Favoritos, duplicados e filtros** — coleção virtual de favoritos, análise de duplicados por hash, filtros por tamanho/pontos/estatísticas de bordado.
- **Busca global** — por nome/caminho do arquivo em todas as coleções (com escopo de coleções selecionável).
- **Tags com IA** — geração de tags via servidor llama.cpp local (API compatível com OpenAI, modelo multimodal ex.: Ternary-Bonsai-27B + mmproj) a partir de algumas páginas amostradas do PDF.
- **Busca de conteúdo (FTS)** — localiza palavras/frases **dentro das páginas dos PDFs**, retornando documento + página + trecho destacado (ver detalhes abaixo).

## Busca de conteúdo nos PDFs

Pipeline por etapas, com responsabilidades separadas das tags:

| Camada | Pergunta que responde | Status |
|---|---|---|
| **Tags** | "que tipo de documento é?" | ✅ implementado (IA, amostragem de páginas) |
| **FTS (texto)** | "onde aparece exatamente esta palavra/frase?" | ✅ etapa 1 implementada (texto nativo) |
| **OCR/vision** | (mesma pergunta, para páginas-imagem) | 🔜 etapa 2 — POC de qualidade antes da indexação massiva |
| **Embeddings** | "onde existe conteúdo relacionado a esta ideia?" | 🔜 etapa 3 (por página) |
| **Busca híbrida** | FTS + semântica combinados | 🔜 etapa 4 |

### Como funciona hoje (etapa 1)

```
PDF → pdfium (texto nativo por página) → page_content → FTS5 (SQLite)
```

- **Um registro por página** (`page_content`): `file_id`, `page_number`, `extraction_method` (`native`), `text`, `extractor_version`, `indexed_at`.
- Páginas sem texto extraível (majoritariamente imagem) ficam com texto vazio — serão atendidas pela etapa de OCR/vision.
- Tabela virtual `page_content_fts` (FTS5) com tokenizer `unicode61 remove_diacritics 2` — a busca ignora acentuação.
- Estado de indexação por arquivo (`file_index`): `pending` | `processing` | `done` | `no_text` | `failed` (+ mensagem de erro).
- **Reindexação automática** quando o arquivo muda (size/modified_at), quando a versão do extrator avança ou após falha/interrupção.
- Resultados mostram **documento, coleção, página e snippet** com o termo destacado; ranking por BM25.
- Disparo manual pelo botão **🧠 Indexar conteúdo** na Home (respeita o escopo de coleções), com progresso e cancelamento.

### Roadmap do conteúdo

1. **Etapa 2 — OCR/vision (POC primeiro):** renderizar a página → imagem → Bonsai (llama.cpp multimodal) → texto, validando a qualidade da transcrição em páginas reais variadas (crochê, revista, texto pequeno, tabela, página visual...) **antes** de indexar a biblioteca em massa. O campo `extraction_method` e o versionamento por modelo já estão no schema.
2. **Etapa 3 — Embeddings por página** com modelo dedicado (ex.: bge-m3 via llama-server), tabela própria e cache por hash do texto; busca por similaridade simples (sem sqlite-vec na validação inicial).
3. **Etapa 4 — Busca híbrida** (FTS + semântica via RRF) e filtros combinados com as tags existentes.

Fora de escopo (de propósito): reconstrução do PDF em HTML/Markdown, heurísticas de layout, chunking sofisticado, geração automática de novas tags.

## Modelo de dados (SQLite)

- `collections`, `collection_paths` — coleções e pastas raiz.
- `files` — arquivos (genérico; `file_type` identifica pdf/bordado/imagem; `page_count` para PDFs).
- `tags`, `file_tags` — tags de navegação/classificação (geradas por IA ou manuais).
- `settings` — configurações persistidas (tags IA, etc.).
- `page_content`, `page_content_fts`, `file_index` — índice de conteúdo por página (busca FTS).

Tags (classificação) e conteúdo (busca textual) são sistemas independentes por design.

## Estrutura

```
src/                        # Frontend React
├── components/             # Componentes (cards, modais, thumbnails…)
├── pages/                  # HomePage (coleções + busca global) e CollectionPage
├── services/               # Wrappers de invoke (items, collections, tags, content…)
├── store/                  # Zustand
└── types/                  # Tipos compartilhados

src-tauri/src/              # Backend Rust
├── db.rs                   # Schema SQLite + CRUD + busca (LIKE e FTS)
├── scanner.rs / scan.rs    # Descoberta de arquivos + reconciliação do scan
├── thumbnails.rs           # Renderização de thumbnails + cache WebP
├── file_types.rs           # FileType e extensões suportadas
├── tagging.rs              # Tags via llama.cpp (multimodal)
├── indexing.rs             # Extração de texto nativo dos PDFs (etapa 1 do conteúdo)
├── embroidery/             # Parsers de formatos de bordado
└── commands.rs             # Comandos Tauri (IPC)
```

## Como rodar

Pré-requisitos: **pnpm**, **Rust** (stable) e **WebView2** (Windows). O backend carrega a biblioteca dinâmica do **Pdfium** em runtime (procura em `resource_dir`, pasta do executável e no sistema).

```bash
# na raiz do monorepo
pnpm install

# ambiente de desenvolvimento (frontend + Tauri)
pnpm --filter pdf-collection-viewer tauri:dev

# build de produção
pnpm --filter pdf-collection-viewer tauri:build

# apenas frontend (vite, sem backend)
pnpm --filter pdf-collection-viewer dev
```

### Testes e checagens

```bash
# testes Rust (schema, reconciliação de scan, FTS, etc.)
cargo test --manifest-path apps/pdf-collection-viewer/src-tauri/Cargo.toml

# typecheck + build do frontend
pnpm --filter pdf-collection-viewer build
```

## Comandos Tauri de conteúdo (IPC)

- `search_content(query, limit?, collectionIds?)` — busca full-text por página.
- `index_pdfs(collectionIds?)` — indexa todos os PDFs pendentes (thread própria; eventos `indexing-progress` / `indexing-done`).
- `index_item(itemId)` — indexa um único PDF.
- `cancel_indexing()` — cancela o job em andamento.
- `get_index_status(collectionIds?)` — estado de indexação por arquivo.

## Regras do projeto

Ver `.clinerules` deste app (UI/mensagens em pt-BR, código/JSDoc em inglês, funções preferencialmente a classes, IO pesado fora do lock do banco, arquivos sempre salvos em UTF-8, etc.).
