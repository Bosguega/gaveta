import { normalizeKey } from "./normalize";

const STOP_TOKENS = new Set([
  "DE",
  "DA",
  "DO",
  "DOS",
  "DAS",
  "PARA",
  "COM",
  "SEM",
  "E",
  "EM",
  "NO",
  "NA",
  "NOS",
  "NAS",
  "UN",
  "UND",
  "KG",
  "G",
  "GR",
  "ML",
  "L",
]);

function toTokens(input: string): string[] {
  return normalizeKey(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_TOKENS.has(token));
}

function overlapCount(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  let count = 0;
  for (const token of a) {
    if (bSet.has(token)) count += 1;
  }
  return count;
}

function isMeasureToken(token: string): boolean {
  return /^\d+([.,]\d+)?(G|KG|ML|L|UN)?$/.test(token);
}

export type KeyMatchScore = {
  score: number;
  includes: boolean;
  overlap: number;
  overlapRatio: number;
};

export function scoreHistoryKeyMatch(queryKey: string, candidateKey: string): KeyMatchScore {
  const normalizedQuery = normalizeKey(queryKey);
  const normalizedCandidate = normalizeKey(candidateKey);
  if (!normalizedQuery || !normalizedCandidate) {
    return { score: 0, includes: false, overlap: 0, overlapRatio: 0 };
  }

  if (normalizedQuery === normalizedCandidate) {
    return { score: 1000, includes: true, overlap: 999, overlapRatio: 1 };
  }

  const includes =
    normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate);
  const queryTokens = toTokens(normalizedQuery);
  const candidateTokens = toTokens(normalizedCandidate);
  const overlap = overlapCount(queryTokens, candidateTokens);
  const overlapRatio = queryTokens.length > 0 ? overlap / queryTokens.length : 0;

  if (!includes && overlap === 0) {
    return { score: 0, includes: false, overlap: 0, overlapRatio: 0 };
  }

  if (!includes && overlap === 1 && queryTokens.length <= 2) {
    const candidateTokenSet = new Set(candidateTokens);
    const matchedToken = queryTokens.find((token) => candidateTokenSet.has(token));
    if (matchedToken && matchedToken.length >= 5) {
      const candidateExtraTokens = candidateTokens.filter(
        (token) => token !== matchedToken && !isMeasureToken(token),
      );
      if (candidateExtraTokens.length > 1) {
        return { score: 0, includes: false, overlap, overlapRatio };
      }
      const score = 16 + overlapRatio * 18;
      return { score, includes: false, overlap, overlapRatio };
    }
  }

  if (!includes && overlap < 2 && overlapRatio < 0.55) {
    return { score: 0, includes: false, overlap, overlapRatio };
  }

  const score = (includes ? 80 : 0) + overlap * 12 + overlapRatio * 25;
  return { score, includes, overlap, overlapRatio };
}
