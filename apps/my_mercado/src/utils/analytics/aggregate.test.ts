import { describe, expect, it } from "vitest";
import { calculateItemTotal, calculateReceiptTotal, calculateTotalSpent } from "./aggregate";
import { parseBRL } from "../currency";
import type { Receipt } from "../../types/domain";

describe("analytics aggregate", () => {
  it("uses item.total when present", () => {
    const total = calculateItemTotal(
      { name: "Promocao", quantity: 3, price: 10, total: 24 },
      parseBRL,
    );

    expect(total).toBe(24);
  });

  it("falls back to unit price times quantity", () => {
    const total = calculateItemTotal(
      { name: "Arroz", quantity: 2, price: 12 },
      parseBRL,
    );

    expect(total).toBe(24);
  });

  it("sums receipts with the same item total rule", () => {
    const receipts: Receipt[] = [
      {
        id: "1",
        establishment: "Mercado A",
        date: "2026-03-01",
        items: [{ name: "Cafe", quantity: 2, price: 20, total: 35 }],
      },
      {
        id: "2",
        establishment: "Mercado B",
        date: "2026-03-02",
        items: [{ name: "Leite", quantity: 3, price: 5 }],
      },
    ];

    expect(calculateReceiptTotal(receipts[0], parseBRL)).toBe(35);
    expect(calculateTotalSpent(receipts, parseBRL)).toBe(50);
  });
});
