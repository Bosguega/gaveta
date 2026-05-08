import { describe, expect, it } from "vitest";
import { applyReceiptFilters } from "./filters";
import type { Receipt } from "../types/domain";
import type { HistoryFilters } from "../types/ui";

function makeFilters(overrides?: Partial<HistoryFilters>): HistoryFilters {
  return {
    period: "all",
    sortBy: "date",
    sortOrder: "desc",
    startDate: "",
    endDate: "",
    ...overrides,
  };
}

const receipts: Receipt[] = [
  {
    id: "1",
    establishment: "Mercado Central",
    date: "10/03/2026",
    items: [{ name: "Arroz", quantity: 2, price: 10, total: 20 }],
  },
  {
    id: "2",
    establishment: "Super Bairro",
    date: "15/03/2026",
    items: [{ name: "Feijao", quantity: 1, price: 8, total: 8 }],
  },
  {
    id: "3",
    establishment: "Mercado Central",
    date: "20/03/2026",
    items: [{ name: "Cafe", quantity: 1, price: 25, total: 25 }],
  },
];

describe("applyReceiptFilters", () => {
  it("filters by establishment search term", () => {
    const result = applyReceiptFilters(receipts, "mercado", makeFilters());
    expect(result.totalCount).toBe(2);
    expect(result.items.map((r) => r.id)).toEqual(["3", "1"]);
  });

  it("sorts by value descending", () => {
    const result = applyReceiptFilters(
      receipts,
      "",
      makeFilters({ sortBy: "value", sortOrder: "desc" }),
    );
    expect(result.items.map((r) => r.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by store ascending", () => {
    const result = applyReceiptFilters(
      receipts,
      "",
      makeFilters({ sortBy: "store", sortOrder: "asc" }),
    );
    expect(result.items.map((r) => r.establishment)).toEqual([
      "Mercado Central",
      "Mercado Central",
      "Super Bairro",
    ]);
  });

  it("returns empty when custom period is invalid (start > end)", () => {
    const result = applyReceiptFilters(
      receipts,
      "",
      makeFilters({
        period: "custom",
        startDate: "2026-03-31",
        endDate: "2026-03-01",
      }),
    );

    expect(result.totalCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("does not truncate filtered receipts", () => {
    const largeList: Receipt[] = Array.from({ length: 60 }).map((_, idx) => ({
      id: `r-${idx}`,
      establishment: "Mercado Grande",
      date: "10/03/2026",
      items: [{ name: "Item", quantity: 1, price: 1, total: 1 }],
    }));

    const result = applyReceiptFilters(largeList, "", makeFilters());
    expect(result.totalCount).toBe(60);
    expect(result.items).toHaveLength(60);
  });
});
