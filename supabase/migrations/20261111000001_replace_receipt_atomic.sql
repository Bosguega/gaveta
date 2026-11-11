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
  v_old_receipt public.receipts%ROWTYPE;
  v_saved_receipt jsonb;
  v_has_establishment_dictionary_entry boolean;
  v_receipt_id_in_use boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  IF p_old_receipt_id IS NULL OR p_old_receipt_id = '' THEN
    RAISE EXCEPTION 'ID da nota a substituir nao informado';
  END IF;

  -- Confirma propriedade e bloqueia a nota antiga durante a substituição.
  SELECT *
  INTO v_old_receipt
  FROM public.receipts
  WHERE id = p_old_receipt_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nota a substituir nao encontrada ou nao pertence ao usuario';
  END IF;

  -- Não permite que um ID novo já pertencente a outra nota do usuário
  -- seja atualizado pelo ON CONFLICT interno de save_receipt_atomic.
  IF p_receipt_id <> p_old_receipt_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.receipts
      WHERE id = p_receipt_id
        AND user_id = p_user_id
    )
    INTO v_receipt_id_in_use;

    IF v_receipt_id_in_use THEN
      RAISE EXCEPTION 'O ID da nova nota ja pertence a outra nota deste usuario';
    END IF;
  END IF;

  -- Se a nova fonte não trouxe esses metadados, preserva os que já existiam.
  -- Isso evita perder o QR da NFC-e ou o desconto ao trocar a origem da nota.
  v_saved_receipt := public.save_receipt_atomic(
    p_user_id,
    p_receipt_id,
    p_establishment,
    p_date,
    COALESCE(p_items, '[]'::jsonb),
    COALESCE(p_total_discount, v_old_receipt.total_discount),
    COALESCE(p_nfce_qr_url, v_old_receipt.nfce_qr_url)
  );

  -- O salvamento resolve o nome fantasia pelo dicionário. Se a loja não
  -- mudou e não há entrada no dicionário, conserva o nome já apresentado.
  IF p_establishment = v_old_receipt.establishment
     AND v_old_receipt.establishment_display IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.establishment_dictionary
      WHERE user_id = p_user_id
        AND establishment = p_establishment
    )
    INTO v_has_establishment_dictionary_entry;

    IF NOT v_has_establishment_dictionary_entry THEN
      UPDATE public.receipts
      SET establishment_display = v_old_receipt.establishment_display
      WHERE id = p_receipt_id
        AND user_id = p_user_id;

      -- Mantém o retorno da RPC coerente com o registro atualizado.
      v_saved_receipt := jsonb_set(
        v_saved_receipt,
        '{establishment_display}',
        to_jsonb(v_old_receipt.establishment_display),
        true
      );
    END IF;
  END IF;

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
