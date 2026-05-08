/**
 * Validações de Formulário com Zod
 *
 * Validações type-safe para formulários do app.
 * @see https://zod.dev/
 */

import { z } from "zod";

// ==============================
// SCHEMAS
// ==============================

/**
 * Schema para item individual de receita
 */
export const receiptItemSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do produto é obrigatório")
    .max(200, "Nome muito longo (máx 200 caracteres)"),
  qty: z
    .string()
    .optional()
    .default("1")
    .transform((val) => {
      const num = parseFloat(val.replace(",", "."));
      return isNaN(num) || num < 0 ? 0 : num;
    }),
  unitPrice: z
    .string()
    .min(1, "Preço é obrigatório")
    .regex(/^\d+[.,]?\d*$/, "Preço inválido! Use apenas números")
    .transform((val) => {
      const num = parseFloat(val.replace(",", "."));
      return isNaN(num) || num < 0 ? 0 : num;
    }),
  unit: z.string().optional().default("UN"),
});

/**
 * Schema para receita completa
 */
export const receiptSchema = z.object({
  id: z.string().optional(),
  establishment: z
    .string()
    .min(1, "Nome do mercado é obrigatório")
    .max(100, "Nome muito longo (máx 100 caracteres)")
    .transform((val) => val.trim()),
  date: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data inválida! Use DD/MM/AAAA")
    .transform((val) => {
      const [dd, mm, yyyy] = val.split("/");
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      return date;
    }),
  items: z
    .array(receiptItemSchema)
    .min(1, "Adicione pelo menos um item")
    .max(500, "Muitos itens (máx 500)"),
});

/**
 * Schema para entrada manual de item
 */
export const manualItemSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome muito longo"),
  qty: z
    .string()
    .optional()
    .default("1")
    .refine((val) => /^\d*[.,]?\d*$/.test(val), "Quantidade inválida"),
  unitPrice: z
    .string()
    .min(1, "Preço é obrigatório")
    .refine((val) => /^\d+[.,]?\d*$/.test(val), "Preço inválido! Use apenas números"),
});

/**
 * Schema para formulário de receita manual
 */
export const manualReceiptFormSchema = z.object({
  establishment: z
    .string()
    .min(1, "Nome do mercado é obrigatório")
    .max(100, "Nome muito longo")
    .transform((val) => val.trim()),
  date: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data inválida! Use DD/MM/AAAA"),
  items: z
    .array(manualItemSchema)
    .min(1, "Adicione pelo menos um item"),
});

/**
 * Schema para entrada de URL de NFC-e
 */
export const nfcUrlSchema = z
  .string()
  .min(1, "URL é obrigatória")
  .url("URL inválida! Deve começar com http:// ou https://")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Protocolo inválido! Use http:// ou https://" }
  );

/**
 * Schema para configuração de API Key
 */
export const apiKeySchema = z
  .string()
  .min(1, "API Key é obrigatória")
  .refine(
    (key) => {
      const trimmed = key.trim();
      return (
        trimmed.startsWith("AIza") || // Google
        trimmed.startsWith("sk-") || // OpenAI
        trimmed.startsWith("sk_") // OpenAI alternativo
      );
    },
    {
      message:
        "API Key inválida! Deve começar com 'AIza' (Google) ou 'sk-' (OpenAI)",
    }
  );

// ==============================
// TYPES INFERRED
// ==============================

export type ReceiptItemInput = z.infer<typeof receiptItemSchema>;
export type ReceiptInput = z.infer<typeof receiptSchema>;
export type ManualItemInput = z.infer<typeof manualItemSchema>;
export type ManualReceiptFormInput = z.infer<typeof manualReceiptFormSchema>;
export type NfcUrlInput = z.infer<typeof nfcUrlSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;

// ==============================
// VALIDATION HELPERS
// ==============================

/**
 * Valida um item de receita
 */
export function validateReceiptItem(
  data: unknown
): { success: true; data: ReceiptItemInput } | { success: false; error: string } {
  const result = receiptItemSchema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0]?.message || "Erro de validação";
    return { success: false, error: firstError };
  }

  return { success: true, data: result.data };
}

/**
 * Valida formulário de receita manual
 */
export function validateManualReceiptForm(
  data: unknown
): {
  success: true;
  data: ManualReceiptFormInput;
} | { success: false; errors: string[] } {
  const result = manualReceiptFormSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map((e) => e.message);
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}

/**
 * Valida URL de NFC-e
 */
export function validateNfcUrl(
  url: string
): { success: true; data: string } | { success: false; error: string } {
  const result = nfcUrlSchema.safeParse(url);

  if (!result.success) {
    const firstError = result.error.issues[0]?.message || "URL inválida";
    return { success: false, error: firstError };
  }

  return { success: true, data: result.data };
}

/**
 * Valida API Key
 */
export function validateApiKey(
  key: string
): { success: true; data: string } | { success: false; error: string } {
  const result = apiKeySchema.safeParse(key);

  if (!result.success) {
    const firstError = result.error.issues[0]?.message || "API Key inválida";
    return { success: false, error: firstError };
  }

  return { success: true, data: result.data };
}

/**
 * Valida item individual avulso
 */
export function validateManualItem(
  data: unknown
): { success: true; data: ManualItemInput } | { success: false; error: string } {
  const result = manualItemSchema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0]?.message || "Erro de validação";
    return { success: false, error: firstError };
  }

  return { success: true, data: result.data };
}

// ==============================
// UTILS
// ==============================

/**
 * Extrai erros de validação formatados
 */
export function getValidationErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  error.issues.forEach((err) => {
    const path = err.path.join(".");
    if (path && !errors[path]) {
      errors[path] = err.message;
    }
  });

  return errors;
}

/**
 * Parse seguro com fallback para valores padrão
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : fallback;
}
