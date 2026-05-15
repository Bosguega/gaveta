-- Shopping List Snapshots
-- Substitui o uso de user_metadata (limite ~50KB) por uma tabela dedicada
-- Cada usuário tem exatamente 1 snapshot (upsert)

CREATE TABLE IF NOT EXISTS shopping_list_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot        JSONB NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Um snapshot por usuário
    CONSTRAINT unique_user_snapshot UNIQUE (user_id)
);

-- Índice para buscar por usuário rapidamente
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON shopping_list_snapshots (user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_snapshot_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_snapshot_updated_at ON shopping_list_snapshots;
CREATE TRIGGER set_snapshot_updated_at
    BEFORE UPDATE ON shopping_list_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_snapshot_updated_at();

-- RLS: cada usuário só vê o próprio snapshot
ALTER TABLE shopping_list_snapshots ENABLE ROW LEVEL SECURITY;

-- Política: SELECT (apenas próprio)
DROP POLICY IF EXISTS "Usuários podem ver próprio snapshot" ON shopping_list_snapshots;
CREATE POLICY "Usuários podem ver próprio snapshot"
    ON shopping_list_snapshots
    FOR SELECT
    USING (auth.uid() = user_id);

-- Política: INSERT (apenas próprio)
DROP POLICY IF EXISTS "Usuários podem inserir próprio snapshot" ON shopping_list_snapshots;
CREATE POLICY "Usuários podem inserir próprio snapshot"
    ON shopping_list_snapshots
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: UPDATE (apenas próprio)
DROP POLICY IF EXISTS "Usuários podem atualizar próprio snapshot" ON shopping_list_snapshots;
CREATE POLICY "Usuários podem atualizar próprio snapshot"
    ON shopping_list_snapshots
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Política: DELETE (apenas próprio)
DROP POLICY IF EXISTS "Usuários podem deletar próprio snapshot" ON shopping_list_snapshots;
CREATE POLICY "Usuários podem deletar próprio snapshot"
    ON shopping_list_snapshots
    FOR DELETE
    USING (auth.uid() = user_id);