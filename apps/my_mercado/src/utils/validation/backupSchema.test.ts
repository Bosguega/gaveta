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

  it("preserves NFC-e QR URLs and discount fields from backups", () => {
    const json = JSON.stringify({
      receipts: [
        {
          id: "r2",
          establishment: "Mercado Teste",
          date: "01/04/2026 10:00:00",
          total_discount: 5,
          nfce_qr_url: "https://www.fazenda.sp.gov.br/nfce",
          items: [
            {
              name: "Arroz",
              quantity: 1,
              price: 10,
              paid_price: 8,
              total: 10,
            },
          ],
        },
      ],
    });

    const result = parseBackupJson(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.receipts[0].nfce_qr_url).toBe("https://www.fazenda.sp.gov.br/nfce");
    expect(result.data.receipts[0].total_discount).toBe(5);
    expect(result.data.receipts[0].items[0].paid_price).toBe(8);
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
