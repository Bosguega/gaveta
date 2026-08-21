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
   Abra a aba **⚙️ Config** no aplicativo e insira sua chave da API ou conecte ao seu provedor local (Ollama).
