export interface AiNormalizationInput {
  key: string;
  raw: string;
}

export interface AiNormalizationResult {
  key: string;
  normalized_name: string;
  category: string;
  brand?: string;
  slug?: string;
  canonical_product_id?: string;
}
