# 🧠 Memória Auxiliar

> **Sua segunda mente potencializada por Inteligência Artificial.**  
> Capture pensamentos, códigos, links e lembretes instantaneamente e recupere o que você precisa pelo **significado**, não apenas por palavras exatas.

---

## ✨ O que é o Memória Auxiliar?

O **Memória Auxiliar** é um aplicativo desktop rápido, leve e focado em privacidade, projetado para ser o seu repositório definitivo de ideias, tarefas e conhecimentos do dia a dia. 

Diferente de blocos de notas tradicionais, ele utiliza **busca semântica com IA**: você pode perguntar sobre um assunto em linguagem natural e o aplicativo encontrará exatamente a memória certa, mesmo que você tenha usado palavras diferentes ao anotar.

---

## 🚀 Principais Recursos

### 🔍 1. Busca Semântica Inteligente
- **Encontre pelo sentido:** Pesquise por *"como configurar o banco de dados"* e encontre notas sobre *"credenciais do postgresql"*.
- **Filtro por Tags:** Digite `#` ou clique nas tags para filtrar assuntos específicos em um instante.
- **Resumos Automáticos:** Gere um resumo consolidado de várias notas com apenas um clique.
- **Fallback Offline:** Funciona mesmo sem conexão com a internet através da busca textual direta.

### 💬 2. Conversar com suas Memórias (RAG Chat)
- Um assistente de IA que lê apenas as **suas** notas para responder perguntas, planejar ideias ou correlacionar informações antigas.
- **Fontes com 1 clique:** Cada resposta cita exatamente quais notas foram usadas como referência.
- **Histórico de conversas:** Salve e continue conversas anteriores a qualquer momento.

### ⚡ 3. Captura Rápida (Estilo Spotlight / Raycast)
- Pressione **`Ctrl + Espaço`** (ou `Alt + N`) em qualquer lugar do app para abrir a janela de captura rápida.
- Digite sua ideia, adicione tags e salve com **`Ctrl + Enter`** sem perder seu fluxo de trabalho.

### 📋 4. Colar Inteligente (Auto-Detect)
- Com o botão **"📋 Colar Inteligente"**, o app identifica automaticamente o que você copiou:
  - **Trechos de código:** Formata em bloco de código markdown com tag `#codigo`.
  - **Links e URLs:** Transforma em links clicáveis com tag `#link`.
  - **Caminhos de pastas/arquivos:** Destaca caminhos do Windows (`C:\...`).

### 🕸️ 5. Grafo de Conexões (Knowledge Graph)
- Visualize todas as suas ideias em um **mapa interativo de nós 2D**.
- Linhas conectam automaticamente notas com **temas parecidos** ou **mesmas tags**.
- Arraste, aproxime (zoom) e dê um clique duplo em qualquer nó para abrir e editar a memória.

### ⏰ 6. Lembretes & Notificações Desktop
- Agende datas e horas para suas notas com atalhos como *Hoje 18h*, *Amanhã 09h* ou *Em 3 dias*.
- Receba **notificações nativas do Windows** e alertas visuais quando o horário chegar.

### 🌓 7. Temas Personalizados
Escolha a paleta visual que combina com seu estilo nas Configurações:
- 🌌 **Midnight Dark** (Azul escuro clássico)
- ⬛ **Pure OLED** (Preto 100% para foco máximo e economia de energia)
- 👾 **Cyberpunk Neon** (Roxo neon & Ciano vibrante)
- 🌲 **Matrix Emerald** (Verde floresta & Grafite)
- ☀️ **Clean Light** (Modo claro minimalista e suave)

### 🔒 8. Privacidade & Seus Dados em Primeiro Lugar
- **100% Local:** Suas notas são salvas em um banco de dados local SQLite no seu próprio computador.
- **Exportação & Importação:** Faça backup de todas as suas notas em formato JSON ou transfira para outro computador facilmente.

---

## ⌨️ Atalhos de Teclado Úteis

| Atalho | Ação |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Espaço</kbd> | Abrir Captura Rápida flutuante |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Focar na barra de busca |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Salvar nota no formulário |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> | Ir para Pesquisa |
| <kbd>Ctrl</kbd> + <kbd>2</kbd> | Ir para Nova Nota |
| <kbd>Ctrl</kbd> + <kbd>3</kbd> | Ir para Chat com IA |
| <kbd>Ctrl</kbd> + <kbd>4</kbd> | Ir para Insights & Grafo |
| <kbd>Ctrl</kbd> + <kbd>5</kbd> | Ir para Configurações |
| <kbd>Esc</kbd> | Fechar modal ou cancelar edição |

---

## 📦 Como Iniciar

1. **Instale as dependências:**
   ```bash
   pnpm install
   ```

