/**
 * Cosine Similarity Utilities
 *
 * Funções para calcular similaridade entre vetores de embedding
 * e buscar notas por similaridade.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
        return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < a.length; index += 1) {
        dot += a[index] * b[index];
        normA += a[index] * a[index];
        normB += b[index] * b[index];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function parseEmbedding(value: string): number[] | null {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')) {
            return parsed;
        }
    } catch {
        return null;
    }

    return null;
}

export function searchBySimilarity(
    notes: Array<{ id: number; content: string; embedding: string; created_at: string }>,
    queryEmbedding: number[],
    limit = 5,
    baseThreshold = 0.5,
    queryLength = 0
): Array<{ note: { id: number; content: string; embedding: string; created_at: string }; score: number }> {
    // Dynamic threshold: lower for longer queries to allow more results
    const dynamicThreshold = Math.max(0.3, baseThreshold - (queryLength / 200) * 0.2);

    return notes
        .map((note) => {
            const embedding = parseEmbedding(note.embedding);
            return {
                note,
                score: embedding ? cosineSimilarity(embedding, queryEmbedding) : 0,
            };
        })
        .filter((result) => result.score >= dynamicThreshold)
        .sort((first, second) => second.score - first.score)
        .slice(0, limit);
}