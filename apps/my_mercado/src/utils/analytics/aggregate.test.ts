import { describe, expect, it } from "vitest";
import { calculateItemTotal, calculateReceiptTotal, calculateTotalSpent } from "./aggregate";
import { parseBRL } from "../currency";
import type { Receipt } from "../../types/domain";

describe("analytics aggregate", () => {
  it("uses paid_price as priority over total", () => {
    const total = calculateItemTotal(
      { name: "Desconto", quantity: 2, price: 10, paid_price: 7, total: 20 },
      parseBRL,
    );

    expect(total).toBe(14); // 7 * 2
  });

  it("uses item.total when paid_price is absent", () => {
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

  it("sums receipts using paid_price when present", () => {
    const receipts: Receipt[] = [
      {
        id: "1",
        establishment: "Mercado A",
        date: "2026-03-01",
        items: [{ name: "Cafe", quantity: 2, price: 20, paid_price: 17.5, total: 35 }],
      },
      {
        id: "2",
        establishment: "Mercado B",
        date: "2026-03-02",
        items: [{ name: "Leite", quantity: 3, price: 5 }],
      },
    ];

    // paid_price * quantity = 17.5 * 2 = 35
    expect(calculateReceiptTotal(receipts[0], parseBRL)).toBe(35);
    // receipt 1: 35, receipt 2: 3 * 5 = 15 => total 50
    expect(calculateTotalSpent(receipts, parseBRL)).toBe(50);
  });
});
