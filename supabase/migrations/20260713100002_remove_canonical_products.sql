-- Migration to remove canonical products
-- Drop foreign key constraints from items
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_canonical_product_id_fkey;

-- Drop foreign key constraints from product_dictionary
ALTER TABLE public.product_dictionary DROP CONSTRAINT IF EXISTS product_dictionary_canonical_product_id_fkey;

-- Drop columns
ALTER TABLE public.items DROP COLUMN IF EXISTS canonical_product_id;
ALTER TABLE public.product_dictionary DROP COLUMN IF EXISTS canonical_product_id;

-- Drop functions related to canonical products
DROP FUNCTION IF EXISTS public.merge_canonical_products_atomic;

-- Drop policies for canonical products (guard: DROP POLICY IF EXISTS exige que a tabela exista)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'canonical_products') THEN
        DROP POLICY IF EXISTS "Users can create their own canonical products" ON public.canonical_products;
        DROP POLICY IF EXISTS "Users can view their own canonical products" ON public.canonical_products;
        DROP POLICY IF EXISTS "Users can update their own canonical products" ON public.canonical_products;
        DROP POLICY IF EXISTS "Users can delete their own canonical products" ON public.canonical_products;
    END IF;
END
$$;

-- Drop table
DROP TABLE IF EXISTS public.canonical_products;
