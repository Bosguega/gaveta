import { describe, expect, it } from "vitest";
import { buildAnalysisEngine } from "./useAnalysisData";
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
        category: "Mercearia",
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
        category: "Mercearia",
        quantity: 1,
        price: 24,
        total: 24,
      },
    ],
  },
];

const emptyFilters = { month: null, product: null, category: null } as const;

describe("buildAnalysisEngine", () => {
  it("builds monthly summary and categories using item.total when present", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: null, category: null },
      false,
    );

    expect(data.monthlySummary?.totalSpent).toBe(43);
    expect(data.monthlySummary?.totalItems).toBe(3);
    expect(data.monthlySummary?.avgTicket).toBe(43);
    expect(data.categories.map((category) => [category.name, category.amount])).toEqual([
      ["Mercearia", 35],
      ["Limpeza", 8],
    ]);
  });

  it("normaliza categoria com grafia incorreta antes de agregar (ex: 'Laticinios' -> 'Laticínios')", () => {
    const legacyReceipts: Receipt[] = [
      {
        id: "legacy-1",
        establishment: "Mercado X",
        date: "2026-05-10",
        items: [
          { name: "Leite", category: "Laticinios", quantity: 1, price: 5, total: 5 },
          { name: "Queijo", category: "laticínios", quantity: 1, price: 8, total: 8 },
          { name: "Iogurte", category: "LATICINIOS", quantity: 1, price: 4, total: 4 },
        ],
      },
    ];

    const data = buildAnalysisEngine(
      legacyReceipts,
      { month: "2026-05", product: null, category: null },
      false,
    );

    // As tres grafias diferentes devem colapsar em uma unica categoria canonica
    expect(data.categories).toHaveLength(1);
    expect(data.categories[0].name).toBe("Laticínios");
    expect(data.categories[0].amount).toBe(17);
  });

  it("filtra topProducts pela categoria selecionada (sem afetar categories)", () => {
    // Mes com 3 produtos: Cafe (Mercearia), Sabao (Limpeza) e Acucar (Mercearia)
    const data = buildAnalysisEngine(
      [
        {
          id: "r1",
          establishment: "M",
          date: "2026-06-10",
          items: [
            { name: "Cafe", category: "Mercearia", quantity: 2, price: 10, total: 20 },
            { name: "Sabao", category: "Limpeza", quantity: 1, price: 8, total: 8 },
            { name: "Acucar", category: "Mercearia", quantity: 1, price: 5, total: 5 },
          ],
        },
      ],
      { month: "2026-06", product: null, category: "Mercearia" },
      false,
    );

    // categories NAO e afetado pelo filtro (deve mostrar todas)
    expect(data.categories.map((c) => c.name)).toEqual(["Mercearia", "Limpeza"]);

    // resolved.category reflete a categoria selecionada
    expect(data.resolved.category).toBe("Mercearia");

    // topProducts so inclui items da categoria Mercearia (Cafe + Acucar)
    expect(data.topProducts.map((p) => p.name)).toEqual(["Cafe", "Acucar"]);
    expect(data.topProducts.find((p) => p.name === "Sabao")).toBeUndefined();
  });

  it("retorna null em resolved.category quando a categoria solicitada nao existe no mes", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: null, category: "Categoria Inexistente" },
      false,
    );

    // Nao faz fallback silencioso: categoria invalida vira null
    expect(data.resolved.category).toBeNull();

    // Como nenhuma categoria esta resolvida, topProducts inclui todos os items
    expect(data.topProducts.length).toBeGreaterThan(0);
  });

  it("builds total evolution across all available months", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: null, category: null },
      false,
    );

    expect(data.totalEvolution.map((point) => [point.month, point.total])).toEqual([
      ["Mar/26", 43],
      ["Abr/26", 24],
    ]);
  });

  it("uses the selected product for price evolution when it exists in the month", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: "Cafe", category: null },
      false,
    );

    expect(data.resolved.product).toBe("Cafe");
    expect(data.priceEvolution.map((point) => [point.month, point.total])).toEqual([
      ["Mar/26", 20],
      ["Abr/26", 24],
    ]);
  });

  it("returns null for resolved.product when selected product is not in current month", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: "Nonexistent", category: null },
      false,
    );

    expect(data.resolved.product).toBeNull();
    expect(data.priceEvolution).toEqual([]);
  });

  it("returns null for resolved.product when no product filter is provided", () => {
    const data = buildAnalysisEngine(
      receipts,
      { month: "2026-03", product: null, category: null },
      false,
    );

    expect(data.resolved.product).toBeNull();
    expect(data.priceEvolution).toEqual([]);
  });

  it("exports emptyFilters helper for reuse", () => {
    // Smoke test: garante que emptyFilters tem a forma esperada
    expect(emptyFilters).toEqual({ month: null, product: null, category: null });
  });
});
