export interface AiNormalizationInput {
  key: string;
  raw: string;
}

export interface AiNormalizationResult {
  key: string;
  normalized_name: string;
  category: string;
}
