import { supabase } from "./supabaseClient";

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

  const { data, error } = await supabase.functions.invoke<NfceEdgeResponse>("fetch-nfce", {
    body: { url },
  });

  if (error) {
    return { ok: false, detail: error.message || "invoke_failed" };
  }

  if (!data) {
    return { ok: false, detail: "resposta_vazia" };
  }

  if (!data.success) {
    return { ok: false, detail: `${data.error}: ${data.message}` };
  }

  return { ok: true, html: data.html };
}
