-- Migration: Add paid_price column and update save_receipt_atomic to include it
-- paid_price stores the actual price paid after any manual discount.

-- 1. Add paid_price column to items table
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS paid_price numeric DEFAULT NULL;

-- ============================================================================
-- 2. Update save_receipt_atomic to handle paid_price
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_receipt_atomic(
  p_user_id uuid,
  p_receipt_id text,
  p_establishment text,
  p_date timestamp without time zone,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receipt public.receipts%ROWTYPE;
  v_establishment_display text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  -- Busca o nome fantasia correspondente no dicionário de estabelecimentos
  SELECT nome_fantasia INTO v_establishment_display
  FROM public.establishment_dictionary
  WHERE user_id = p_user_id AND establishment = p_establishment;

  INSERT INTO public.receipts (
    id,
    establishment,
    establishment_display,
    date,
    user_id
  )
  VALUES (
    p_receipt_id,
    p_establishment,
    v_establishment_display,
    p_date,
    p_user_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    establishment = EXCLUDED.establishment,
    establishment_display = COALESCE(v_establishment_display, receipts.establishment_display),
    date = EXCLUDED.date,
    user_id = EXCLUDED.user_id
  WHERE public.receipts.user_id = p_user_id
  RETURNING * INTO v_receipt;

  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Recibo nao encontrado ou nao pertence ao usuario';
  END IF;

  DELETE FROM public.items
  WHERE receipt_id = v_receipt.id;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.items (
      receipt_id,
      name,
      normalized_key,
      normalized_name,
      category,
      quantity,
      unit,
      price,
      paid_price
    )
    SELECT
      v_receipt.id,
      item.name,
      item.normalized_key,
      item.normalized_name,
      item.category,
      COALESCE(item.quantity, 1),
      COALESCE(item.unit, 'un'),
      COALESCE(item.price, 0),
      item.paid_price
    FROM jsonb_to_recordset(p_items) AS item(
      name text,
      normalized_key text,
      normalized_name text,
      category text,
      quantity numeric,
      unit text,
      price numeric,
      paid_price numeric
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_receipt.id,
    'establishment', v_receipt.establishment,
    'establishment_display', v_receipt.establishment_display,
    'date', v_receipt.date,
    'created_at', v_receipt.created_at
  );
END;
$$;

-- ============================================================================
-- 3. RPC to update a single item's paid_price (for inline editing in history)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_item_paid_price(
  p_item_id uuid,
  p_paid_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  UPDATE public.items i
  SET paid_price = p_paid_price
  FROM public.receipts r
  WHERE i.receipt_id = r.id
    AND r.user_id = auth.uid()
    AND i.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao encontrado ou nao pertence ao usuario';
  END IF;
END;
$$;