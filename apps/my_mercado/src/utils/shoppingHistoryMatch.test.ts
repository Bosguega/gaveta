import { describe, expect, it } from "vitest";
import { scoreHistoryKeyMatch } from "./shoppingHistoryMatch";

describe("shoppingHistoryMatch", () => {
  it("matches close names by token overlap", () => {
    const result = scoreHistoryKeyMatch(
      "ALIMENTO PARA GATOS FRISKIES SACHE 85G",
      "RACAO GATOS FRISKIES SACHE 85 G",
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it("does not match unrelated items", () => {
    const result = scoreHistoryKeyMatch(
      "MANGA TOMMY",
      "REFRIGERANTE COLA 2L",
    );
    expect(result.score).toBe(0);
  });

  it("matches short query with one strong shared token", () => {
    const result = scoreHistoryKeyMatch(
      "MANGA TOMMY",
      "MANGA PALMER",
    );
    expect(result.score).toBeGreaterThan(0);
  });

  it("does not match short query against processed product with many extra tokens", () => {
    const result = scoreHistoryKeyMatch(
      "MANGA TOMMY",
      "REFRESCO MID MANGA 20G",
    );
    expect(result.score).toBe(0);
  });
});