2. **Inicie o aplicativo em modo desktop:**
   ```bash
   npm run tauri:dev
   ```

3. **Configure sua IA:**
   Abra a aba **⚙️ Config** no aplicativo. O app usa **dois processos `llama-server` independentes**:

   ```bash
   # Chat (geração de texto) — porta 8080
   llama-server -m Ternary-Bonsai-2-27B-PQ2_0.gguf --port 8080 -ngl 99

   # Embeddings — porta 8081
   llama-server -m bge-m3.gguf --embedding --pooling cls --port 8081 -ngl 99
   ```

   Em seguida, no app, informe a URL e o modelo de cada servidor e use
   **Testar conexão** para validar.

   As configurações são persistidas em `memoria_auxiliar_config.json`, na pasta
   de dados do app, e podem ser alteradas a qualquer momento pela tela de Config.

---

## 🖥️ Servidores locais

Na tela de configuração, a seção **Servidores locais** permite iniciar os dois
`llama-server` direto pela interface, sem precisar abrir terminais.

Cada servidor tem:

* **comando de inicialização** — string editável, com o caminho do executável,
  do modelo e dos argumentos. É salva nas mesmas configurações do app;
* **URL configurada** e **status** atual;
* botões individuais de **Iniciar/Verificar** e **Parar**.

O botão **🚀 Iniciar servidores** verifica os dois e inicia apenas o que estiver
parado. Servidores que já respondem não são duplicados nem reiniciados.

**Status** — sempre determinado pela comunicação real com a URL, nunca apenas
pelo fato de o processo ter sido criado:

| Estado | Significado |
| :--- | :--- |
| Parado | Nenhum processo atendendo a URL |
| Iniciando... | Processo criado, aguardando o servidor carregar o modelo |
| Em execução | O servidor respondeu ao health check |
| Erro | Processo criado mas o servidor não respondeu, ou a configuração é incompatível |

**Processos e janelas** — cada servidor roda em processo e janela de console
próprios, com os logs visíveis. Isso é intencional: erros de modelo, VRAM ou
argumentos inválidos são muito mais fáceis de diagnosticar na janela do que em
uma área de logs dentro do app. O app não captura nem faz streaming dos logs.

**Propriedade do processo** — o botão **Parar** só aparece para servidores que o
próprio app iniciou. Um `llama-server` que já estava rodando é detectado e
aparece como *Em execução*, mas nunca é encerrado pelo app.

**Validação do BGE-M3** — para o servidor de embeddings, o health check não
basta: o app também gera um embedding e confere a dimensão. Se o modelo
configurado não tiver 1024 dimensões, o servidor é rejeitado com erro claro e
**nenhum dado existente é apagado ou alterado**.

---

## 🧠 Pipeline de embeddings

O app não usa provedores online (Gemini/OpenAI) nem Ollama. Toda a IA é local,
via `llama-server`:

| Papel | Servidor | Modelo | Dimensões |
| :--- | :--- | :--- | :--- |
| Chat / RAG | `http://127.0.0.1:8080` | `ternary-bonsai-2-27b` | — |
| Embeddings | `http://127.0.0.1:8081` | `bge-m3` | 1024 |

Os embeddings são **normalizados em L2** e identificados por um perfil lógico
(`bge-m3` / `1024` / `l2` / `v1`) gravado na tabela `embedding_profile`.

A chave do cache segue o formato:

```text
bge-m3:1024:l2:v1:<sha256 do texto>
```

Se o perfil mudar, o app limpa o cache e invalida os vetores das notas, para que
espaços vetoriais diferentes nunca sejam comparados entre si.

> ⚠️ Ao trocar de modelo de embeddings, as notas existentes precisam ser
> reindexadas (reeditadas ou recriadas) para voltarem a aparecer na busca semântica.

---

## 🧱 Estrutura

- `src/services/tauriStore.ts`: persistência de configuração e perfil dos dois servidores.
- `src/services/llmService.ts`: chat, RAG, sanitização de prompt e parsing de `USED_IDS`.
- `src/services/embeddingService.ts`: geração de embeddings e cache por hash.
- `src/services/embeddingProfile.ts`: perfil, chave de cache, normalização L2.
- `src/services/similarityService.ts`: similaridade de cosseno e busca semântica.
- `src/services/embeddingConnection.ts`: teste de conexão do servidor de embeddings.
- `src/services/llamaServerControl.ts`: inicialização e verificação dos servidores locais.
- `src/services/llamaServerStatus.ts`: estados e validação dos comandos.
- `src/components/AiConfigModal.vue`: modal de configuração dos servidores locais.

O cliente HTTP de `llama-server` vem do package compartilhado
[`@bosguega/llama-cpp`](../../packages/llama-cpp), que expõe `health()`,
`chat()`, `embed()` e `listModels()`.
