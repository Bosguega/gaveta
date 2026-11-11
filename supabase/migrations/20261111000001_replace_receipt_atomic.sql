-- Substitui uma nota e seus itens em uma única transação.
-- Se qualquer etapa falhar, o PostgreSQL desfaz tanto o novo salvamento
-- quanto a exclusão da nota anterior.
CREATE OR REPLACE FUNCTION public.replace_receipt_atomic(
  p_user_id uuid,
  p_old_receipt_id text,
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
SET search_path = public
AS $$
DECLARE
  v_saved_receipt jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  IF p_old_receipt_id IS NULL OR p_old_receipt_id = '' THEN
    RAISE EXCEPTION 'ID da nota a substituir nao informado';
  END IF;

  -- Confirma propriedade e bloqueia a nota antiga durante a substituição.
  PERFORM 1
  FROM public.receipts
  WHERE id = p_old_receipt_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota a substituir nao encontrada ou nao pertence ao usuario';
  END IF;

  -- Reutiliza a rotina oficial de salvamento, preservando todos os campos,
  -- regras de itens, descontos e nome fantasia já existentes.
  v_saved_receipt := public.save_receipt_atomic(
    p_user_id,
    p_receipt_id,
    p_establishment,
    p_date,
    COALESCE(p_items, '[]'::jsonb),
    p_total_discount,
    p_nfce_qr_url
  );

  -- Se os IDs forem iguais, save_receipt_atomic já atualizou a própria nota.
  IF p_old_receipt_id <> p_receipt_id THEN
    DELETE FROM public.receipts
    WHERE id = p_old_receipt_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Nao foi possivel remover a nota anterior';
    END IF;
  END IF;

  RETURN v_saved_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_receipt_atomic(
  uuid, text, text, text, timestamp without time zone, jsonb, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.replace_receipt_atomic(
  uuid, text, text, text, timestamp without time zone, jsonb, numeric, text
) TO authenticated;
