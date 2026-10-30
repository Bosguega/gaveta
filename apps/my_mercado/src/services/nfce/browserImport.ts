/**
 * Importação de texto da NFC-e a partir do link público, via navegador do sistema.
 *
 * Essa é uma alternativa ao fluxo de consulta própria (Edge Function / proxies).
 * Aqui o usuário abre a página pública no navegador, copia o conteúdo exibido e
 * o app tenta transferi-lo para o campo de entrada de texto existente.
 *
 * Não há:
 * - parser específico da página do SEFAZ;
 * - requisição HTTP própria para extrair dados fiscais;
 * - integração direta com endpoints internos do SEFAZ.
 *
 * A recuperação depende do que o navegador permite (mesma origem, área de
 * transferência). Quando não é possível recuperar automaticamente, a colagem
 * manual continua funcionando.
 */

import { validateNfceSpUrl } from "./validateUrl";
import { logger } from "../../utils/logger";
import { createDeviceStore } from "@bosguega/device-mode-core";

// Armazenamento único (o app é um PWA; não há múltiplas instâncias concorrentes).
const deviceStore = createDeviceStore();

/**
 * Resultado da tentativa de abertura do link público.
 */
export type OpenLinkResult =
  | { ok: true; opened: boolean }
  | { ok: false; error: string };

/**
 * Resultado da tentativa de leitura da área de transferência.
 */
export type ClipboardResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Valida se a URL é segura para ser aberta no navegador público.
 *
 * Regras de segurança:
 * - Somente HTTPS (bloqueia http:, javascript:, data: e outros esquemas).
 * - Somente host da NFC-e de São Paulo (fazenda.sp.gov.br).
 * - Deve conter os parâmetros esperados (p ou chNFe).
 *
 * @returns A URL normalizada quando válida, ou um erro descrevendo o motivo.
 */
export function validateBrowserLink(rawUrl: string): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const valid = validateNfceSpUrl(rawUrl);
    return { ok: true, url: valid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "URL inválida." };
  }
}

/**
 * Abre o endereço público no navegador do sistema, em uma nova aba/janela.
 *
 * Usa `noopener,noreferrer` para que a página aberta não tenha acesso a
 * `window.opener` (boa prática de segurança).
 *
 * Observação: `window.open` pode retornar `null` tanto quando o popup é
 * bloqueado quanto quando o navegador abre a aba mas não expõe a referência
 * (comum em PWAs instalados e alguns navegadores móveis). Como não há como
 * distinguir confiavelmente os dois casos, não tratamos o `null` como erro
 * fatal — apenas registramos o aviso e seguimos, permitindo que o usuário
 * prossiga para colar o texto manualmente.
 *
 * @returns Resultado da abertura. `ok: false` apenas em caso de exceção.
 */
export function openNfceUrl(url: string): OpenLinkResult {
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");

    if (!opened) {
      logger.warn("BrowserImport", "window.open não retornou referência da aba; assumindo abertura pelo navegador.", {
        url,
      });
    } else {
      logger.info("BrowserImport", "Link aberto no navegador.", { url });
    }

    return { ok: true, opened: true };
  } catch (err) {
    logger.error("BrowserImport", "Falha ao abrir link no navegador.", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não foi possível abrir o navegador.",
    };
  }
}

/**
 * Indica se o dispositivo atual é desktop (inclui tablet) ou mobile.
 * Usado apenas para ajustar a dica apresentada ao usuário.
 */
export function isDesktopPlatform(): boolean {
  const mode = deviceStore.getMode();
  return mode === "desktop" || mode === "tablet";
}

/**
 * Tenta ler o texto da área de transferência do sistema.
 *
 * É uma ação explícita do usuário. O navegador pode negar a permissão ou
 * a área de transferência pode estar vazia. Nesse caso, retorna um erro
 * sem lançar exceção, para que a colagem manual continue disponível.
 */
export async function tryReadClipboardText(): Promise<ClipboardResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return { ok: false, error: "Área de transferência não disponível neste navegador." };
  }

  try {
    const text = await navigator.clipboard.readText();

    if (!text || !text.trim()) {
      return { ok: false, error: "Área de transferência vazia." };
    }

    logger.info("BrowserImport", "Texto lido da área de transferência.", { length: text.length });
    return { ok: true, text: text.trim() };
  } catch (err) {
    logger.warn("BrowserImport", "Leitura da área de transferência negada ou indisponível.", err);
    const errorMessage = err instanceof Error ? err.message : "Permissão negada.";
    return {
      ok: false,
      error:
        errorMessage.includes("Permission") || errorMessage.includes("permissão")
          ? "Permissão para ler a área de transferência não concedida."
          : errorMessage,
    };
  }
}

/**
 * Limpa o armazenamento de modo do dispositivo (útil em testes).
 */
export function resetDeviceStoreForTests(): void {
  deviceStore.destroy();
}
