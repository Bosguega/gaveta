import { describe, expect, it } from "vitest";
import { parseRawTextReceipt } from "./textParser";

const textoComItens = [
  "MERCADO TESTE",
  "PRODUTO A",
  "Qtde.: 2 UN: UN Vl. Unit.: 10,00",
  "20,00",
  "PRODUTO B",
  "Qtde.: 1 UN: UN Vl. Unit.: 5,50",
  "5,50",
].join("\n");

describe("parseRawTextReceipt", () => {
  it("extrai estabelecimento, data, itens e total_discount do texto colado", async () => {
    const receipt = await parseRawTextReceipt(
      `${textoComItens}\nDescontos R$ 3,20`,
    );

    expect(receipt.establishment).toBe("MERCADO TESTE");
    expect(receipt.items).toHaveLength(2);
    expect(receipt.items[0].name).toBe("PRODUTO A");
    expect(receipt.items[0].price).toBe(10);
    expect(receipt.items[0].total).toBe(20);
    expect(receipt.total_discount).toBe(3.2);
  });

  it("ignora cabeçalho NFC-e / DOCUMENTO AUXILIAR e extrai o nome do estabelecimento", async () => {
    const textoComCabecalho = [
      "NFC-e",
      "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA",
      "",
      "R. de D. Zeferino LTDA",
      "CNPJ: 67.228.536/0001-30",
      "BOLO CENOURA Kg (Código: 448)",
      "Qtde.:0,404   UN: KG   Vl. Unit.:   32,9 	Vl. Total",
      "13,29",
    ].join("\n");

    const receipt = await parseRawTextReceipt(textoComCabecalho);

    expect(receipt.establishment).toBe("R. de D. Zeferino LTDA");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].name).toBe("BOLO CENOURA Kg");
  });

  it("não define total_discount quando não há desconto no texto", async () => {
    const receipt = await parseRawTextReceipt(textoComItens);

    expect(receipt.total_discount).toBeUndefined();
  });

  it("define source como 'text'", async () => {
    const receipt = await parseRawTextReceipt(textoComItens);
    expect(receipt.source).toBe("text");
  });

  it("usa identificadores oficiais (número/série/protocolo) quando disponíveis", async () => {
    const textoComMetadados = [
      textoComItens,
      "Número: 123 Série: 1",
      "Protocolo de Autorização: 987654321",
    ].join("\n");

    const receipt = await parseRawTextReceipt(textoComMetadados);

    expect(receipt.id).toBe("pasted-123-1-987654321");
  });

  it("gera ID determinístico via fingerprint quando não há identificador oficial", async () => {
    const receipt1 = await parseRawTextReceipt(textoComItens);
    const receipt2 = await parseRawTextReceipt(textoComItens);

    expect(receipt1.id).toBe(receipt2.id);
    expect(receipt1.id.startsWith("text-")).toBe(true);
  });

  it("gera IDs diferentes para textos com itens diferentes", async () => {
    const textoOutro = [
      "MERCADO TESTE",
      "PRODUTO C",
      "Qtde.: 1 UN: UN Vl. Unit.: 50,00",
      "50,00",
    ].join("\n");

    const receipt1 = await parseRawTextReceipt(textoComItens);
    const receipt2 = await parseRawTextReceipt(textoOutro);

    expect(receipt1.id).not.toBe(receipt2.id);
  });

  it("lança erro quando não encontra itens no texto", async () => {
    await expect(
      parseRawTextReceipt("texto sem itens validos"),
    ).rejects.toThrow("Não foi possível encontrar itens no texto fornecido");
  });
});
