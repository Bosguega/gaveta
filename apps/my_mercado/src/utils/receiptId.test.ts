import { describe, expect, it } from "vitest";
import {
  generateGalleryReceiptId,
  matchReceiptsByContent,
  findContentMatch,
} from "./receiptId";
import type { Receipt } from "../types/domain";

describe("generateGalleryReceiptId", () => {
  const establishment = "MERCADO EXEMPLO";
  const date = "10/09/2026 14:30:00";
  const items = [
    { name: "CAFE 500G", total: 20 },
    { name: "ARROZ 5KG", total: 24.9 },
  ];

  it("é estável para a mesma nota (re-escaneamento da mesma imagem)", async () => {
    const id1 = await generateGalleryReceiptId(establishment, date, items);
    const id2 = await generateGalleryReceiptId(establishment, date, [
      { name: "CAFE 500G", total: 20 },
      { name: "ARROZ 5KG", total: 24.9 },
    ]);
    expect(id1).toBe(id2);
    expect(id1.startsWith("img-")).toBe(true);
  });

  it("gera IDs diferentes para notas diferentes (data distinta)", async () => {
    const id1 = await generateGalleryReceiptId(establishment, date, items);
    const id2 = await generateGalleryReceiptId(establishment, "10/09/2026 18:30:00", items);
    expect(id1).not.toBe(id2);
  });

  it("gera IDs diferentes para estabelecimentos distintos", async () => {
    const id1 = await generateGalleryReceiptId("MERCADO A", date, items);
    const id2 = await generateGalleryReceiptId("MERCADO B", date, items);
    expect(id1).not.toBe(id2);
  });

  it("gera IDs diferentes quando os itens/totais diferem", async () => {
    const id1 = await generateGalleryReceiptId(establishment, date, items);
    const id2 = await generateGalleryReceiptId(establishment, date, [
      { name: "CAFE 500G", total: 20 },
      { name: "ARROZ 5KG", total: 25.5 },
    ]);
    expect(id1).not.toBe(id2);
  });
});

describe("matchReceiptsByContent (cruzamento entre fontes)", () => {
  const baseGallery: Receipt = {
    id: "img-abc",
    establishment: "Supermercado Exemplo LTDA",
    date: "10/09/2026 14:30:00",
    source: "gallery",
    items: [
      { name: "Café 500g", quantity: 1, price: 20, total: 20 },
      { name: "Arroz 5kg", quantity: 1, price: 24.9, total: 24.9 },
    ],
  };

  const existingQr: Receipt = {
    id: "chave-sefaz-123",
    establishment: "SUPERMERCADO EXEMPLO LTDA",
    date: "10/09/2026 14:31:00",
    items: [
      { name: "CAFE 500G", quantity: 1, price: 20, total: 20 },
      { name: "ARROZ 5KG", quantity: 1, price: 24.9, total: 24.9 },
    ],
  };

  it("corresponde exatamente apesar de fonte/caixa/acentos diferentes", () => {
    expect(matchReceiptsByContent(baseGallery, existingQr)).toBe("exact");
  });

  it("não corresponde quando o estabelecimento difere", () => {
    const other = { ...existingQr, establishment: "OUTRO MERCADO" };
    expect(matchReceiptsByContent(baseGallery, other)).toBeNull();
  });

  it("não corresponde quando o total está fora da tolerância", () => {
    const other = {
      ...existingQr,
      items: [{ name: "CAFE 500G", quantity: 1, price: 99, total: 99 }],
    };
    expect(matchReceiptsByContent(baseGallery, other)).toBeNull();
  });

  it("aceita total dentro da tolerância de R$ 0,02", () => {
    const other = {
      ...existingQr,
      items: [
        { name: "CAFE 500G", quantity: 1, price: 20, total: 20.01 },
        { name: "ARROZ 5KG", quantity: 1, price: 24.9, total: 24.9 },
      ],
    };
    // total = 44,91 vs 44,90 -> dif 0,01 <= 0,02
    expect(matchReceiptsByContent(baseGallery, other)).toBe("exact");
  });

  it("marca provável quando data está fora da janela mas há evidências", () => {
    const other = {
      ...existingQr,
      date: "10/09/2026 20:00:00", // horas de diferença
    };
    expect(matchReceiptsByContent(baseGallery, other)).toBe("probable");
  });

  it("trata nota sem horário sem gerar falso negativo", () => {
    const candidateNoTime = { ...baseGallery, date: "10/09/2026 00:00:00" };
    const existingNoTime = { ...existingQr, date: "10/09/2026 00:00:00" };
    expect(matchReceiptsByContent(candidateNoTime, existingNoTime)).toBe("exact");
  });

  it("não corresponde apenas por total igual sem evidências (estabelecimento igual, itens totally distintos e data distante)", () => {
    const candidate: Receipt = {
      id: "img-x",
      establishment: "MERCADO A",
      date: "01/01/2026 10:00:00",
      items: [{ name: "ITEM UM", quantity: 1, price: 10, total: 10 }],
    };
    const existing: Receipt = {
      id: "qr-y",
      establishment: "MERCADO A",
      date: "05/06/2026 22:00:00", // muito distante
      items: [{ name: "ITEM DOIS", quantity: 1, price: 10, total: 10 }], // mesmo total, 1 item
    };
    // mesmo total + mesma contagem de itens => "probable" (evidência de contagem),
    // mas NUNCA "exact". Confirma que data distante não vira exata.
    expect(matchReceiptsByContent(candidate, existing)).toBe("probable");
  });

  it("findContentMatch prioriza exact sobre probable", () => {
    const probableOne = { ...existingQr, id: "qr-prob", date: "10/09/2026 23:00:00" };
    const exactOne = { ...existingQr, id: "qr-exact", date: "10/09/2026 14:31:00" };
    const result = findContentMatch(baseGallery, [probableOne, exactOne]);
    expect(result?.level).toBe("exact");
    expect(result?.receipt.id).toBe("qr-exact");
  });

  it("findContentMatch ignora o próprio candidato por id", () => {
    const result = findContentMatch(baseGallery, [baseGallery, existingQr]);
    expect(result?.receipt.id).toBe("chave-sefaz-123");
  });
});
