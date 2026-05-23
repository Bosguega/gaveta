# Auditoria: Geração de Nomes e Produtos Canônicos no `my_mercado`

## 1. Como os nomes são gerados no Dicionário de Produtos

Quando um recibo é processado, os nomes brutos dos itens passam por um fluxo de normalização para gerar uma **chave determinística (`normalized_key`)** no dicionário:

1. **Remoção de Informações Variáveis (stripVariableInfo):**
   - O código tenta remover unidades soltas no final do nome do produto (ex: ` KG`, ` G`, ` UN`), mas **apenas se não estiverem precedidas por um número**.
   - Se a unidade de medida do recibo for `KG` e a quantidade for menor que 5, ele também tenta remover marcações de peso.
   - *Arquivo relacionado:* `src/utils/stringUtils.ts`

2. **Normalização da Chave (normalizeKey):**
   - O nome resultante do passo anterior passa por uma limpeza:
     - Remove acentos.
     - Converte para letras maiúsculas.
     - Substitui vírgulas por pontos (ex: `1,5L` vira `1.5L`).
     - Remove caracteres especiais, mantendo apenas letras, números, espaços e pontos.
   - *Arquivo relacionado:* `src/utils/normalize.ts`

**Resultado:** O dicionário usa essa chave normalizada para identificar produtos de forma única. Produtos com volumes diferentes (ex: "PEPSI 2L" e "PEPSI 1L") geram chaves diferentes ("PEPSI 2L" e "PEPSI 1L").

---

## 2. Como é feita a criação do Nome Amigável

Se a chave normalizada não for encontrada no dicionário (nem na base de dados, nem num *fallback* pré-existente), o item é enviado para a IA gerar o nome amigável.

1. **Prompt da IA (buildNormalizationPrompt):**
   - A IA é orientada explicitamente através de **REGRAS RIGOROSAS**.
   - A **Regra 1** do prompt diz: `MANTENHA volumes e pesos (ex: 1L, 2L, 350ml, 500g, 5kg, 1.5L)`.
   - A **Regra 7** orienta a IA a: `GERE um slug único simplificado (ex: arroz_tio_joao_5kg)`.
   - *Arquivo relacionado:* `src/utils/ai/promptBuilder.ts`

**Resultado:** A IA vai gerar nomes amigáveis distintos, mantendo a variação de volume, como "Refrigerante Pepsi 2L" (slug: `refrigerante_pepsi_2l`) e "Refrigerante Pepsi 1L" (slug: `refrigerante_pepsi_1l`).

---

## 3. Como funciona os Produtos Canônicos (Produtos VIP)

O sistema possui um fluxo de auto-criação de "Produtos VIP" (Produtos Canônicos) para itens novos processados pela IA.

1. **Match Automático:**
   - Ao receber o resultado da IA, o sistema tenta encontrar um Produto Canônico existente usando o `slug` ou o nome amigável gerado (`normalized_name`).
2. **Criação Automática:**
   - Se não encontrar nenhum Produto Canônico correspondente, o sistema **cria automaticamente** um novo Produto Canônico na base de dados (tabela `canonical_products`), usando o nome, categoria e marca fornecidos pela IA.
   - A entrada do Dicionário é então salva (ou atualizada) referenciando o ID deste Produto Canônico recém-criado.
   - *Arquivo relacionado:* `src/services/productService.ts` (função `processItemsPipeline`)

---

## 4. Conclusão: "Pepsi 2L" e "Pepsi 1L" são tratados como o mesmo produto?

**NÃO, eles são tratados como produtos distintos.**

**Por que isso acontece?**
1. O extrator de chaves (`normalizeKey` / `stripVariableInfo`) não remove a volumetria (1L, 2L) do nome bruto. Portanto, eles possuem `normalized_keys` diferentes no Dicionário.
2. O prompt da IA instrui explicitamente a manter volumes e pesos no nome amigável (Regra 1).
3. Isso resulta em slugs e nomes amigáveis diferentes (ex: `refrigerante_pepsi_1l` e `refrigerante_pepsi_2l`).
4. Consequentemente, o sistema cria (ou tenta dar match em) **dois Produtos Canônicos diferentes** no banco de dados.

Se o objetivo for tratá-los como o mesmo produto (um único produto canônico "Pepsi" onde 1L e 2L são apenas variações do item comprado), a lógica de extração da chave e as regras da IA precisariam ser alteradas para remover e ignorar ativamente a volumetria.
