-- =============================================================
-- 014_add_nfce_qr_url.sql
--
-- Adiciona nfce_qr_url à tabela receipts para salvar a URL original
-- do QR Code da NFC-e, permitindo abrir a nota diretamente na SEFAZ.
--
-- Atualiza save_receipt_atomic mantendo todo o comportamento da
-- migration 013 e adicionando o parâmetro p_nfce_qr_url.
-- =============================================================

-- 1. Coluna nfce_qr_url em receipts (notas antigas continuam NULL)
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS nfce_qr_url text DEFAULT NULL;

-- 2. save_receipt_atomic com suporte a p_nfce_qr_url
CREATE OR REPLACE FUNCTION public.save_receipt_atomic(
  p_user_id uuid,
  p_receipt_id text,
  p_establishment text,
  p_date timestamp without time zone,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_total_discount numeric DEFAULT NULL,
  p_nfce_qr_url text DEFAULT NULL
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
    user_id,
    total_discount,
    nfce_qr_url
  )
  VALUES (
    p_receipt_id,
    p_establishment,
    COALESCE(v_establishment_display, p_establishment),
    p_date,
    p_user_id,
    p_total_discount,
    p_nfce_qr_url
  )
  ON CONFLICT (id) DO UPDATE
  SET
    establishment = EXCLUDED.establishment,
    establishment_display = COALESCE(v_establishment_display, p_establishment, receipts.establishment_display),
    date = EXCLUDED.date,
    user_id = EXCLUDED.user_id,
    total_discount = EXCLUDED.total_discount,
    nfce_qr_url = COALESCE(EXCLUDED.nfce_qr_url, receipts.nfce_qr_url)
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
      paid_price,
      total
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
      item.paid_price,
      item.total
    FROM jsonb_to_recordset(p_items) AS item(
      name text,
      normalized_key text,
      normalized_name text,
      category text,
      quantity numeric,
      unit text,
      price numeric,
      paid_price numeric,
      total numeric
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_receipt.id,
    'establishment', v_receipt.establishment,
    'establishment_display', v_receipt.establishment_display,
    'date', v_receipt.date,
    'created_at', v_receipt.created_at,
    'total_discount', v_receipt.total_discount,
    'nfce_qr_url', v_receipt.nfce_qr_url
  );
END;
$$;
