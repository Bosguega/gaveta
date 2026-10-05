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
- **Busca enquanto digita:** a busca é disparada após 300 ms sem digitação, ou imediatamente pelo botão **Buscar** / <kbd>Ctrl</kbd> + <kbd>F</kbd>.
- **Filtros combináveis:** além da tag, filtre por período (últimos 7/30 dias, este mês, ano passado), notas fixadas, notas com lembrete e notas com/sem embedding válido. Todos os filtros são aplicados **antes** do ranqueamento, então a lista é preenchida com as melhores notas dentro do recorte escolhido. O botão **Limpar filtros** aparece quando há algum ativo.
- **Busca por período:** filtre "notas dos últimos 7 dias", "este mês" e "ano passado" por meio do seletor de período, calculado sobre `created_at` — sem interpretação de linguagem natural.
- **Resumos Automáticos:** Gere um resumo consolidado das notas exibidas com apenas um clique. O botão aparece sempre que há notas na lista, mesmo sem busca ativa.
- **Notas relacionadas:** Ao editar uma nota, o app mostra até 5 memórias semanticamente próximas (similaridade acima de 70%) logo abaixo do formulário. Clique em qualquer uma para abri-la.
- **Aviso de memórias duplicadas:** Ao salvar uma nota, se ela for praticamente igual a outras (similaridade acima de 95%), o app mostra um aviso com a lista para você comparar. **Nada é apagado ou substituído automaticamente** — a decisão é sempre sua.
- **Fallback Offline:** Se o servidor de embeddings estiver indisponível, o app usa busca textual direta (SQLite) e sinaliza o **Modo texto (fallback)** no cabeçalho.

### 💬 2. Conversar com suas Memórias (RAG Chat)
- Um assistente de IA que lê apenas as **suas** notas para responder perguntas, planejar ideias ou correlacionar informações antigas.
- **Fontes com 1 clique:** Cada resposta cita exatamente quais notas foram usadas como referência. O painel de debug permite inspecionar as notas recuperadas e as descartadas.
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
   Abra a aba **Configurações** no aplicativo. O app usa **dois processos `llama-server` independentes**, e o
   cartão **Configurar IA** abre o modal para configurá-los:

   ```bash
   # Chat (geração de texto) — porta 8080
   llama-server -m Ternary-Bonsai-2-27B-PQ2_0.gguf --port 8080 -ngl 99

   # Embeddings — porta 8081
   llama-server -m bge-m3.gguf --embedding --pooling cls --port 8081 -ngl 99
   ```

   Em seguida, no app, informe a URL e o modelo de cada servidor e use
   **Testar conexão** para validar.

   As configurações são persistidas em `memoria_auxiliar_config.json`, na pasta
   de dados do app, e podem ser alteradas a qualquer momento pela aba
   **Configurações**.

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
> reindexadas para voltarem a aparecer na busca semântica. Isso pode ser feito pelo
> botão **Reindexar notas**, na seção *Busca Semântica* das Configurações — ele
> regenera o vetor apenas das notas que estão sem embedding válido, mostra o
> progresso e nunca sobrescreve um vetor existente com um resultado vazio.

> ℹ️ Notas salvas enquanto o servidor de embeddings estava indisponível ficam sem
> vetor: a nota é preservada e aparece normalmente na lista, apenas não é
> encontrada pela busca semântica até ser reindexada.

---

## 🔎 Como a Busca Funciona

A busca é **semântica por padrão**, com fallback textual automático.

1. **Filtros** (tag, período, fixadas, lembrete, embedding) são aplicados às notas
   **antes** de qualquer ranqueamento — no caminho semântico e também no textual.
2. O texto digitado vira um embedding via `llama-server` (com cache por hash do
   texto e perfil do modelo).
3. A similaridade de **cosseno** é calculada contra o vetor de cada nota. Notas
   sem vetor ou com dimensão diferente da consulta são ignoradas.
