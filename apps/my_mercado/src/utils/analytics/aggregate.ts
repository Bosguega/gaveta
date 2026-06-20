import type { Receipt, ReceiptItem } from "../../types/domain";

type ParseNumeric = (value: string | number | null | undefined) => number;

export function sumBy<T>(array: T[], fn: (item: T) => number): number {
  return array.reduce((acc, item) => acc + fn(item), 0);
}

export function calculateItemTotal(
  item: ReceiptItem,
  parseBRL: ParseNumeric,
): number {
  // Se o item foi editado (preço pago diferente do preço original), calculamos dinamicamente
  const isEdited = item.paid_price !== undefined && item.paid_price !== null &&
                   item.price !== undefined && item.price !== null &&
                   parseBRL(item.paid_price) !== parseBRL(item.price);

  if (isEdited) {
    return parseBRL(item.paid_price) * parseBRL(item.quantity ?? 1);
  }

  // Senão, prioridade máxima para o total original da nota
  if (item.total !== undefined && item.total !== null) {
    return parseBRL(item.total);
  }

  if (item.paid_price !== undefined && item.paid_price !== null) {
    return parseBRL(item.paid_price) * parseBRL(item.quantity ?? 1);
  }

  return parseBRL(item.price) * parseBRL(item.quantity ?? 1);
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
