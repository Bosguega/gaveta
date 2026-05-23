-- Migration: Remove legacy tables no longer used by the app
-- ============================================================================
-- Remove tabelas que foram abandonadas e não são mais referenciadas no código:
--   - shopping_lists, shopping_list_items, shopping_list_members (modelo antigo)
--   - collaborative_list_members (criado mas nunca implementado no frontend)
--
-- Mantém: shopping_list_snapshots (cloud sync ativo),
--         collaborative_lists, collaborative_list_items (compartilhamento ativo)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove tabelas do modelo antigo shopping_lists (com CASCADE)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.shopping_list_members CASCADE;
DROP TABLE IF EXISTS public.shopping_list_items CASCADE;
DROP TABLE IF EXISTS public.shopping_lists CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Remove tabela collaborative_list_members (nunca usada)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.collaborative_list_members CASCADE;