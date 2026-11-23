-- Permite corrigir a data de compra sem substituir itens ou alterar created_at.

CREATE OR REPLACE FUNCTION public.update_receipt_date(
  p_receipt_id text,
  p_date timestamp without time zone
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  UPDATE public.receipts
  SET date = p_date
  WHERE id = p_receipt_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota nao encontrada ou nao pertence ao usuario';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_receipt_date(text, timestamp without time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_receipt_date(text, timestamp without time zone) TO authenticated;
