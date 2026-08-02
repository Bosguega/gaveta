# ComfyUI Scanner

Aplicativo desktop para escanear e catalogar instalações do ComfyUI, listando modelos, custom nodes, workflows e outros arquivos.

## Funcionalidades

- **Scan automático de diretórios**: Detecta instalações do ComfyUI e escaneia automaticamente
- **Categorização inteligente**: Classifica itens em categorias como Checkpoints, LoRAs, VAE, ControlNet, etc.
- **Caminhos comuns**: Sugere locais típicos de instalação no Windows
- **Exportação de resultados**: Exporta relatórios em JSON ou CSV
- **Interface intuitiva**: Visualização limpa e organizada dos itens encontrados

## Estrutura do Projeto

```
apps/comfyui-scanner/
├── src/
│   ├── components/          # Componentes Vue reutilizáveis
│   │   ├── ScanControls.vue     # Controles de seleção e scan
│   │   └── ResultsList.vue      # Lista de resultados agrupados
│   ├── composables/         # Composables Vue (lógica reutilizável)
│   │   └── useComfyUIScan.ts
│   ├── services/           # Serviços de comunicação com backend
│   │   └── scanner.ts
│   ├── types/              # Definições TypeScript
│   │   └── index.ts
│   ├── views/              # Views principais
│   │   └── ScanView.vue
│   ├── App.vue
│   ├── main.ts
│   └── styles.css
├── src-tauri/
│   ├── src/
│   │   ├── commands/       # Comandos Tauri (Rust)
│   │   │   ├── mod.rs
│   │   │   └── fs_commands.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Categorias Detectadas

O scanner identifica e organiza os seguintes tipos de itens:

- **Modelos de IA**: Checkpoints, LoRAs, VAE, Upscale Models, Embeddings, ControlNet, CLIP
- **Custom Nodes**: Nós customizados do ComfyUI
- **Workflows**: Arquivos de workflow (.json, .png)
- **Imagens**: Input e Output images
- **Outros**: Arquivos não categorizados

## Desenvolvimento

### Pré-requisitos

- Node.js >= 18
- pnpm >= 8
- Rust >= 1.70
- Tauri CLI

### Instalação

```bash
# Instalar dependências
pnpm install

# Rodar em desenvolvimento
pnpm tauri:dev

# Build para produção
pnpm tauri:build
```

### Scripts Disponíveis

- `pnpm dev` - Inicia servidor de desenvolvimento Vite
- `pnpm build` - Build do frontend
- `pnpm tauri:dev` - Inicia app Tauri em modo desenvolvimento
- `pnpm tauri:build` - Gera executável para produção

## Tecnologias

- **Frontend**: Vue 3 + TypeScript + Vite
- **Backend**: Rust + Tauri 2.0
- **Scan de arquivos**: walkdir (Rust)
- **Interface**: HTML/CSS com design responsivo

## Como Usar

1. **Selecione o diretório**: Escolha a pasta onde o ComfyUI está instalado
2. **Clique em "Iniciar Scan"**: O app escaneará todos os arquivos relevantes
3. **Visualize os resultados**: Navegue pelas categorias e itens encontrados
4. **Exporte**: Salve o relatório em JSON ou CSV para referência futura

## Compatibilidade

- Windows 10/11
- Testado com instalações padrão do ComfyUI
- Suporta instalações portáteis e com Python virtual environment

## Licença

MIT