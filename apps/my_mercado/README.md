# 🛒 My Mercado - Suas Compras Organizadas

O **My Mercado** é seu assistente pessoal para compras de supermercado. Escaneie notas fiscais, acompanhe preços e economize dinheiro!

---

## 🎯 O Que Você Pode Fazer

### 📸 Escanear Notas Fiscais
- Aponte a câmera para o QR Code da nota
- Ou fotografe a nota para extração por IA
- Ou cole o texto / digite manualmente
- Os dados são extraídos automaticamente

### 🏷️ Conferir Descontos
- Notas com desconto mostram um indicador pendente
- Fotografe a nota e a IA sugere o preço pago por item
- Você revisa e confirma antes de aplicar

### 📊 Acompanhar Seus Gastos
- Veja todo o histórico de compras
- Filtre por período, mercado ou produto
- Compare preços ao longo do tempo

### 🔍 Buscar Preços
- Pesquise produtos específicos
- Veja gráficos de tendência de preços
- Descubra onde comprar mais barato

### 📚 Gerenciar Produtos
- Organize produtos em categorias
- Crie produtos canônicos para agrupar variações
- Mantenha seu dicionário de produtos

### 💾 Backup e Exportação
- Exporte dados para CSV
- Faça backup completo em JSON
- Seus dados estão sempre seguros

---

## 🚀 Como Começar

### 1. Instale as Dependências

Na raiz do monorepo:

```bash
pnpm install
```

### 2. Configure o Banco
- Crie uma conta no [Supabase](https://supabase.com/)
- Aplique as migrations em `supabase/migrations` (na raiz do monorepo) no painel do Supabase
- Configure as variáveis de ambiente (veja `.env.example`)

### 3. Execute

Na raiz do monorepo (compila o pacote interno `ai-core`, do qual o app depende):

```bash
pnpm dev
```

### 4. Use no Celular
- Acesse o app no navegador do celular
- Adicione à tela inicial (PWA)
- Pronto! Use como um app nativo

---

## 📱 Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Scanner** | Escaneie QR Code de NFC-e com a câmera, fotografe a nota (IA), cole o texto ou digite manualmente |
| **Descontos** | Confira descontos pendentes fotografando a nota; a IA sugere o preço pago para revisão |
| **Histórico** | Veja todas as suas compras organizadas |
| **Busca** | Encontre produtos e compare preços |
| **Dicionário** | Gerencie categorias e normalização |
| **Listas de compras** | Crie listas, compartilhe por link e acompanhe o histórico de preços |
| **Backup** | Exporte e importe seus dados |

---

## 🎨 Interface

- **Design Moderno**: Glassmorphism e animações suaves
- **Mobile-First**: Otimizado para celular
- **PWA**: Instalável, com cache para melhor experiência

---

## 🔒 Segurança

- **Seus dados são privados**: Cada usuário vê apenas suas notas
- **Autenticação segura**: Login via Supabase Auth
- **Backup local**: Seus dados ficam no seu dispositivo

---

## 🛠️ Tecnologias

- **Frontend**: React, TypeScript, Vite
- **Banco**: Supabase (PostgreSQL)
- **Cache**: React Query
- **Estado**: Zustand
- **UI**: Tailwind CSS, Recharts, Lucide Icons
- **PWA**: vite-plugin-pwa (instalável e com cache offline)

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/Bosguega/gaveta/issues)

---

## ✅ Verificações

Dentro de `apps/my_mercado`:

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm test:run    # Vitest
```

Também disponível na raiz do monorepo:

```bash
pnpm ci:local
```

---

**Feito com ❤️ para ajudar você a economizar nas compras!**