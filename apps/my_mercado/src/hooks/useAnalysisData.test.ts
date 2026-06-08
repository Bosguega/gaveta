import { describe, expect, it } from "vitest";
import { buildAnalysisData } from "./useAnalysisData";
import type { Receipt } from "../types/domain";

const receipts: Receipt[] = [
  {
    id: "1",
    establishment: "Mercado Central",
    date: "2026-03-10",
    items: [
      {
        name: "Cafe Especial",
        normalized_name: "Cafe",
        category: "Alimentos",
        quantity: 2,
        price: 20,
        total: 35,
      },
      {
        name: "Sabao",
        category: "Limpeza",
        quantity: 1,
        price: 8,
      },
    ],
  },
  {
    id: "2",
    establishment: "Mercado Bairro",
    date: "2026-04-10",
    items: [
      {
        name: "Cafe Tradicional",
        normalized_name: "Cafe",
        category: "Alimentos",
        quantity: 1,
        price: 24,
        total: 24,
      },
    ],
  },
];

describe("buildAnalysisData", () => {
  it("builds monthly summary and categories using item.total when present", () => {
    const data = buildAnalysisData(receipts, "2026-03");

    expect(data.monthlySummary?.totalSpent).toBe(43);
    expect(data.monthlySummary?.totalItems).toBe(3);
    expect(data.monthlySummary?.avgTicket).toBe(43);
    expect(data.categories.map((category) => [category.name, category.amount])).toEqual([
      ["Alimentos", 35],
      ["Limpeza", 8],
    ]);
  });

  it("builds total evolution across all available months", () => {
    const data = buildAnalysisData(receipts, "2026-03");

    expect(data.totalEvolution.map((point) => [point.month, point.total])).toEqual([
      ["Mar/26", 43],
      ["Abr/26", 24],
    ]);
  });

  it("uses the most frequent selected-month product for price evolution", () => {
    const data = buildAnalysisData(receipts, "2026-03");

    expect(data.priceEvolutionProduct).toBe("Cafe");
    expect(data.priceEvolution.map((point) => [point.month, point.total])).toEqual([
      ["Mar/26", 20],
      ["Abr/26", 24],
    ]);
  });
});
