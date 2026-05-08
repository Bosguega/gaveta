import { describe, expect, it } from "vitest";
import { parseBackupJson } from "./backupSchema";

describe("parseBackupJson", () => {
  it("parses a valid backup payload", () => {
    const json = JSON.stringify({
      version: "1.0",
      exportDate: "2026-04-01T00:00:00.000Z",
      totalReceipts: 1,
      receipts: [
        {
          id: "r1",
          establishment: "Mercado Teste",
          date: "01/04/2026",
          items: [
            {
              name: "Arroz",
              quantity: 1,
              price: 10,
              total: 10,
              unit: "UN",
            },
          ],
        },
      ],
    });

    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.receipts).toHaveLength(1);
    expect(result.data.receipts[0].items[0].name).toBe("Arroz");
  });

  it("rejects invalid JSON", () => {
    const result = parseBackupJson("{invalid");
    expect(result).toEqual({
      ok: false,
      error: "JSON inválido. Verifique o arquivo de backup.",
    });
  });

  it("rejects payload with invalid shape", () => {
    const json = JSON.stringify({
      receipts: [
        {
          id: "r1",
          establishment: "Mercado Teste",
          date: "01/04/2026",
          items: [
            {
              name: "Arroz",
              quantity: "1",
              price: 10,
            },
          ],
        },
      ],
    });

    const result = parseBackupJson(json);
    expect(result).toEqual({
      ok: false,
      error: "Arquivo de backup inválido ou corrompido.",
    });
  });
});