4. O resultado só entra na lista se passar pelo **threshold de 0.45**. Para
   consultas com mais de 100 caracteres, o threshold cai para 0.35, já que
   perguntas longas tendem a diluir a similaridade.
5. Os resultados são ordenados por score e limitados aos **10 mais relevantes**.
   Na interface, cada nota exibe a similaridade em porcentagem.
6. Se o servidor de embeddings falhar, o app recorre à **busca textual** (até 20
   notas) e mostra o selo *Modo texto (fallback)*. Nesse caso não há
   similaridade calculada, então a porcentagem não é exibida.

Detalhes de comportamento:

- Cada busca recebe um token de sequência. Se você digitar rápido, respostas de
  buscas anteriores são descartadas e nunca substituem o resultado atual.
- Os filtros são aplicados **antes** do ranqueamento, de modo que as posições da
  lista são preenchidas por notas que satisfazem o recorte escolhido — e não por
  notas descartadas logo depois.
- Os filtros também valem para a lista exibida quando **não há busca ativa**: a
  aba de pesquisa respeita o mesmo recorte.
- O **Gerar resumo com IA** resume exatamente as notas exibidas na lista
  (resultados da busca ou todas as notas, quando não há busca ativa). O conteúdo
  é sanitizado antes de ir para o modelo.
- O seletor de período usa `created_at`. Para "ano passado", o limite superior é o
  início do ano corrente.

### Notas relacionadas e duplicadas

Ambas reaproveitam a mesma busca por similaridade, sem criar um segundo sistema de
embeddings:

- **Relacionadas** — ao editar uma nota, o próprio embedding dela vira a consulta e
  as demais notas são ranqueadas com threshold **0.7** (até 5). Como aqui a
  "consulta" é a própria nota e não uma pergunta, o ajuste de threshold para
  textos longos é desativado.
- **Duplicadas** — ao salvar, as outras notas são comparadas com threshold **0.95**,
  bem mais exigente, porque a intenção é afirmar igualdade e não apenas sugerir
  semelhança. Sem embedding disponível, a verificação recorre à comparação de
  conteúdo idêntico já normalizado (espaços colapsados, sem diferenciar
  maiúsculas de minúsculas).

A detecção é **estritamente de leitura**: nenhuma nota é apagada, alterada ou
substituída. O app apenas informa e deixa a escolha com o usuário.

No **Chat**, a recuperação usa o mesmo pipeline. As notas usadas na resposta são
identificadas pelo modelo, que retorna os IDs em uma linha `USED_IDS: [...]`; a
interface destaca essas fontes e permite abrir o painel de debug. Quando o
fallback textual é usado no chat, as fontes aparecem como **Busca textual**, sem
porcentagem — nenhuma similaridade foi calculada nesse caso.

---

## 🌐 Consulta à web (adicional, sob demanda)

A web é uma **capacidade adicional**, nunca o padrão. A busca por notas e o RAG
continuam respondendo tudo; a web só entra quando o usuário pede de forma
explícita.

### Quando a web é liberada

`isWebSearchRequested()` (`src/utils/webIntent.ts`) decide de forma determinística,
sem outro LLM. Exige **dois** elementos: um verbo de consulta (*pesquise*,
*busque*, *consulte*, *procure*, *verifique*...) **e** uma fonte externa (*web*,
*internet*, *online*) próximos um do outro.

| Pergunta | Web |
| :--- | :---: |
| "Pesquise na web sobre PGlite" | ✅ |
| "Com base nessas notas, pesquise na internet se isso ainda é válido" | ✅ |
| "O que minhas notas dizem sobre PGlite?" | ❌ |
| "Qual é o preço atual do produto X?" | ❌ |

A regra é conservadora por opção: na dúvida, **não** libera. Frases como "qual o
preço atual?" não pedem consulta externa e continuam respondendo só com as notas.

### Limites de segurança

Três controles independentes:

