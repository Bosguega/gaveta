# Arquitetura: Identidade Canônica de Produtos

Documento consolidado de arquitetura para o sistema de identidade de produtos,
histórico de compras, dicionário, compartilhamento de listas e fuzzy matching.

> [!IMPORTANT]
> Este documento substitui conclusões anteriores que apontavam para agrupamento
> semântico de produtos. A direção agora é **identidade canônica estrita**.

---

## 1. Princípio Fundamental: Identidade Canônica

O sistema **NÃO** agrupa produtos semanticamente parecidos.
O sistema agrupa **apenas produtos IGUAIS** escritos de formas diferentes na nota fiscal.

### Exemplos Corretos de Unificação

| Raw Name (nota fiscal)       | Identidade Canônica (`normalized_name`) |
|-----------------------------|-----------------------------------------|
| `ARROZ CAMIL TP1 1KG`      | Arroz Camil 1kg                         |
| `ARROZ CAMIL TIPO 1 1KG`   | Arroz Camil 1kg                         |
| `ARROZ CAMIL BRANCO 1KG`   | Arroz Camil 1kg                         |

### Exemplos Incorretos (NÃO devem ser agrupados)

| Produto A             | Produto B              | Motivo                 |
|-----------------------|------------------------|------------------------|
| Arroz Camil 1kg       | Arroz Camil 5kg        | Tamanhos diferentes    |
| Arroz Camil 1kg       | Arroz Integral Camil   | Tipos diferentes       |
| Arroz Camil 1kg       | Arroz Tio João 1kg     | Marcas diferentes      |

### O que muda conceitualmente

O campo `normalized_name` deixa de ser um mero "nome amigável" e passa a ser a
**Identidade Canônica do Produto** — a fonte primária da verdade do sistema.
Ele funciona como um "canonical product ID textual": se dois itens compartilham
o mesmo `normalized_name`, eles são **o mesmo produto**.

---

## 2. Papéis e Responsabilidades de Cada Camada

### 2.1 `normalized_key` — Chave de Deduplicação Bruta

- Gerada por `normalizeKey()` a partir do nome cru da nota
- Função: indexação no dicionário, detecção de duplicatas na lista
- **Papel atual**: é a chave primária de lookup em quase todo o sistema
- **Papel futuro**: permanece como chave de acesso ao dicionário, mas **não** como
  chave de agrupamento do histórico

**Arquivo**: [normalize.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/normalize.ts)

### 2.2 `normalized_name` — Identidade Canônica (fonte da verdade)

- Definida pelo dicionário (`product_dictionary`) ou pela IA no processamento
- Função: identidade real do produto para histórico, compartilhamento e exibição
- **Papel atual**: usado apenas para exibição e busca textual
- **Papel futuro**: passa a ser a **chave principal de agrupamento** do histórico

**Origens**: dicionário DB, resposta da IA, ou fallback para o nome bruto

### 2.3 `raw_name` (campo `name`) — Nome Bruto Original

- Vem direto do OCR/parser da nota fiscal
- **Nunca** deve ser perdido ou sobrescrito
- Serve para auditoria, rastreabilidade e debugging

**Estrutura obrigatória de dados**:
```json
{
  "name": "ARROZ CAMIL TP1 1KG",
  "normalized_key": "ARROZ CAMIL TP1 1KG",
  "normalized_name": "Arroz Camil 1kg"
}
```

### 2.4 Dicionário (`product_dictionary`) — Catálogo Canônico e Sistema de Aliases

O dicionário agora é a **camada de identidade do produto**. Ele atua como:
- **Catálogo canônico**: mapeia `normalized_key` → `normalized_name`
- **Sistema de aliases**: múltiplas `normalized_key` distintas podem apontar
  para o mesmo `normalized_name` canônico
- **Fonte de categorização**: associa categoria ao produto

**Arquivo**: [dictionaryService.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/services/dictionaryService.ts)

---

## 3. Histórico de Compras: Chave Estrita

### Situação Atual (Problemática)

