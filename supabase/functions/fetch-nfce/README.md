# fetch-nfce — Edge Function modular

Estrutura refatorada da Edge Function `fetch-nfce` do Supabase.

## Arquivos

```
fetch-nfce/
├── index.ts           # Entrypoint, orquestra o fluxo
├── sefaz.ts           # Fetch SEFAZ com retry + timeout
├── validation.ts      # Valida URL da NFC-e
├── http.ts            # Headers HTTP e helper JSON
├── logger.ts          # Logs JSON estruturados
├── supabaseStore.ts   # Cache, rate limit e logs no Postgres
└── types.ts           # Tipos compartilhados
```

## Principais mudanças

- `redirect: "follow"` no fetch da SEFAZ (era `"manual"` e bloqueava redirects)
- Remoção do erro `REDIRECT_NOT_ALLOWED`
- Separação de responsabilidades em módulos menores
- Logs estruturados em JSON

## Implantação

1. Baixe todos os arquivos desta pasta
2. No painel do Supabase, vá em **Edge Functions** → **New function**
3. Nome: `fetch-nfce`
4. Cole o conteúdo de `index.ts` no editor
5. Anexe os demais arquivos como módulos importados (ou faça upload zip)
6. Configure as variáveis de ambiente:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Validação

A função rejeita URLs que não sejam:
- HTTPS
- Domínio `*.fazenda.sp.gov.br`
- Com parâmetro `p` ou `chNFe`

## Cache

- TTL: 24 horas
- Limpeza automática a cada 10 minutos (fire-and-forget)