1. **Escopo das ferramentas.** Só duas tools chegam ao modelo: `tavily_tavily_search`
   e `tavily_tavily_extract`. As demais que o servidor MCP anuncia (`map`, `crawl`,
   `research`) são descartadas em `restrictToolDefinitions()`
   (`src/services/toolRestrictions.ts`).
2. **Schema restrito.** As definições vêm do servidor via `listTools()` e são
   reduzidas antes de irem ao modelo. Na busca web ficam apenas `query`
   (obrigatório), `max_results` (máximo **3**), `time_range` e `search_depth`.
   Parâmetros como `include_raw_content` — que podem devolver dezenas de milhares
   de caracteres — ficam inacessíveis.
3. **Teto de caracteres.** Como o `llama-server` **não valida** os argumentos
   recebidos contra o schema, cada resultado é cortado em **8.000 caracteres**
   antes de entrar no histórico, com marcação de truncamento. Não há resumo por
   LLM nem chamada adicional.

### Pesquisa com economia

O prompt do caminho web (`WEB_SYSTEM_PROMPT`, em `toolChat.ts`) instrui o modelo a
fazer poucas consultas, bem direcionadas, a não repetir buscas sobre temas já
cobertos e a responder assim que tiver informação suficiente. É orientação, não
número fixo de consultas.

Sem isso, perguntas amplas (*"um panorama completo de…"*) faziam o Bonsai pesquisar
até o limite de rodadas. Medido no Bonsai 2 com `-c 32768`, 10 notas e Tavily:

| | Rodadas | Buscas | Tempo |
| :--- | ---: | ---: | ---: |
| Antes das regras | 5 (limite) | 7 | 211 s |
| Depois das regras | 4 / 4 | 5 / 4 | 154 s / 150 s |

A qualidade da resposta foi preservada: as respostas continuam estruturadas e
citam fontes, com uma rodada de folga sob `MAX_TOOL_ROUNDS` (5).

### Contexto do llama-server

O servidor de chat roda com `-c 32768`. Com 10 notas de 5.000 caracteres
(máximo que o app permite) somadas às tools e aos resultados web, o pior caso
medido chegou a **20.962 tokens** — folga confortável, sem erro de contexto.
Aumentar esse teto não tem custo de latência perceptível: o contexto maior só é
"pago" quando é usado.

### Como o fluxo funciona

```text
askAI → RAG (notas recuperadas) → answerQuestion
  ├─ isWebSearchRequested = false → generateAnswer(pergunta, notas)   [caminho normal]
  └─ isWebSearchRequested = true  → listTools() → schema restrito
                                    → chat({ messages, tools })
                                    → callTool() → resultado limitado
                                    → role: "tool" → chat() até responder
```

O RAG roda **antes** e é comum aos dois caminhos: com ou sem web, o modelo recebe
as mesmas notas no formato `[MEMORY_ID: N]`. O caminho com web devolve os
`USED_IDS` da resposta final, então o painel de fontes e o debug continuam
funcionando — uma resposta que usou só a web simplesmente tem `usedIds` vazio.

### Configuração do MCP

O `llama-server` só expõe `/tools` quando é iniciado com
`--mcp-servers-config`; sem isso ele responde **HTTP 403** e a consulta à web
falha. Para não depender de configuração manual, o app cuida disso sozinho:

- o backend cria `mcp.json` na **própria pasta de dados**, ao lado do
  `config.json` e do banco (Tavily em modo keyless: `search` e `extract`
  funcionam sem API key);
- o botão **Iniciar** acrescenta `--mcp-servers-config` ao comando do servidor de
  chat na hora de subir o processo. O comando editável continua limpo — o caminho
  absoluto não fica gravado na configuração.

Basta reiniciar o servidor uma vez para a mudança valer.

> ℹ️ Se o `llama-server` for iniciado fora do Tauri, não terá MCP. Nesse caso o
> app mostra: *"A consulta à web está indisponível porque o servidor do Bonsai foi
> iniciado sem suporte a MCP."*

