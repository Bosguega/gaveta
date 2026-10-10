import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RawReceiptItem } from "../types/domain";

// Mock do dicionário: sem entradas conhecidas força o caminho "desconhecido"
// (chamada de IA), que é mockado abaixo.
const getDictionaryMock = vi.fn();
const updateDictionaryMock = vi.fn();

vi.mock(".", () => ({
  getDictionary: (...args: unknown[]) => getDictionaryMock(...args),
  updateDictionary: (...args: unknown[]) => updateDictionaryMock(...args),
}));

// Mock da IA de normalização: devolve o próprio nome, categoria "Outros".
type AiChunkItem = { key: string; raw: string };
const callAIMock = vi.fn(async (chunk: AiChunkItem[]) =>
  chunk.map((c) => ({ key: c.key, normalized_name: c.raw, category: "Outros" })),
);

vi.mock("../utils/ai", () => ({
  callAI: (chunk: AiChunkItem[]) => callAIMock(chunk),
}));

// Importa após configurar os mocks.
const { processItemsPipeline } = await import("./productService");

describe("processItemsPipeline", () => {
  beforeEach(() => {
    getDictionaryMock.mockReset().mockResolvedValue({});
    updateDictionaryMock.mockReset().mockResolvedValue(undefined);
    callAIMock.mockClear();
  });

  it("preserva paid_price quando o campo paidPrice é fornecido (galeria)", async () => {
    const raw: RawReceiptItem[] = [
      { name: "CAFE 500G", qty: "2", unit: "UN", unitPrice: "20,00", total: "40,00", paidPrice: "17,50" },
    ];

    const result = await processItemsPipeline(raw);

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(20);
    expect(result[0].paid_price).toBe(17.5);
    expect(result[0].total).toBe(40);
  });

  it("não define paid_price quando paidPrice está ausente (demais fluxos)", async () => {
    const raw: RawReceiptItem[] = [
      { name: "ARROZ 5KG", qty: "1", unit: "UN", unitPrice: "24,90", total: "24,90" },
    ];

    const result = await processItemsPipeline(raw);

    expect(result[0].price).toBe(24.9);
    expect(result[0].total).toBe(24.9);
    // Campo ausente, não undefined explícito com valor.
    expect(result[0]).not.toHaveProperty("paid_price");
  });

  it("ignora paidPrice vazio (trata como ausente)", async () => {
    const raw: RawReceiptItem[] = [
      { name: "FEIJAO 1KG", qty: "1", unit: "UN", unitPrice: "8,00", total: "8,00", paidPrice: "   " },
    ];

    const result = await processItemsPipeline(raw);

    expect(result[0]).not.toHaveProperty("paid_price");
  });

  it("preserva paid_price com peso fracionário (kg)", async () => {
    const raw: RawReceiptItem[] = [
      { name: "QUEIJO KG", qty: "0,434", unit: "KG", unitPrice: "32,90", total: "14,28", paidPrice: "29,93" },
    ];

    const result = await processItemsPipeline(raw);

    expect(result[0].quantity).toBeCloseTo(0.434, 3);
    expect(result[0].price).toBeCloseTo(32.9, 2);
    expect(result[0].paid_price).toBeCloseTo(29.93, 2);
  });
});
