import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock da config de IA para injetar apiKey/modelo sem depender do ai-core.
vi.mock("../utils/ai/aiConfig", () => ({
  getApiKey: () => "test-key",
  getApiModel: () => "gemini-test",
}));

const { parseReceiptFromImage } = await import("./imageReceiptParser");

function geminiResponse(text: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeFile(): File {
  // Conteúdo pequeno; só precisa existir para o FileReader gerar base64.
  return new File(["fake-image-bytes"], "nota.png", { type: "image/png" });
}

describe("parseReceiptFromImage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("separa preço cheio de paid_price quando há desconto por item", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Mercado X",
      date: "10/09/2026 10:00:00",
      total_discount: 0,
      items: [
        {
          name: "CAFE 500G",
          quantity: 2,
          price: 20,
          total: 40,
          paid_price: 17.5,
          paid_total: 35,
        },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    expect(receipt.source).toBe("gallery");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].price).toBe(20);
    expect(receipt.items[0].total).toBe(40);
    expect(receipt.items[0].paid_price).toBe(17.5);
    // Sem desconto geral: total_discount não deve ser definido.
    expect(receipt).not.toHaveProperty("total_discount");
  });

  it("omite paid_price quando o item não tem desconto", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Mercado Y",
      date: "10/09/2026 10:00:00",
      items: [
        { name: "ARROZ 5KG", quantity: 1, price: 24.9, total: 24.9 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    expect(receipt.items[0]).not.toHaveProperty("paid_price");
    expect(receipt.items[0].price).toBe(24.9);
  });

  it("preenche total_discount global a partir do desconto da nota", async () => {
    const payload = JSON.stringify({
      confidence: "media",
      establishment: "Mercado Z",
      date: "10/09/2026 10:00:00",
      total_discount: 5.5,
      items: [
        { name: "LEITE 1L", quantity: 3, price: 5, total: 15 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    expect(receipt.total_discount).toBe(5.5);
    // Item sem desconto individual permanece cheio.
    expect(receipt.items[0]).not.toHaveProperty("paid_price");
  });

  it("ignora paid_price >= price (sem desconto efetivo)", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Mercado W",
      date: "10/09/2026 10:00:00",
      items: [
        { name: "CHOCOLATE", quantity: 1, price: 8, total: 8, paid_price: 8, paid_total: 8 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    expect(receipt.items[0]).not.toHaveProperty("paid_price");
  });

  it("calcula paid_price a partir do discount impresso (caso kg, nota real)", async () => {
    // Nota real: CHUCHU 0,765 KG x 6,98 = 5,34; "Desconto Item-09: -3.06".
    // O app deve calcular 5,34 - 3,06 = 2,28 -> paid_price = 2,28 / 0,765.
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Rede Zefeirinho",
      date: "07/10/2026 13:49:04",
      total_discount: 3.06,
      items: [
        { name: "CHUCHU Kg", quantity: 0.765, price: 6.98, total: 5.34, discount: 3.06 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    const item = receipt.items[0];
    expect(item.price).toBe(6.98);
    expect(item.total).toBe(5.34);
    // Total pago reconstruído é 2,28 (não 2,34): a IA só leu o desconto.
    expect((item.paid_price ?? 0) * 0.765).toBeCloseTo(2.28, 2);
  });

  it("ignora discount inválido (zero, negativo ou >= total da linha)", async () => {
    const payload = JSON.stringify({
      confidence: "media",
      establishment: "Mercado A",
      date: "07/10/2026 13:49:04",
      items: [
        { name: "BANANA Kg", quantity: 1, price: 10, total: 10, discount: 0 },
        { name: "MACA Kg", quantity: 1, price: 12, total: 12, discount: -2 },
        { name: "PERA Kg", quantity: 1, price: 8, total: 8, discount: 8 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    for (const item of receipt.items) {
      expect(item).not.toHaveProperty("paid_price");
    }
  });

  it("prefere discount quando a IA envia também paid_total/paid_price", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Mercado B",
      date: "07/10/2026 13:49:04",
      items: [
        // discount vence: (20 - 4) / 2 = 8 (não 15/2 = 7.5 nem 9).
        { name: "QUEIJO KG", quantity: 2, price: 10, total: 20, discount: 4, paid_total: 15, paid_price: 9 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    expect(receipt.items[0].paid_price).toBeCloseTo(8, 5);
  });

  it("deriva paid_price de paid_total quando paid_price está ausente", async () => {
    const payload = JSON.stringify({
      confidence: "alta",
      establishment: "Mercado Q",
      date: "10/09/2026 10:00:00",
      items: [
        { name: "QUEIJO KG", quantity: 2, price: 10, total: 20, paid_total: 18 },
      ],
    });

    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse(payload)));

    const { receipt } = await parseReceiptFromImage(makeFile());

    // 18 / 2 = 9
    expect(receipt.items[0].paid_price).toBeCloseTo(9, 5);
  });
});
