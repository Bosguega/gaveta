-- =============================================================
-- 008_establishment_dictionary.sql
--
-- Cria a tabela establishment_dictionary para mapear nomes de
-- estabelecimentos (nomeNota -> nomeFantasia) e uma coluna
-- establishment_display na tabela receipts que pode ser
-- atualizada via RPC sem alterar o nome original.
-- =============================================================

-- 1. Criar tabela do dicionário
CREATE TABLE IF NOT EXISTS establishment_dictionary (
    nome_nota TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, nome_nota)
);

-- 2. Adicionar coluna de display na tabela receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS establishment_display TEXT;

-- 3. RLS
ALTER TABLE establishment_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ler seus proprios mapeamentos"
    ON establishment_dictionary
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem inserir seus proprios mapeamentos"
    ON establishment_dictionary
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios podem atualizar seus proprios mapeamentos"
    ON establishment_dictionary
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem deletar seus proprios mapeamentos"
    ON establishment_dictionary
    FOR DELETE
    USING (auth.uid() = user_id);

-- 4. RPC: apply_establishment_entry_to_receipts
-- Atualiza APENAS establishment_display nas receipts,
-- preservando o establishment original.
CREATE OR REPLACE FUNCTION apply_establishment_entry_to_receipts(
    p_user_id UUID,
    p_old_name TEXT,
    p_new_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE receipts
    SET establishment_display = p_new_name
    WHERE user_id = p_user_id
      AND establishment = p_old_name;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;