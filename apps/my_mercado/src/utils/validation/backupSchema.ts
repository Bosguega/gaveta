import { z } from "zod";

const backupItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  normalized_key: z.string().optional(),
  normalized_name: z.string().optional(),
  category: z.string().optional(),
  canonical_product_id: z.string().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().optional(),
  price: z.number().nonnegative(),
  total: z.number().nonnegative().optional(),
});

const backupReceiptSchema = z.object({
  id: z.string().min(1),
  establishment: z.string().min(1),
  date: z.string().min(1),
  items: z.array(backupItemSchema).default([]),
  created_at: z.string().optional(),
});

export const backupSchema = z.object({
  version: z.string().optional(),
  exportDate: z.string().optional(),
  totalReceipts: z.number().int().nonnegative().optional(),
  receipts: z.array(backupReceiptSchema),
});

export type BackupPayload = z.infer<typeof backupSchema>;

type ParseBackupResult =
  | { ok: true; data: BackupPayload }
  | { ok: false; error: string };

export function parseBackupJson(rawJson: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: "JSON inválido. Verifique o arquivo de backup." };
  }

  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: "Arquivo de backup inválido ou corrompido.",
    };
  }

  return { ok: true, data: result.data };
}