O hook [usePurchaseHistory.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/usePurchaseHistory.ts#L90-L95)
agrupa o histórico pela `normalized_key` bruta:

```typescript
const name = toText(current.normalized_name || current.name).trim();
const key = normalizeKey(
  toText(current.normalized_key).trim() || name || toText(current.name),
);
```

Como `normalized_key` quase sempre existe (é a chave bruta do recibo), o
`normalized_name` é ignorado na hora de criar os grupos. Resultado: produtos
idênticos com grafias diferentes ficam em baldes separados.

### Nova Diretriz

O histórico deve usar **exclusivamente** o `normalized_name` como chave de
agrupamento. Se um produto não tiver `normalized_name`, usa-se o `name` bruto
como fallback (nunca a `normalized_key` bruta).

**Objetivos**:
- Previsibilidade: o usuário sabe exatamente o que esperar
- Consistência: o mesmo produto real sempre aparece junto
- Segurança: evita mistura de preços entre produtos diferentes

---

## 4. O Novo Papel do Fuzzy Match

### Antes (modelo antigo)

O fuzzy (`scoreHistoryKeyMatch`) era o **mecanismo principal de aproximação**.
Na lista de compras, ele buscava itens parecidos no histórico e exibia com a tag
"Aproximado". No compartilhamento, essa lógica não existia, causando inconsistência.

**Arquivo**: [shoppingHistoryMatch.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/shoppingHistoryMatch.ts)

### Agora (nova diretriz)

O fuzzy **NÃO**:
- Define identidade de produto
- Agrupa automaticamente
- Altera dados sem intervenção do usuário
- Recupera histórico na lista de compras

O fuzzy **SIM**:
- Detecta possíveis duplicatas no catálogo
- Sugere aliases para aprovação manual
- Auxilia na manutenção/limpeza do dicionário

### Requisitos para o fuzzy futuro

Quando usado como assistente de deduplicação, o algoritmo deve atribuir **pesos
altos** para atributos que diferenciam produtos:

| Atributo       | Impacto na similaridade                    |
|----------------|--------------------------------------------|
| Peso/Volume    | `1kg ≠ 5kg` → redução drástica             |
| Tipo           | `Integral ≠ Branco` → redução drástica     |
| Marca          | `Camil ≠ Tio João` → redução drástica      |
| Abreviação     | `TP1 ≈ TIPO 1` → alta similaridade         |

---

## 5. Pipeline de Extração de Notas

### Fluxo Correto e Resiliente

```
┌─────────────────┐
│  1. OCR/Parser  │  Leitura bruta da nota fiscal
└────────┬────────┘
         ▼
┌─────────────────────────────────┐
│  2. Persistência Imediata       │  NUNCA FALHA / NUNCA É BLOQUEADA
│  • receipt + receipt_items      │
│  • dicionário (upsert aliases) │
│  • histórico implícito          │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  3. Pós-processamento (async)   │  PODE FALHAR SEM CONSEQUÊNCIAS
│  • Fuzzy: detecta duplicatas    │
│  • Gera sugestões de aliases    │
└────────┬────────────────────────┘
         ▼
┌─────────────────────────────────┐
│  4. Revisão Manual (opcional)   │  DECISÃO EXPLÍCITA DO USUÁRIO
│  • Aceitar/rejeitar sugestões   │
│  • Unificar aliases             │
└─────────────────────────────────┘
```

> [!CAUTION]
> O fuzzy e os modais de revisão **nunca** devem bloquear o salvamento da nota.
> Mesmo se o fuzzy falhar, o modal falhar ou o usuário fechar o app, a nota
> já deve ter sido salva com os dados brutos + dicionário atualizado.

### Situação Atual do Pipeline

O pipeline em [productService.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/services/productService.ts)
já segue parcialmente esse modelo: faz lookup no dicionário, chama IA para itens
desconhecidos e persiste. Porém, a chamada de IA é **síncrona e bloqueante** — se
a IA falhar, o pipeline usa fallback (nome bruto), o que é correto. O ponto de
atenção é que a IA hoje gera o `normalized_name` como parte do pipeline principal,
não como pós-processamento.

---

## 6. Canonicalização: Função Central

### Necessidade

Como `normalized_name` agora é identidade, a canonicalização precisa ser:
- **Centralizada**: uma única função de referência
- **Determinística**: a mesma entrada gera sempre o mesmo resultado
- **Consistente**: regras claras e documentadas

### Proposta: `canonicalizeProductName()`

Função que deve tratar:
- Title Case padronizado
- Unidades normalizadas (kg, g, ml, L)
- Abreviações expandidas (TP1 → Tipo 1, LTA → Lata, INT → Integral)
- Espaços e separadores
- Remoção de lixo textual do OCR

> [!NOTE]
> Hoje essa responsabilidade está dividida entre a IA
> ([promptBuilder.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/ai/promptBuilder.ts))
> e a função `cleanAIName()` em [stringUtils.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/stringUtils.ts).
> Uma função centralizada garantiria consistência mesmo sem IA.

### Análise Futura: `canonical_key` separado do nome exibido

Hoje o `normalized_name` serve tanto como identidade quanto como nome exibido.
No futuro, pode fazer sentido separar os dois:

| Campo            | Papel                              | Exemplo              |
|------------------|------------------------------------|----------------------|
| `canonical_key`  | Identidade (comparação)            | `arroz camil 1kg`    |
| `display_name`   | Nome exibido ao usuário            | `Arroz Camil 1kg`    |

**Vantagens** de separar:
- Permite corrigir a exibição sem quebrar o histórico
- Case-insensitive por design na comparação
- Mais robusto contra inconsistências de formatação

**Riscos**:
- Mais um campo para manter sincronizado
- Complexidade adicional na migração

**Decisão**: NÃO implementar agora. Manter `normalized_name` como identidade+exibição.
Revisitar se problemas de consistência surgirem em produção.

---

## 7. Sugestão de UX: Revisão de Duplicatas

Quando novos itens entram no sistema, a interface pode sugerir:

> *"Novo item detectado: **ARROZ CAMIL TP1 1KG***
>
> *Parece similar a:*
> - *Arroz Camil 1kg (92%)*
>
> *Deseja reutilizar este nome?"*

**Regras fundamentais**:
- Apenas sugestão, nunca automático
- Nunca merge automático
- Nunca renomeação automática
- Decisão final é sempre explícita e manual

---

## 8. Tags da Lista de Compras: Revisão

### Situação Atual

As tags "Exato" e "Aproximado" na [ShoppingListItem.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListItem.tsx#L139-L150)
refletem o modelo antigo onde o fuzzy era protagonista:

```typescript
historyMatchType === "exact" ? "Exato" : "Aproximado"
```

### Por que não fazem mais sentido

No novo modelo, o histórico é **sempre exato** (baseado no `normalized_name`).
Não existe mais "aproximado" — ou o produto tem identidade canônica e histórico,
ou não tem.

### Novos Estados Propostos

| Estado        | Significado                                             | Cor sugerida |
|---------------|---------------------------------------------------------|--------------|
| **Verificado**| Produto com identidade canônica no dicionário           | Verde        |
| **Novo**      | Produto cru, sem mapeamento no dicionário               | Cinza        |
| **Sugestão**  | Fuzzy encontrou candidato similar pendente de aprovação  | Amarelo      |

---

## 9. Análise de Impacto Completa

### 9.1 Arquivos Impactados por Etapa

#### Etapa 1 — `normalized_name` como fonte da verdade

| Arquivo | Função/Trecho | Impacto |
|---------|---------------|---------|
| [usePurchaseHistory.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/usePurchaseHistory.ts#L90-L95) | Geração da `key` de agrupamento | **CRÍTICO** — Trocar `normalized_key` por `normalized_name` como chave primária |
| [ShoppingListTab/index.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListTab/index.tsx#L153-L177) | `getItemHistory()` | **CRÍTICO** — Remover busca fuzzy, usar apenas lookup exato por `normalized_name` |
| [ShareListModal.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/SharedListTab/ShareListModal.tsx#L71-L77) | `enrichItemsForPublish()` | **ALTO** — Trocar `itemsHistory[item.normalized_key]` por lookup via `normalized_name` |
| [useSearchChartData.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/useSearchChartData.ts#L39) | Agrupamento do gráfico | **MÉDIO** — Já usa `normalized_name \|\| name`, correto |

#### Etapa 2 — Reposicionar o Fuzzy

| Arquivo | Função | Impacto |
|---------|--------|---------|
| [shoppingHistoryMatch.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/shoppingHistoryMatch.ts) | `scoreHistoryKeyMatch()` | **ALTO** — Remover do fluxo de histórico da lista. Preservar para uso futuro em sugestões |
| [ShoppingListTab/index.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListTab/index.tsx#L16) | Import de `scoreHistoryKeyMatch` | **ALTO** — Remover import e uso no `getItemHistory` |

#### Etapa 3 — Sistema de revisão/sugestão

| Arquivo | Impacto |
|---------|---------|
| Novo componente de sugestão de duplicatas | A criar |
| [productService.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/services/productService.ts) | **MÉDIO** — Pode gerar sugestões fuzzy após pipeline |

#### Etapa 4 — Tags visuais

| Arquivo | Função | Impacto |
|---------|--------|---------|
| [ShoppingListItem.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListItem.tsx#L10) | Tipo `historyMatchType` | **MÉDIO** — Trocar `"exact" \| "approx" \| "none"` por novos estados |
| [ShoppingListTab/index.tsx](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListTab/index.tsx#L28) | Tipo `HistoryMatchType` | **MÉDIO** — Atualizar para novos estados |

### 9.2 Locais onde `normalized_key` ainda é fonte principal

| Local | Uso atual |
|-------|-----------|
| [usePurchaseHistory.ts:94](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/usePurchaseHistory.ts#L94) | Chave de agrupamento do histórico |
| [ShoppingListTab:155](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListTab/index.tsx#L155) | Lookup do histórico para cada item |
| [ShareListModal:76](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/SharedListTab/ShareListModal.tsx#L76) | Enriquecimento da nota no compartilhamento |
| [actions.ts:143](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/stores/shoppingListStore/actions.ts#L143) | Detecção de duplicata ao adicionar item (continua válido) |
| [actions.ts:267,305](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/stores/shoppingListStore/actions.ts#L267) | Detecção de duplicata ao mover/copiar item (continua válido) |
| [sharedListService.ts:66-72](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/services/sharedListService.ts#L66) | `normalizeKey` local para itens compartilhados |

### 9.3 Locais onde fuzzy ainda interfere na lógica principal

| Local | Uso |
|-------|-----|
| [ShoppingListTab:161-176](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListTab/index.tsx#L161) | Fallback fuzzy no `getItemHistory` — busca aproximada no histórico |
| [ShoppingListItem:139-150](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/components/ShoppingListItem.tsx#L139) | Renderização da tag "Exato"/"Aproximado" |

### 9.4 Dependências Indiretas e Riscos de Regressão

| Área | Risco | Severidade |
|------|-------|------------|
| **localStorage** (`@MyMercado:shopping-list`) | Itens da lista de compras usam `normalized_key` para deduplicação. Isso é **correto e deve ser mantido** — dedup local é diferente de agrupamento de histórico. | Baixo |
| **Cloud Sync** ([cloud.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/stores/shoppingListStore/cloud.ts)) | Snapshots carregam `normalized_key` dos itens. Compatível — não precisa mudar. | Baixo |
| **Supabase `collaborative_list_items`** | Tabela usa `normalized_key`. Compartilhamento local insere `normalized_key`. O enrichment usa `normalized_key` para lookup de histórico — **este é o ponto que precisa mudar**. | Alto |
| **Backup/Restore** ([backupSchema.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/utils/validation/backupSchema.ts)) | Schema valida `normalized_key` e `normalized_name` como opcionais. Compatível. | Baixo |
| **Search/Filtros** ([useFilteredSearchItems.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/useFilteredSearchItems.ts#L40)) | Busca textual já inclui `normalized_name`. Sem impacto. | Nenhum |
| **Gráfico de Preços** ([useSearchChartData.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/hooks/queries/useSearchChartData.ts#L39)) | Já agrupa por `normalized_name \|\| name`. Já correto. | Nenhum |

---

## 10. Estratégia de Migração

### 10.1 Itens sem `normalized_name`

**Cenário**: Receipts antigos onde `normalized_name` é `undefined` ou `null`.

**Estratégia de Fallback Gradual**:
```
Se normalized_name existe → usa normalized_name como chave canônica
Se não → usa name (nome bruto) como fallback temporário
Nunca usa normalized_key como fallback para identidade
```

Isso garante que:
- Histórico antigo não "desaparece" — aparece sob o nome bruto
- Conforme o dicionário é alimentado (pela IA ou manualmente), o histórico
  vai se consolidando naturalmente
- Nenhum dado é perdido ou corrompido

### 10.2 Backfill do Dicionário

Itens antigos sem `normalized_name` podem ser enriquecidos retroativamente:
1. **Automático via IA**: rodar o pipeline de normalização sobre itens órfãos
   e gerar sugestões (nunca aplicar automaticamente)
2. **Manual via DictionaryTab**: o usuário já pode editar entradas
3. **Bulk via `applyDictionaryEntryToSavedItems`**: a RPC que já existe para
   aplicar mudanças do dicionário aos itens salvos

### 10.3 Snapshots Compartilhados Existentes

Listas já publicadas em `collaborative_list_items` usam `normalized_key`.
Essas listas são **imutáveis após publicação** (delete + reinsert),
então não precisam de migração. A próxima vez que o dono atualizar a lista
compartilhada, os novos dados já virão com a estrutura correta.

### 10.4 Cache/localStorage

O store Zustand (`@MyMercado:shopping-list`) persiste no localStorage com
versão 3. Os itens da lista usam `normalized_key` para dedup. **Não precisa
de migração** — `normalized_key` continua válido para deduplicação dentro
da lista. O que muda é apenas como o histórico é consultado/exibido.

### 10.5 Detecção de Itens Órfãos/Inconsistentes

Critérios para detectar problemas:
- Items no DB com `normalized_name IS NULL` → candidatos a backfill
- Entradas do dicionário onde `normalized_name` é igual a `key` em uppercase
  → provavelmente não foram processados pela IA
- Múltiplas entradas do dicionário com `normalized_name` diferente mas
  `normalizeKey(normalized_name)` igual → inconsistência a resolver

---

## 11. Etapas de Implementação

### Etapa 1 — `normalized_name` como fonte da verdade

Transformar `normalized_name` na chave oficial de identidade para:
- **Histórico**: refatorar `usePurchaseHistory` — chave = `normalizeKey(normalized_name || name)`
- **Lookup na lista**: refatorar `getItemHistory` em `ShoppingListTab` — busca exata pelo `normalized_name`
- **Enriquecimento**: refatorar `enrichItemsForPublish` em `ShareListModal` — lookup por `normalized_name`
- **Compartilhamento**: garantir que `enrichNote` use a nova chave canônica

> [!WARNING]
> A lista de compras (`ShoppingListItem`) hoje **não possui** `normalized_name`.
> O tipo `ShoppingListItem` em [ui.ts](file:///c:/Trabalhos/gaveta/apps/my_mercado/src/types/ui.ts#L72-L82)
> só tem `normalized_key`. Para que o histórico funcione de forma estrita,
> será necessário que o item da lista carregue informação suficiente para
> fazer o lookup canônico (seja via `normalized_name` no item, seja via lookup
> no dicionário no momento da consulta).

### Etapa 2 — Reposicionar o Fuzzy

- Remover `scoreHistoryKeyMatch` da lógica de `getItemHistory` no `ShoppingListTab`
- Remover import de `shoppingHistoryMatch` do `ShoppingListTab`
- Preservar `shoppingHistoryMatch.ts` para uso futuro em sugestões de deduplicação
- Fuzzy passa a existir apenas no pós-processamento e na tela de manutenção do dicionário

### Etapa 3 — Sistema de Revisão e Sugestão

- Criar componente/modal de "Possíveis Duplicatas" no fluxo pós-extração
- Integrar `scoreHistoryKeyMatch` (com pesos melhorados) para gerar candidatos
- Interface de aprovação manual: "Deseja reutilizar este nome?"
- Alimentar o dicionário apenas após confirmação explícita do usuário

### Etapa 4 — Revisar Tags Visuais

- Substituir `"exact" | "approx" | "none"` por `"verified" | "new" | "suggestion"`
- Atualizar `ShoppingListItem.tsx` com os novos estados e cores
- Atualizar `ShoppingListTab` para determinar o estado baseado na existência
  de identidade canônica (dicionário) em vez de resultado de fuzzy
