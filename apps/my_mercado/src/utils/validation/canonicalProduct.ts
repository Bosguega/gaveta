import { z } from "zod";

const MAX_SLUG_LENGTH = 80;
const MAX_TEXT_LENGTH = 120;

function sanitizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function toCanonicalSlug(input: string): string {
  const raw = sanitizeText(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return raw
    .replace(/[\s\-\/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const createCanonicalProductSchema = z.object({
  slug: z
    .string()
    .transform((value) => toCanonicalSlug(value))
    .refine((value) => value.length >= 3, "Slug deve ter ao menos 3 caracteres.")
    .refine(
      (value) => value.length <= MAX_SLUG_LENGTH,
      `Slug deve ter no máximo ${MAX_SLUG_LENGTH} caracteres.`,
    )
    .refine(
      (value) => /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value),
      "Slug inválido. Use letras minúsculas, números e underscore.",
    ),
  name: z
    .string()
    .transform((value) => sanitizeText(value))
    .refine((value) => value.length >= 2, "Nome deve ter ao menos 2 caracteres.")
    .refine(
      (value) => value.length <= MAX_TEXT_LENGTH,
      `Nome deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`,
    ),
  category: z
    .string()
    .optional()
    .transform((value) => {
      const text = sanitizeText(value);
      return text || undefined;
    }),
  brand: z
    .string()
    .optional()
    .transform((value) => {
      const text = sanitizeText(value);
      return text || undefined;
    }),
});

const updateCanonicalProductSchema = z
  .object({
    name: z
      .string()
      .transform((value) => sanitizeText(value))
      .refine((value) => value.length >= 2, "Nome deve ter ao menos 2 caracteres.")
      .refine(
        (value) => value.length <= MAX_TEXT_LENGTH,
        `Nome deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`,
      )
      .optional(),
    category: z
      .string()
      .optional()
      .transform((value) => {
        const text = sanitizeText(value);
        return text || undefined;
      }),
    brand: z
      .string()
      .optional()
      .transform((value) => {
        const text = sanitizeText(value);
        return text || undefined;
      }),
  })
  .refine((value) => Boolean(value.name || value.category || value.brand), {
    message: "Informe ao menos um campo para atualizar.",
  });

type CreateCanonicalInput = z.input<typeof createCanonicalProductSchema>;
type UpdateCanonicalInput = z.input<typeof updateCanonicalProductSchema>;

export function parseCreateCanonicalProductInput(input: CreateCanonicalInput) {
  return createCanonicalProductSchema.parse(input);
}

export function parseUpdateCanonicalProductInput(input: UpdateCanonicalInput) {
  return updateCanonicalProductSchema.parse(input);
}
