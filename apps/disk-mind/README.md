# 🧠 DiskMind

**DiskMind** é um analisador inteligente de disco desktop construído com [Tauri v2](https://tauri.app/) + Rust + React. Ele escaneia diretórios, indexa arquivos e pastas em um banco de dados SQLite local, e expõe uma interface para visualizar snapshots, entidades detectadas e recomendações de otimização.

---

## ✨ Funcionalidades

- 📂 **Escaneamento de diretórios** — percorre recursivamente qualquer pasta do sistema, coletando metadados de arquivos e subdiretórios.
- 🗄️ **Indexação SQLite** — persiste cada varredura como um *snapshot* imutável, com estrutura hierárquica de diretórios e arquivos.
- 🧩 **Classificação de entidades** — módulo extensível para categorizar conteúdo detectado (projetos, caches, SDKs, modelos de IA, etc.).
- 💡 **Recomendações** — motor de sugestões de otimização de espaço baseado nas entidades identificadas.
- 🕐 **Histórico de snapshots** — lista todas as varreduras anteriores com data e pasta raiz.
- 🗺️ **Visualização em treemap** — explora a ocupação do disco em formato de árvore expansível.
- 📊 **Comparação de snapshots** — compara duas varreduras e exibe a diferença de consumo por pasta.
- 📥 **Exportação de relatórios** — exporta dados do snapshot em JSON formatado.
- 📚 **Knowledge packs** — carrega regras de classificação externas para o módulo de entidades.

---

## 🏗️ Arquitetura

```
disk-mind/
├── src/                        # Frontend (React + TypeScript)
│   ├── App.tsx                 # Componente principal com interface de scan
│   ├── main.tsx                # Entry point React
│   ├── App.css                 # Estilos
│   └── components/
│       ├── TreemapView.tsx      # Visualização em treemap
│       ├── SnapshotCompareView.tsx # Comparação entre snapshots
│       └── KnowledgePackManager.tsx # Gerenciador de knowledge packs
│
├── src-tauri/                  # Backend (Rust + Tauri v2)
│   ├── src/
│   │   ├── lib.rs              # Configuração do app Tauri (states, handlers)
│   │   ├── scanner/            # Módulo de varredura de disco
│   │   │   ├── commands.rs     # Comandos IPC: start_scan, stop_scan
│   │   │   ├── walker.rs       # Recursão de diretórios (walkdir)
│   │   │   └── model.rs        # Structs: RawEntry, ScanStats, DirEntry
│   │   ├── db/                 # Módulo de banco de dados
│   │   │   ├── mod.rs          # Abertura de conexão e schema inicial
│   │   │   ├── migrations.rs   # Migrations SQL (WAL, tabelas, índices)
│   │   │   ├── indexer.rs      # Indexação hierárquica de snapshots
│   │   │   └── commands.rs     # Comandos IPC: open_db, list_snapshots, get_snapshot, compare_snapshots, export_snapshot_report
│   │   ├── classifier/         # Módulo de classificação de entidades
│   │   │   ├── commands.rs     # Comandos IPC: get_entities, load_knowledge_pack, list_knowledge_packs
│   │   │   ├── model.rs        # Struct Entity
│   │   │   ├── rules.rs        # Regras de classificação
│   │   │   └── loader.rs       # Loader de knowledge packs
│   │   └── advisor/            # Módulo de recomendações
│   │       ├── commands.rs     # Comando IPC: get_recommendations
│   │       ├── model.rs        # Struct Recommendation
│   │       └── knowledge.rs    # Base de conhecimento
│   ├── capabilities/
│   │   └── default.json        # Permissões do app (Tauri v2)
│   └── tauri.conf.json         # Configuração do app Tauri
│
└── packages/@bosguega/diskmind-types/   # Tipos TypeScript compartilhados
    └── src/index.ts            # Interfaces: RawEntry, ScanStats, Entity, Recommendation
```

---

## 🗃️ Schema do Banco de Dados

```sql
-- Cada varredura gera um snapshot
snapshots (id, created_at, root)

-- Estrutura hierárquica de diretórios
dirs (id, snapshot_id, parent_id, name, size, file_count, depth)

-- Arquivos indexados
files (id, snapshot_id, dir_id, name, ext, size, mtime, hash, symlink, hidden)
```

O banco SQLite é armazenado em:
- **Windows**: `%APPDATA%\diskmind\scans.db`
- **macOS/Linux**: `~/.local/share/diskmind/scans.db`

---

## 🚀 Como rodar

### Pré-requisitos

- [Rust](https://rustup.rs/) (toolchain estável)
- [Node.js](https://nodejs.org/) ≥ 18
- [pnpm](https://pnpm.io/) ≥ 8
- Dependências do Tauri para Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Instalação

```bash
# Na raiz do monorepo
pnpm install
```

### Desenvolvimento

```bash
cd apps/disk-mind
pnpm run dev
```

Isso irá:
1. Buildar o pacote de tipos `@bosguega/diskmind-types`
2. Iniciar o servidor Vite na porta `5173`
3. Compilar o backend Rust e abrir a janela desktop

### Build de produção

```bash
cd apps/disk-mind
pnpm run build
```

O instalador `.exe` (NSIS) será gerado em `src-tauri/target/release/bundle/`.

---

## 🔧 Dependências principais

### Backend (Rust)

| Crate | Uso |
|---|---|
| `tauri` v2 | Framework desktop e IPC |
| `rusqlite` | Banco de dados SQLite embarcado |
| `walkdir` | Recursão eficiente de diretórios |
| `tokio` | Runtime assíncrono |
| `rayon` | Paralelismo de dados |
| `serde` / `serde_json` | Serialização IPC |
| `chrono` | Timestamps dos snapshots |
| `uuid` | Identificadores únicos |
| `dirs` | Caminhos de dados do sistema |
| `windows-sys` | APIs nativas do Windows (FileSystem) |

### Frontend (TypeScript)

| Pacote | Uso |
|---|---|
| `@tauri-apps/api` v2 | Bridge IPC com o backend |
| `react` / `react-dom` | Interface gráfica |
| `vite` | Bundler e dev server |
| `typescript` | Tipagem estática |

---

## 📡 Comandos IPC disponíveis

| Comando | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `start_scan` | `path: string` | `ScanStats` | Inicia varredura e persiste snapshot |
| `stop_scan` | — | `void` | Interrompe varredura em andamento |
| `list_snapshots` | — | `Snapshot[]` | Lista todos os snapshots salvos |
| `get_snapshot` | `snapshotId: number` | `Snapshot` | Retorna detalhes de um snapshot |
| `get_snapshot_tree` | `snapshotId: number` | `DirNode[]` | Retorna árvore de diretórios para treemap |
| `get_entities` | `snapshotId: number` | `Entity[]` | Retorna entidades classificadas |
| `get_recommendations` | `snapshotId: number` | `Recommendation[]` | Retorna sugestões de otimização |
| `compare_snapshots` | `snapshotA, snapshotB: number` | `CompareItem[]` | Compara dois snapshots |
| `export_snapshot_report` | `snapshotId: number, path: string` | `void` | Exporta relatório JSON |
| `open_db` | `path: string` | `void` | Abre um banco de dados customizado |
| `load_knowledge_pack` | `name: string, rules: string[]` | `void` | Carrega um knowledge pack |
| `list_knowledge_packs` | — | `string[]` | Lista nomes dos packs carregados |

---

## 🗺️ Roadmap

- [x] Escaneamento de pastas com estatísticas (arquivos, pastas, tamanho)
- [x] Barra de progresso em tempo real via eventos Tauri
- [x] Histórico de snapshots
- [x] Classificação de entidades (projetos, caches, SDKs, modelos de IA)
- [x] Recomendações de otimização
- [x] Visualização em treemap da ocupação do disco
- [x] Comparação entre snapshots (diff de uso de espaço)
- [x] Exportação de relatórios JSON
- [x] Knowledge packs externos para o classificador
- [ ] Interface de busca e filtros avançados
- [ ] Suporte a múltiplos bancos de dados

---

## 📄 Licença

Privado — parte do monorepo `gaveta`.