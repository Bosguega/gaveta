import { describe, expect, it } from "vitest";
import { parseRawTextReceipt } from "./textParser";

const textoComItem = [
  "MERCADO TESTE",
  "PRODUTO A",
  "Qtde.: 2 UN: UN Vl. Unit.: 10,00",
  "20,00",
].join("\n");

describe("parseRawTextReceipt", () => {
  it("preenche total_discount quando o texto colado traz o campo de descontos", () => {
    const receipt = parseRawTextReceipt(`${textoComItem}\nDescontos R$ 5,20`);

    expect(receipt.total_discount).toBe(5.2);
    expect(receipt.items).toHaveLength(1);
    expect(receipt.establishment).toBe("MERCADO TESTE");
  });

  it("não define total_discount quando não há desconto no texto colado", () => {
    const receipt = parseRawTextReceipt(textoComItem);

    expect(receipt.total_discount).toBeUndefined();
  });

  it("aceita variações do rótulo de desconto (sem R$ e com dois pontos)", () => {
    const receipt = parseRawTextReceipt(`${textoComItem}\nDescontos: 3,00`);

    expect(receipt.total_discount).toBe(3);
  });
});
