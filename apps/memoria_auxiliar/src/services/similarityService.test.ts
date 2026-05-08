import { describe, expect, it } from 'vitest';
import type { Note } from '../types';
import { cosineSimilarity, searchBySimilarity } from './similarityService';

function note(id: number, embedding: string): Note {
  return {
    id,
    content: `nota ${id}`,
    embedding,
    created_at: '2026-05-05T00:00:00Z',
  };
}

describe('cosineSimilarity', () => {
  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for incompatible lengths', () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
  });

  it('scores identical vectors as 1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  it('scores opposite vectors as -1', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('scores orthogonal vectors as 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('scores between -1 and 1 for partial similarity', () => {
    const score = cosineSimilarity([1, 0], [0.5, 0.5]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0 if one vector is zero', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
  });

  it('handles higher dimensional vectors', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('scores dissimilar vectors as negative', () => {
    const score = cosineSimilarity([1, 2, 3], [-1, -2, -3]);
    expect(score).toBeLessThan(0);
  });
});

describe('searchBySimilarity', () => {
  it('skips invalid embeddings without throwing', () => {
    const results = searchBySimilarity(
      [note(1, '[1,0]'), note(2, 'invalid-json'), note(3, '[0,1]')],
      [1, 0],
      5,
      0.1,
    );

    expect(results.map((result) => result.note.id)).toEqual([1]);
  });

  it('returns results ordered by descending score', () => {
    const results = searchBySimilarity(
      [note(1, '[1,0]'), note(2, '[0.9,0.1]'), note(3, '[0.5,0.5]')],
      [1, 0],
      5,
      0.3,
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('respects limit parameter', () => {
    const results = searchBySimilarity(
      [note(1, '[1,0]'), note(2, '[0.9,0.1]'), note(3, '[0.8,0.2]')],
      [1, 0],
      2,
      0.1,
    );

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns empty when no results pass threshold', () => {
    const results = searchBySimilarity(
      [note(1, '[1,0]')],
      [0, 1],
      5,
      0.9,
    );

    expect(results).toHaveLength(0);
  });

  it('handles empty notes array', () => {
    const results = searchBySimilarity([], [1, 0], 5, 0.1);
    expect(results).toHaveLength(0);
  });

  it('applies dynamic threshold for longer queries', () => {
    const resultsStandard = searchBySimilarity(
      [note(1, '[0.5,0.5]'), note(2, '[0.4,0.6]')],
      [1, 0],
      5,
      0.5,
      10,
    );

    // 200 character query should lower threshold
    const resultsLong = searchBySimilarity(
      [note(1, '[0.5,0.5]'), note(2, '[0.4,0.6]')],
      [1, 0],
      5,
      0.5,
      200,
    );

    expect(resultsLong.length).toBeGreaterThanOrEqual(resultsStandard.length);
  });
});