> ℹ️ Mesmo sem tools autorizadas, se o modelo emitir `tool_calls` por conta própria,
> elas **não são executadas**: a rodada encerra e a resposta segue como está.

---

## 📊 Métricas das respostas

Cada resposta do assistente traz um rodapé discreto:

```text
⚡ 11,8 tok/s · 305 tokens · 69,2 s   ▸
```

Clicando na setinha, um painel mostra o resto: tokens de entrada, de saída e
totais, tempo de geração, tempo total, notas usadas pelo RAG e chamadas de
ferramenta.

- Tokens e tempos vêm do próprio `llama.cpp` (`usage` e `timings` na resposta) —
  nada é estimado.
- O **tempo total** é medido no cliente, incluindo rede e, quando há consulta à
  web, todas as rodadas de ferramentas.
- **TTFT não é exibido**: o app não usa streaming, então o primeiro token chega
  junto com a resposta completa — o valor real seria idêntico ao tempo total, e
  repetir o número seria enganoso.
- Conversas antigas, salvas antes desta camada, não têm métricas e continuam
  funcionando normalmente — o rodapé simplesmente não aparece.

---

## 🪟 Modais

Os modais fecham **apenas pelo botão de fechar**, nunca por clique fora — evita
perder o que se está configurando. A captura rápida também fecha pelo `Esc`, por
ser acionada por atalho global.

---

- `src/services/tauriStore.ts`: persistência de configuração e perfil dos dois servidores, e o arquivo MCP.
- `src/services/llmService.ts`: chat, RAG, sanitização de prompt, parsing de `USED_IDS` e métricas.
- `src/services/embeddingService.ts`: geração de embeddings, cache por hash e resolução da chave de cache.
- `src/services/embeddingProfile.ts`: perfil, chave de cache, normalização L2.
- `src/services/similarityService.ts`: similaridade de cosseno, busca semântica e `hasValidEmbedding`.
- `src/services/reindexService.ts`: seleção e reindexação de notas sem embedding válido.
- `src/services/relatedNotesService.ts`: notas relacionadas e detecção de quase duplicatas.
- `src/services/embeddingConnection.ts`: teste de conexão do servidor de embeddings.
- `src/services/llamaServerControl.ts`: inicialização e verificação dos servidores locais.
- `src/services/llamaServerStatus.ts`: estados e validação dos comandos.
- `src/services/toolChat.ts`: loop de tool calling e o prompt do caminho web.
- `src/services/toolRestrictions.ts`: escopo e schema das tools, e o limite de caracteres do resultado.
- `src/utils/webIntent.ts`: detecta o pedido explícito de consulta à web.
- `src/utils/searchFilters.ts`: filtros combináveis (tag, período, fixadas, lembrete, embedding).
- `src/utils/tagFilter.ts`: comparação de tags usada pelos filtros.
- `src/utils/latestRequest.ts`: guarda de sequência para descartar respostas obsoletas.
- `src/components/SearchBox.vue`: campo de busca (debounce), botão Buscar, tags e filtros.
- `src/components/ResultsList.vue`: lista de resultados e botão de resumo.
- `src/components/ChatPanel.vue`: chat, fontes da resposta e painel de debug.
- `src/components/AiConfigModal.vue`: modal de configuração dos servidores locais, aberto a partir das Configurações.
- `src/views/SettingsView.vue`: configurações, reindexação e exportação/importação.

### Testes

Os testes rodam com **Vitest** e cobrem as partes com lógica: similaridade,
reindexação, filtros de busca, notas relacionadas e duplicatas, sanitização de
prompt, controle dos servidores, a guarda de requisições, o fluxo de tool
calling (intenção de uso da web, escopo e schema das tools, limite de resultado,
passagem do contexto RAG) e as métricas. Execute com:

```bash
npm test
```

O cliente HTTP de `llama-server` vem do package compartilhado
[`@bosguega/llama-cpp`](../../packages/llama-cpp), que expõe `health()`,
`chat()`, `embed()`, `listModels()`, `listTools()` e `callTool()`.
