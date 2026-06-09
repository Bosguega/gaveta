-- =============================================================
-- 007_normalize_product_categories.sql
--
-- Consolida categorias duplicadas no dicionario e nos itens
-- das notas (ex: "Laticinios" -> "Laticinios", "Acougue" -> "Acougue").
--
-- Idempotente: usa IS DISTINCT FROM para nao fazer nada
-- quando o valor ja estiver canonico. Rodar com seguranca
-- quantas vezes quiser.
--
-- Nao ha DELETE em lugar nenhum - apenas UPDATE pontual da
-- coluna `category`. Outras colunas nao sao tocadas.
-- =============================================================

BEGIN;

-- Mapeamento slug (sem acento, lowercase) -> categoria canonica
CREATE TEMP TABLE _cat_map (
  slug TEXT PRIMARY KEY,
  canonical TEXT NOT NULL
);

INSERT INTO _cat_map (slug, canonical) VALUES
  ('acougue',     'Açougue'),
  ('hortifruti',  'Hortifruti'),
  ('laticinios',  'Laticínios'),
  ('padaria',     'Padaria'),
  ('limpeza',     'Limpeza'),
  ('higiene',     'Higiene'),
  ('bebidas',     'Bebidas'),
  ('mercearia',   'Mercearia'),
  ('petshop',     'Petshop'),
  ('outros',      'Outros');

-- Funcao utilitaria: remove acento + lowercase
-- (nao depende da extensao `unaccent` do Postgres)
CREATE OR REPLACE FUNCTION _norm_category(TEXT) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s TEXT := lower(coalesce($1, ''));
BEGIN
  s := translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN s;
END;
$$;

-- Diagnostico: descomentar a linha abaixo antes de rodar para
-- ver quantas linhas serao afetadas. NAO EXECUTA o UPDATE.
-- SELECT count(*) FROM product_dictionary pd
--   JOIN _cat_map m ON _norm_category(pd.category) = m.slug
--   WHERE pd.category IS DISTINCT FROM m.canonical;

-- product_dictionary: atualiza somente onde difere do canonico
UPDATE product_dictionary pd
SET category = m.canonical
FROM _cat_map m
WHERE _norm_category(pd.category) = m.slug
  AND pd.category IS DISTINCT FROM m.canonical;

-- receipt_items: mesma logica (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'receipt_items'
  ) THEN
    EXECUTE '
      UPDATE receipt_items ri
      SET category = m.canonical
      FROM _cat_map m
      WHERE _norm_category(ri.category) = m.slug
        AND ri.category IS DISTINCT FROM m.canonical
    ';
  END IF;
END $$;

DROP TABLE _cat_map;
DROP FUNCTION _norm_category(TEXT);

COMMIT;
