-- Migration to update save_receipt_atomic function, removing canonical_product_id references
-- The canonical_products table and its columns were removed in migration 002

-- Drop the old overloaded functions first to avoid ambiguity errors
DROP FUNCTION IF EXISTS public.save_receipt_atomic(uuid, text, text, timestamp without time zone, jsonb);
DROP FUNCTION IF EXISTS public.save_receipt_atomic(uuid, text, text, date, jsonb);

CREATE OR REPLACE FUNCTION public.save_receipt_atomic(
  p_user_id uuid,
  p_receipt_id text,
  p_establishment text,
  p_date date,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receipt public.receipts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  INSERT INTO public.receipts (
    id,
    establishment,
    date,
    user_id
  )
  VALUES (
    p_receipt_id,
    p_establishment,
    p_date,
    p_user_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    establishment = EXCLUDED.establishment,
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
      price
    )
    SELECT
      v_receipt.id,
      item.name,
      item.normalized_key,
      item.normalized_name,
      item.category,
      COALESCE(item.quantity, 1),
      COALESCE(item.unit, 'un'),
      COALESCE(item.price, 0)
    FROM jsonb_to_recordset(p_items) AS item(
      name text,
      normalized_key text,
      normalized_name text,
      category text,
      quantity numeric,
      unit text,
      price numeric
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_receipt.id,
    'establishment', v_receipt.establishment,
    'date', v_receipt.date,
    'created_at', v_receipt.created_at
  );
END;
$$;