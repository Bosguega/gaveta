-- Migration: Create collaborative lists tables for list sharing
-- Purpose: Enable shared shopping lists accessed via 6-character codes

-- ---------------------------------------------------------------------------
-- Tabela de listas compartilhadas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaborative_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tabela de itens das listas compartilhadas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaborative_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES collaborative_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_key TEXT NOT NULL DEFAULT '',
    quantity TEXT,
    note TEXT,
    checked BOOLEAN NOT NULL DEFAULT false,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tabela de membros (controle de acesso)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaborative_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES collaborative_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_collaborative_lists_code ON collaborative_lists(code);
CREATE INDEX IF NOT EXISTS idx_collaborative_lists_owner ON collaborative_lists(owner_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_list_items_list ON collaborative_list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_collaborative_list_members_list ON collaborative_list_members(list_id);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE collaborative_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_list_members ENABLE ROW LEVEL SECURITY;

-- Leitura pública: qualquer um com o código pode ler listas e itens
CREATE POLICY "Anyone can read lists by code" ON collaborative_lists
    FOR SELECT USING (true);

CREATE POLICY "Anyone can read items by list" ON collaborative_list_items
    FOR SELECT USING (true);

CREATE POLICY "Anyone can read members by list" ON collaborative_list_members
    FOR SELECT USING (true);

-- Escrita pública: qualquer um com o código pode modificar itens
CREATE POLICY "Anyone with code can insert items" ON collaborative_list_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone with code can update items" ON collaborative_list_items
    FOR UPDATE USING (true);

CREATE POLICY "Anyone with code can delete items" ON collaborative_list_items
    FOR DELETE USING (true);

-- Dono pode gerenciar listas
CREATE POLICY "Owner can manage lists" ON collaborative_lists
    FOR ALL USING (auth.uid() = owner_id);

-- Dono pode gerenciar membros
CREATE POLICY "Owner can manage members" ON collaborative_list_members
    FOR ALL USING (
        auth.uid() IN (
            SELECT owner_id FROM collaborative_lists WHERE id = list_id
        )
    );

-- ---------------------------------------------------------------------------
-- Realtime (habilitar publicação para sincronização ao vivo)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE collaborative_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE collaborative_list_items;

-- ---------------------------------------------------------------------------
-- Trigger para atualizar updated_at automaticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collaborative_lists_updated_at
    BEFORE UPDATE ON collaborative_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collaborative_list_items_updated_at
    BEFORE UPDATE ON collaborative_list_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();