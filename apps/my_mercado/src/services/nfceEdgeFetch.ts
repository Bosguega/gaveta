import { supabase } from "./supabaseClient";
import { invoke, SupabaseError } from "@bosguega/supabase";

export type NfceEdgeSuccess = {
  success: true;
  html: string;
  source: "sefaz" | "cache";
  status: number;
};

export type NfceEdgeError = {
  success: false;
  error: string;
  message: string;
  status: number;
};

export type NfceEdgeResponse = NfceEdgeSuccess | NfceEdgeError;

/**
 * Busca HTML da NFC-e via Edge Function (servidor), sem CORS/proxy público.
 */
export async function fetchNfceHtmlFromEdge(
  url: string,
): Promise<{ ok: true; html: string } | { ok: false; detail: string }> {
  if (!supabase) {
    return { ok: false, detail: "supabase_desabilitado" };
  }

  let data: NfceEdgeResponse;
  try {
    data = await invoke<NfceEdgeResponse>(supabase, "fetch-nfce", {
      body: { url },
      timeoutMs: 30_000,
      retries: 1,
    });
  } catch (error) {
    if (error instanceof SupabaseError) {
      return { ok: false, detail: error.message || error.code };
    }
    return { ok: false, detail: error instanceof Error ? error.message : "invoke_failed" };
  }

  if (!data) {
    return { ok: false, detail: "resposta_vazia" };
  }

  if (!data.success) {
    return { ok: false, detail: `${data.error}: ${data.message}` };
  }

  return { ok: true, html: data.html };
}
