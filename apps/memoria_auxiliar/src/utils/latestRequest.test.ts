import { describe, expect, it } from 'vitest';
import { createLatestRequestGate } from './latestRequest';

describe('createLatestRequestGate', () => {
  it('treats only the last started request as current', () => {
    const gate = createLatestRequestGate();

    const first = gate.begin();
    expect(gate.isCurrent(first)).toBe(true);

    const second = gate.begin();
    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);
  });

  it('lets a newer request supersede an older one still in flight', () => {
    const gate = createLatestRequestGate();

    const slow = gate.begin();
    const fast = gate.begin();

    expect(gate.isCurrent(slow)).toBe(false);
    expect(gate.isCurrent(fast)).toBe(true);
  });

  it('invalidates every previous token on repeated searches', () => {
    const gate = createLatestRequestGate();

    const tokens = [gate.begin(), gate.begin(), gate.begin()];

    expect(tokens.filter((token) => gate.isCurrent(token))).toEqual([tokens[2]]);
  });
});