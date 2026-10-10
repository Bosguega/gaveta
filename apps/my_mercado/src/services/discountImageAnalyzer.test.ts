import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../utils/ai/aiConfig", () => ({
  getApiKey: () => "test-key",
  getApiModel: () => "gemini-test",
}));

const { analyzeDiscountsFromImage } = await import("./discountImageAnalyzer");
import type { ReceiptItem } from "../types/domain";

function geminiResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeFile(): File {
  return new File(["fake"], "nota.png", { type: "image/png" });
}

const items: ReceiptItem[] = [
  { id: "i1", name: "CAFE 500G", quantity: 1, price: 20, total: 20 },
  { id: "i2", name: "ARROZ 5KG", quantity: 2, price: 24.9, total: 49.8 },
  { id: "i3", name: "LEITE 1L", quantity: 3, price: 5, total: 15 },
];

describe("analyzeDiscountsFromImage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna sugestões válidas relacionadas aos itens", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      suggestions: [
        { index: 0, paid_price: 17.5 },
        { index: 2, paid_price: 4.2 },
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), items);

    expect(result.confidence).toBe("alta");
    expect(result.suggestions).toEqual([
      { itemIndex: 0, paidPrice: 17.5 },
      { itemIndex: 2, paidPrice: 4.2 },
    ]);
  });

  it("descarta sugestões sem desconto real (paid_price >= price)", async () => {
    const payload = JSON.stringify({
      confidence: "media",
      suggestions: [
        { index: 0, paid_price: 20 },   // igual ao preço cheio -> descarta
        { index: 1, paid_price: 30 },   // maior que o preço cheio -> descarta
        { index: 2, paid_price: 4 },    // desconto real -> mantém
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), items);

    expect(result.suggestions).toEqual([{ itemIndex: 2, paidPrice: 4 }]);
  });

  it("descarta índices inválidos ou fora do intervalo", async () => {
    const payload = JSON.stringify({
      confidence: "baixa",
      suggestions: [
        { index: 99, paid_price: 1 },   // fora do intervalo
        { index: -1, paid_price: 1 },   // negativo
        { index: 0, paid_price: 10 },   // válido
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), items);

    expect(result.suggestions).toEqual([{ itemIndex: 0, paidPrice: 10 }]);
  });

  it("retorna lista vazia quando a IA não identifica descontos", async () => {
    const payload = JSON.stringify({ confidence: "baixa", suggestions: [] });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), items);

    expect(result.suggestions).toEqual([]);
    expect(result.confidence).toBe("baixa");
  });

  it("trata confiança ausente como baixa", async () => {
    const payload = JSON.stringify({ suggestions: [{ index: 0, paid_price: 10 }] });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), items);

    expect(result.confidence).toBe("baixa");
  });

  it("lança erro quando a resposta da API falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" })));

    await expect(analyzeDiscountsFromImage(makeFile(), items)).rejects.toThrow();
  });
});
