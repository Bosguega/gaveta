# My Mercado

**Organize suas compras, acompanhe os preços e descubra como seu dinheiro está sendo gasto.**

O My Mercado reúne suas notas fiscais e transforma as informações das compras em um histórico que você pode consultar. Com ele, fica mais fácil lembrar onde comprou, acompanhar a variação dos preços e planejar as próximas compras.

Acesse: **[mymercado.pages.dev](https://mymercado.pages.dev)**

## O que você pode fazer

### Registrar suas compras

Adicione notas fiscais de diferentes maneiras:

- Leia o QR Code da NFC-e usando a câmera.
- Fotografe o QR Code ou selecione uma imagem salva.
- Informe o link da consulta da nota.
- Envie o texto da nota para leitura.
- Digite as informações manualmente.

Depois da leitura, confira os dados e os produtos antes de salvar. Você pode corrigir informações para que o histórico fique organizado.

### Conferir descontos

Quando uma nota precisa de conferência de descontos, você pode enviar uma foto para a leitura assistida por inteligência artificial. O sistema sugere os preços efetivamente pagos e você revisa as sugestões antes de aplicá-las.

A IA é um recurso auxiliar: confira os valores identificados e ajuste o que for necessário.

### Consultar o histórico e acompanhar preços

As notas registradas formam seu histórico de compras. Nele, você pode:

- Consultar compras anteriores.
- Pesquisar produtos e filtrar informações.
- Acompanhar a evolução dos preços registrados.
- Comparar os valores encontrados em diferentes estabelecimentos.
- Consultar gráficos e análises para entender melhor seus gastos.

As comparações usam os registros disponíveis no seu próprio histórico. Portanto, quanto mais compras você registrar, mais útil será essa visão.

### Organizar listas de compras

Crie listas para planejar o que precisa comprar. Você também pode aproveitar informações do histórico de preços, compartilhar uma lista por link e, se desejar, ativar a sincronização das listas com a nuvem nas configurações.

### Manter os nomes organizados

O My Mercado possui recursos para organizar os nomes de produtos e estabelecimentos. Isso ajuda a reconhecer o mesmo produto mesmo quando ele aparece escrito de formas diferentes nas notas.

## Como importar uma nota pela extensão NFC-e

Para consultar o conteúdo de uma NFC-e diretamente na página da SEFAZ/SP, o My Mercado pode trabalhar com a extensão de navegador.

1. No My Mercado, escolha a opção de importar pelo link.
2. Informe o link do QR Code da nota.
3. Quando solicitado, permita que a extensão abra a consulta.
4. A extensão acessa a página da SEFAZ/SP e envia o conteúdo encontrado de volta ao aplicativo.
5. Confira os dados importados antes de salvar.

### Instalar a extensão no Brave ou Chrome

A extensão é carregada manualmente a partir dos arquivos do projeto:

1. Baixe ou atualize este repositório no computador.
2. Abra `brave://extensions` no Brave ou `chrome://extensions` no Chrome.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta `apps/my_mercado_extension`.

Se atualizar os arquivos da extensão, volte à página de extensões e clique em **Recarregar**.

A extensão é destinada a navegadores compatíveis com extensões do Chrome em computadores. No celular, ou se a extensão não estiver disponível, você ainda pode usar os outros métodos de importação oferecidos pelo aplicativo.

> A consulta depende da disponibilidade da página da SEFAZ/SP. Se ela estiver temporariamente indisponível ou bloquear o acesso, tente novamente mais tarde ou utilize outra forma de importar a nota.

## Instalar o My Mercado como aplicativo

O My Mercado é um aplicativo web que também pode ser instalado pelo navegador (PWA).

- **No computador:** use a opção de instalação exibida pelo navegador, quando disponível.
- **No celular:** abra o endereço do My Mercado no navegador e escolha **Adicionar à tela inicial** ou **Instalar aplicativo**, conforme o navegador.

Depois de instalado, você poderá abrir o My Mercado pelo ícone na tela inicial ou na lista de aplicativos. A instalação não transforma o serviço em um aplicativo totalmente independente: alguns recursos dependem de conexão com a internet.

## Seus dados e sua privacidade

É importante entender onde cada informação é guardada:

- **Notas fiscais e histórico de compras:** ficam no banco de dados online do aplicativo, associados à sua conta.
- **Listas de compras:** ficam armazenadas no navegador/dispositivo por padrão. Você pode ativar a sincronização com a nuvem nas configurações.
- **Backups:** você pode exportar seus dados para guardar uma cópia. O arquivo baixado fica sob seus cuidados.

O acesso às notas é associado à conta autenticada. Não compartilhe sua senha nem arquivos de backup com pessoas em quem não confia.

### Backup e exportação

Nas opções de backup, você pode exportar os dados para arquivos, incluindo backup em JSON e exportação de itens em CSV. O JSON também pode ser utilizado para restaurar dados por meio da opção de importação disponível no aplicativo.

Recomendamos guardar cópias de segurança em um local confiável, especialmente antes de operações de manutenção ou limpeza dos dados.

## Inteligência artificial

Algumas funções podem utilizar inteligência artificial para ajudar a interpretar textos e imagens de notas fiscais e sugerir informações, como preços pagos. A disponibilidade dessas funções depende da configuração de IA escolhida no aplicativo.

As sugestões automáticas devem ser conferidas antes de serem salvas. A IA ajuda no preenchimento, mas não substitui a revisão dos dados da nota.

## Para desenvolvedores

O My Mercado faz parte do monorepo [Bosguega/gaveta](https://github.com/Bosguega/gaveta).

**Principais tecnologias:**
- React, TypeScript e Vite.
- Supabase para autenticação e armazenamento online.
- Zustand e TanStack Query para gerenciamento de estado e dados.
- Tailwind CSS para interface.
- Vite PWA para instalação pelo navegador.

### Executar localmente

É necessário ter Node.js e pnpm instalados.

1. Clone o repositório e entre na pasta raiz.
2. Instale as dependências:

   ```bash
   pnpm install
   ```

3. Crie o arquivo `apps/my_mercado/.env` a partir de `apps/my_mercado/.env.example` e configure as credenciais do Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. Configure o projeto Supabase e aplique as migrations disponíveis em `supabase/migrations`.
5. Inicie o aplicativo:

   ```bash
   pnpm --filter my_mercado dev
   ```

Para verificar o projeto, os comandos abaixo podem ser executados na pasta `apps/my_mercado`:

```bash
pnpm typecheck
pnpm lint
pnpm test:run
```

Na raiz do monorepo também está disponível:

```bash
pnpm ci:local
```

## Ajuda e sugestões

Encontrou um problema ou tem uma sugestão? Abra uma solicitação em [GitHub Issues](https://github.com/Bosguega/gaveta/issues).

---

**My Mercado — suas compras organizadas, suas escolhas mais conscientes.**
