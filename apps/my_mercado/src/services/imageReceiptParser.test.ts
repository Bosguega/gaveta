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
