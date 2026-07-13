-- Migration: Add normalized_name column to collaborative_list_items
-- ============================================================================
-- Adiciona a coluna normalized_name para substituir normalized_key como a
-- identidade canônica do produto no compartilhamento de listas.
-- ============================================================================

ALTER TABLE public.collaborative_list_items
  ADD COLUMN IF NOT EXISTS normalized_name TEXT NOT NULL DEFAULT '';

-- Preenche normalized_name com fallback para dados existentes
UPDATE public.collaborative_list_items
SET normalized_name = INITCAP(TRIM(name))
WHERE normalized_name = '' OR normalized_name IS NULL;