import { describe, expect, it, vi, afterEach } from "vitest";
import {
  validateBrowserLink,
  openNfceUrl,
  tryReadClipboardText,
} from "./browserImport";

// Mock do device-store para não depender do localStorage nos testes.
vi.mock("@bosguega/device-mode-core", () => ({
  createDeviceStore: vi.fn(() => ({
    getMode: vi.fn(() => "mobile"),
    setMode: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    destroy: vi.fn(),
  })),
}));

const originalOpen = window.open;
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard"
);

afterEach(() => {
  // Restaura mocks globais alterados nos testes.
  window.open = originalOpen;
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
  }
  vi.restoreAllMocks();
});

function setClipboard(readTextMock: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { readText: readTextMock },
    writable: true,
    configurable: true,
  });
}

describe("validateBrowserLink", () => {
  it("aceita URL HTTPS válida da NFC-e de SP com parâmetro p", () => {
    const result = validateBrowserLink(
      "https://www.fazenda.sp.gov.br/NFCe/ConsultaNFCe.aspx?p=..."
    );
    if (!result.ok) throw new Error("esperava ok");
    expect(result.url).toContain("fazenda.sp.gov.br");
  });

  it("aceita URL HTTPS válida da NFC-e de SP com parâmetro chNFe", () => {
    const result = validateBrowserLink(
      "https://www.fazenda.sp.gov.br/NFCe/ConsultaNFCe.aspx?chNFe=1234567890"
    );
    if (!result.ok) throw new Error("esperava ok");
  });

  it("rejeita URL com protocolo http", () => {
    const result = validateBrowserLink(
      "http://www.fazenda.sp.gov.br/NFCe/ConsultaNFCe.aspx?p=..."
    );
    if (result.ok) throw new Error("esperava falha");
    expect(result.error).toContain("Somente HTTPS");
  });

  it("rejeita host fora do domínio da NFC-e de SP", () => {
    const result = validateBrowserLink(
      "https://www.sefazoutroestado.gov.br/nfce?p=..."
    );
    if (result.ok) throw new Error("esperava falha");
    expect(result.error).toContain("São Paulo");
  });

  it("rejeita esquemas perigosos (javascript:, data:)", () => {
    const js = validateBrowserLink("javascript:alert(1)");
    if (js.ok) throw new Error("esperava falha");

    const data = validateBrowserLink("data:text/html,<script>alert(1)</script>");
    if (data.ok) throw new Error("esperava falha");
  });

  it("rejeita URL sem parâmetros esperados", () => {
    const result = validateBrowserLink(
      "https://www.fazenda.sp.gov.br/NFCe/ConsultaNFCe.aspx"
    );
    if (result.ok) throw new Error("esperava falha");
    expect(result.error).toContain("parâmetros");
  });

  it("rejeita texto que não é URL", () => {
    const result = validateBrowserLink("não é uma url");
    if (result.ok) throw new Error("esperava falha");
  });
});

describe("openNfceUrl", () => {
  it("abre a URL com noopener,noreferrer", () => {
    const spy = vi.fn(() => window as unknown as Window);
    window.open = spy;

    const result = openNfceUrl("https://www.fazenda.sp.gov.br/?p=x");

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      "https://www.fazenda.sp.gov.br/?p=x",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("não trata retorno null do window.open como erro fatal (pode ter aberto mesmo assim)", () => {
    window.open = vi.fn(() => null);

    const result = openNfceUrl("https://www.fazenda.sp.gov.br/?p=x");

    // Seguimos em frente: não há como distinguir "bloqueado" de "abriu sem referência".
    expect(result.ok).toBe(true);
  });
});

describe("tryReadClipboardText", () => {
  it("retorna o texto lido da área de transferência", async () => {
    setClipboard(vi.fn().mockResolvedValue("TEXTO DA NOTA FISCAL"));

    const result = await tryReadClipboardText();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("TEXTO DA NOTA FISCAL");
  });

  it("retorna erro quando a área de transferência está vazia", async () => {
    setClipboard(vi.fn().mockResolvedValue(""));

    const result = await tryReadClipboardText();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("vazia");
  });

  it("retorna erro quando a permissão é negada", async () => {
    const err = new Error("Permission denied to read clipboard");
    err.name = "NotAllowedError";
    setClipboard(vi.fn().mockRejectedValue(err));

    const result = await tryReadClipboardText();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permissão/i);
  });

  it("retorna erro quando navigator.clipboard não está disponível", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const result = await tryReadClipboardText();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("não disponível");

    // Restaura para não afetar outros testes.
    setClipboard(vi.fn().mockResolvedValue(""));
  });
});
