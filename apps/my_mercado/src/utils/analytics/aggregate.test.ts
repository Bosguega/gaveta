import { describe, expect, it } from "vitest";
import { calculateItemTotal, calculateReceiptTotal, calculateTotalSpent } from "./aggregate";
import { parseBRL } from "../currency";
import type { Receipt, ReceiptItem } from "../../types/domain";

describe("analytics aggregate", () => {
  it("uses paid_price as priority over total", () => {
    const total = calculateItemTotal(
      { name: "Desconto", quantity: 2, price: 10, paid_price: 7, total: 20 },
      parseBRL,
    );

    expect(total).toBe(14); // 7 * 2
  });

  it("prioritizes item.total over price * quantity when paid_price is not edited", () => {
    const total = calculateItemTotal(
      { name: "Linguica", quantity: 0.47, price: 19.9, paid_price: 19.9, total: 9.39 },
      parseBRL,
    );

    // 19.9 * 0.47 = 9.353, mas o total original da nota (9.39) deve ser retornado
    expect(total).toBe(9.39);
  });

  it("preserva peso de 3 casas ao calcular item editado (0,434 kg)", () => {
    // Cenário real: 0,434 kg a R$ 32,90/kg com desconto de R$ 1,29
    // total bruto = 0,434 * 32,90 = 14,28; total pago = 12,99;
    // preço pago/kg = 12,99 / 0,434 = 29,93
    const item: ReceiptItem = {
      name: "Queijo",
      quantity: 0.434,
      unit: "KG",
      price: 32.9,
      total: 14.28,
      paid_price: 29.93,
    };

    // Editado (paid_price != price) => 29,93 * 0,434 = 12,98962
    // Se a quantidade fosse truncada para 0,43 o resultado seria 12,8699
    expect(calculateItemTotal(item, parseBRL)).toBeCloseTo(12.99, 2);
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
