# 🛒 My Mercado - Suas Compras Organizadas

O **My Mercado** é seu assistente pessoal para compras de supermercado. Escaneie notas fiscais, acompanhe preços e economize dinheiro!

---

## 🎯 O Que Você Pode Fazer

### 📸 Escanear Notas Fiscais
- Aponte a câmera para o QR Code da nota
- Ou faça upload de uma foto
- Os dados são extraídos automaticamente

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

### 1. Instale o App
```bash
npm install
```

### 2. Configure o Banco
- Crie uma conta no [Supabase](https://supabase.com/)
- Execute o script `supabase_schema.sql` no painel do Supabase
- Configure as variáveis de ambiente (veja `.env.example`)

### 3. Execute
```bash
npm run dev
```

### 4. Use no Celular
- Acesse o app no navegador do celular
- Adicione à tela inicial (PWA)
- Pronto! Use como um app nativo

---

## 📱 Funcionalidades Principais

| Funcionalidade | Descrição |
|----------------|-----------|
| **Scanner** | Escaneie QR Code de NFC-e com a câmera |
| **Histórico** | Veja todas as suas compras organizadas |
| **Busca** | Encontre produtos e compare preços |
| **Dicionário** | Gerencie categorias e normalização |
| **Produtos** | Agrupe produtos similares |
| **Backup** | Exporte e importe seus dados |

---

## 🎨 Interface

- **Design Moderno**: Glassmorphism e animações suaves
- **Mobile-First**: Otimizado para celular
- **PWA**: Instale como app nativo
- **Offline**: Funciona sem internet (com cache)

---

## 🔒 Segurança

- **Seus dados são privados**: Cada usuário vê apenas suas notas
- **Autenticação segura**: Login via Supabase Auth
- **Backup local**: Seus dados ficam no seu dispositivo

---

## 📖 Documentação Técnica

Para desenvolvedores e contribuidores, consulte:
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Arquitetura detalhada do projeto

---

## 🛠️ Tecnologias

- **Frontend**: React, TypeScript, Vite
- **Banco**: Supabase (PostgreSQL)
- **Cache**: React Query
- **Estado**: Zustand
- **UI**: Framer Motion, Recharts, Lucide Icons

---

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/Bosguega/my_mercado/issues)
- **Documentação**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 📄 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

---

**Feito com ❤️ para ajudar você a economizar nas compras!**