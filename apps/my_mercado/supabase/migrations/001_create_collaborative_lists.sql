-- Migration: Create collaborative lists & shopping snapshots
-- ============================================================================
-- ATENÇÃO: Esta migration define a estrutura de compartilhamento de listas
-- via códigos de 6 caracteres. O modelo de segurança é híbrido:
--   - Leitura pública via código (SELECT USING true) — qualquer um que saiba
--     o código pode ler a lista. Isso é INTENCIONAL para permitir acesso
--     sem autenticação.
--   - Escrita em itens validada pelo código no backend da aplicação.
--   - Owner autenticado gerencia a lista (UPDATE/DELETE).
--
-- ⚠️ SEGURANÇA: As políticas SELECT USING (true) permitem que qualquer
--    usuário autenticado no Supabase liste TODAS as listas via API REST
--    (GET /rest/v1/collaborative_lists). Para mitigar, após aplicar esta
--    migration, no Dashboard do Supabase vá em:
--      Project Settings → API → disable public access to collaborative_lists
--    Ou use RPC functions para acesso controlado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Função compartilhada de trigger (evita duplicação)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. Shopping List Snapshots (cloud sync)
-- Migration from old column name "snapshot" to "data":
--   - Migration anterior criou a coluna "snapshot" (JSONB)
--   - O código espera a coluna "data" (JSONB)
--   - Este bloco adapta: adiciona IF NOT EXISTS + migra dados se necessário
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_list_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data            JSONB,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_snapshot UNIQUE (user_id)
);

-- Migra coluna "snapshot" → "data" se a tabela já existir da migration anterior
DO $$
BEGIN
  -- Se a tabela já existe mas tem coluna "snapshot" em vez de "data"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list_snapshots'
    AND column_name = 'snapshot'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list_snapshots'
    AND column_name = 'data'
  ) THEN
    -- Adiciona coluna data e copia dados existentes
    ALTER TABLE shopping_list_snapshots ADD COLUMN data JSONB;
    UPDATE shopping_list_snapshots SET data = snapshot;
    -- Torna data NOT NULL após migração
    ALTER TABLE shopping_list_snapshots ALTER COLUMN data SET NOT NULL;
    -- Remove coluna antiga
    ALTER TABLE shopping_list_snapshots DROP COLUMN snapshot;
  END IF;
  -- Se já existe coluna data (criada nesta migration), garante NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list_snapshots'
    AND column_name = 'data'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE shopping_list_snapshots ALTER COLUMN data SET NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON shopping_list_snapshots (user_id);

DROP TRIGGER IF EXISTS trg_shopping_list_snapshots_updated_at ON shopping_list_snapshots;
CREATE TRIGGER trg_shopping_list_snapshots_updated_at
    BEFORE UPDATE ON shopping_list_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE shopping_list_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_select_own_snapshot ON shopping_list_snapshots;
CREATE POLICY user_select_own_snapshot
    ON shopping_list_snapshots FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_insert_own_snapshot ON shopping_list_snapshots;
CREATE POLICY user_insert_own_snapshot
    ON shopping_list_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_update_own_snapshot ON shopping_list_snapshots;
CREATE POLICY user_update_own_snapshot
    ON shopping_list_snapshots FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_delete_own_snapshot ON shopping_list_snapshots;
