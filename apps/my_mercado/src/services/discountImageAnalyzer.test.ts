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

  it("deriva o preço unitário a partir de paid_total (itens por kg)", async () => {
    // 1,5 kg x R$ 10,00 = R$ 15,00 cheio; desconto de R$ 3,00 na LINHA -> pago R$ 12,00.
    const kgItems: ReceiptItem[] = [
      { id: "k1", name: "BANANA", quantity: 1.5, unit: "kg", price: 10, total: 15 },
    ];
    const payload = JSON.stringify({
      confidence: "alta",
      suggestions: [{ index: 0, paid_total: 12 }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    // paid_price = 12 / 1,5 = R$ 8,00/kg (desconto no preço final, não por kg).
    expect(result.suggestions).toEqual([{ itemIndex: 0, paidPrice: 8 }]);
  });

  it("descarta paid_total sem desconto real (>= total cheio da linha)", async () => {
    const kgItems: ReceiptItem[] = [
      { id: "k1", name: "BANANA", quantity: 1.5, unit: "kg", price: 10, total: 15 },
    ];
    const payload = JSON.stringify({
      confidence: "media",
      suggestions: [
        { index: 0, paid_total: 15 }, // igual ao total cheio -> descarta
        { index: 0, paid_total: 20 }, // maior que o total cheio -> descarta
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    expect(result.suggestions).toEqual([]);
  });

  it("prefere paid_total quando a IA envia os dois campos", async () => {
    // paid_price incorreto (desconto aplicado no/kg), paid_total correto.
    const kgItems: ReceiptItem[] = [
      { id: "k1", name: "BANANA", quantity: 1.5, unit: "kg", price: 10, total: 15 },
    ];
    const payload = JSON.stringify({
      confidence: "alta",
      suggestions: [{ index: 0, paid_price: 7, paid_total: 12 }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    expect(result.suggestions).toEqual([{ itemIndex: 0, paidPrice: 8 }]);
  });

  it("calcula o valor pago a partir do desconto IMPRESSO (caso chuchu 0,765 kg)", async () => {
    // Nota real: CHUCHU 0,765 KG x 6,98 = 5,34; "Desconto Item-09: -3,06".
    // O app deve calcular 5,34 - 3,06 = 2,28 -> paid_price = 2,28 / 0,765.
    const kgItems: ReceiptItem[] = [
      { id: "c1", name: "CHUCHU Kg", quantity: 0.765, unit: "kg", price: 6.98, total: 5.34 },
    ];
    const payload = JSON.stringify({
      confidence: "alta",
      suggestions: [{ index: 0, discount: 3.06 }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    expect(result.suggestions).toHaveLength(1);
    const paidPrice = result.suggestions[0].paidPrice;
    // 2,28 / 0,765 = 2,98039... — o total pago reconstruído é 2,28 (não 2,34).
    expect(paidPrice * 0.765).toBeCloseTo(2.28, 2);
    expect(paidPrice * 0.765).not.toBeCloseTo(2.34, 2);
  });

  it("descarta desconto inválido (zero, negativo ou >= total cheio)", async () => {
    const kgItems: ReceiptItem[] = [
      { id: "c1", name: "CHUCHU Kg", quantity: 0.765, unit: "kg", price: 6.98, total: 5.34 },
    ];
    const payload = JSON.stringify({
      confidence: "media",
      suggestions: [
        { index: 0, discount: 0 },     // zero -> descarta
        { index: 0, discount: -3.06 }, // negativo -> descarta
        { index: 0, discount: 5.34 },  // igual ao total cheio -> descarta
        { index: 0, discount: 99 },    // maior que o total cheio -> descarta
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    expect(result.suggestions).toEqual([]);
  });

  it("prefere discount quando a IA envia vários campos", async () => {
    const kgItems: ReceiptItem[] = [
      { id: "c1", name: "CHUCHU Kg", quantity: 0.765, unit: "kg", price: 6.98, total: 5.34 },
    ];
    const payload = JSON.stringify({
      confidence: "alta",
      suggestions: [{ index: 0, discount: 3.06, paid_total: 3.0, paid_price: 4.5 }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const result = await analyzeDiscountsFromImage(makeFile(), kgItems);

    // discount vence: (5,34 - 3,06) / 0,765, não 3,0/0,765 nem 4,5.
    expect(result.suggestions[0].paidPrice * 0.765).toBeCloseTo(2.28, 2);
  });

  it("lança erro quando a resposta da API falha", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, text: async () => "err" })));

    await expect(analyzeDiscountsFromImage(makeFile(), items)).rejects.toThrow();
  });
});
