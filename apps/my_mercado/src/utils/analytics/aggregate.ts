import type { Receipt, ReceiptItem } from "../../types/domain";

type ParseNumeric = (value: string | number | null | undefined) => number;

export function sumBy<T>(array: T[], fn: (item: T) => number): number {
  return array.reduce((acc, item) => acc + fn(item), 0);
}

export function calculateItemTotal(
  item: ReceiptItem,
  parseBRL: ParseNumeric,
): number {
  return parseBRL(item.price) * parseBRL(item.quantity || 1);
}

export function calculateReceiptTotal(
  receipt: Receipt | null | undefined,
  parseBRL: ParseNumeric,
): number {
  if (!receipt || !Array.isArray(receipt.items)) return 0;
  return receipt.items.reduce(
    (acc: number, item: ReceiptItem) => acc + calculateItemTotal(item, parseBRL),
    0
  );
}

export function calculateTotalSpent(
  receipts: Receipt[] | null | undefined,
  parseBRL: ParseNumeric,
): number {
  if (!Array.isArray(receipts)) return 0;
  return receipts.reduce(
    (acc, r) => acc + calculateReceiptTotal(r, parseBRL),
    0
  );
}