CREATE POLICY user_delete_own_snapshot
    ON shopping_list_snapshots FOR DELETE
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Collaborative Lists (compartilhamento via código de 6 caracteres)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaborative_lists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collaborative_list_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id         UUID NOT NULL REFERENCES collaborative_lists(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    normalized_key  TEXT NOT NULL DEFAULT '',
    quantity        TEXT,
    note            TEXT CHECK (char_length(note) <= 500),
    checked         BOOLEAN NOT NULL DEFAULT false,
    checked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collaborative_list_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id     UUID NOT NULL REFERENCES collaborative_lists(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (list_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 4. Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_collaborative_lists_code      ON collaborative_lists(code);
CREATE INDEX IF NOT EXISTS idx_collaborative_lists_owner     ON collaborative_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_list_items_list ON collaborative_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_list_items_key  ON collaborative_list_items(list_id, normalized_key);
CREATE INDEX IF NOT EXISTS idx_collaborative_list_members_user ON collaborative_list_members(user_id);

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_collaborative_lists_updated_at ON collaborative_lists;
CREATE TRIGGER trg_collaborative_lists_updated_at
    BEFORE UPDATE ON collaborative_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_collaborative_list_items_updated_at ON collaborative_list_items;
CREATE TRIGGER trg_collaborative_list_items_updated_at
    BEFORE UPDATE ON collaborative_list_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_collaborative_list_members_updated_at ON collaborative_list_members;
CREATE TRIGGER trg_collaborative_list_members_updated_at
    BEFORE UPDATE ON collaborative_list_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE collaborative_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_list_members ENABLE ROW LEVEL SECURITY;

-- 6a. collaborative_lists
-- ⚠️ SELECT USING (true) permite listagem pública de todas as listas via API.
--    Mitigação: desabilitar "Enable API" para esta tabela no Dashboard do Supabase
--    ou migrar para RPC futuramente.
DROP POLICY IF EXISTS "Anyone can read lists by code" ON collaborative_lists;
DROP POLICY IF EXISTS anyone_can_read_lists ON collaborative_lists;
CREATE POLICY anyone_can_read_lists ON collaborative_lists
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage lists" ON collaborative_lists;
DROP POLICY IF EXISTS owner_manage_lists ON collaborative_lists;
CREATE POLICY owner_manage_lists ON collaborative_lists
    FOR ALL USING (auth.uid() = owner_id);

-- 6b. collaborative_list_items
DROP POLICY IF EXISTS "Anyone can read items by list" ON collaborative_list_items;
DROP POLICY IF EXISTS anyone_can_read_items ON collaborative_list_items;
CREATE POLICY anyone_can_read_items ON collaborative_list_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone with code can insert items" ON collaborative_list_items;
DROP POLICY IF EXISTS anyone_can_insert_items ON collaborative_list_items;
CREATE POLICY anyone_can_insert_items ON collaborative_list_items
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone with code can update items" ON collaborative_list_items;
DROP POLICY IF EXISTS anyone_can_update_items ON collaborative_list_items;
CREATE POLICY anyone_can_update_items ON collaborative_list_items
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone with code can delete items" ON collaborative_list_items;
DROP POLICY IF EXISTS anyone_can_delete_items ON collaborative_list_items;
CREATE POLICY anyone_can_delete_items ON collaborative_list_items
    FOR DELETE USING (true);

-- 6c. collaborative_list_members
DROP POLICY IF EXISTS "Anyone can read members by list" ON collaborative_list_members;
DROP POLICY IF EXISTS anyone_can_read_members ON collaborative_list_members;
CREATE POLICY anyone_can_read_members ON collaborative_list_members
    FOR SELECT USING (true);

-- Apenas o dono da lista pode gerenciar membros
DROP POLICY IF EXISTS "Owner can manage members" ON collaborative_list_members;
DROP POLICY IF EXISTS owner_manage_members ON collaborative_list_members;
CREATE POLICY owner_manage_members ON collaborative_list_members
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT owner_id FROM collaborative_lists WHERE id = list_id)
    );

DROP POLICY IF EXISTS owner_update_members ON collaborative_list_members;
CREATE POLICY owner_update_members ON collaborative_list_members
    FOR UPDATE USING (
        auth.uid() IN (SELECT owner_id FROM collaborative_lists WHERE id = list_id)
    );

DROP POLICY IF EXISTS owner_delete_members ON collaborative_list_members;
CREATE POLICY owner_delete_members ON collaborative_list_members
    FOR DELETE USING (
        auth.uid() IN (SELECT owner_id FROM collaborative_lists WHERE id = list_id)
    );

-- ---------------------------------------------------------------------------
-- 7. Realtime (apenas adiciona se ainda não for membro)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'collaborative_lists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collaborative_lists;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'collaborative_list_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE collaborative_list_items;
  END IF;
END;
$$;