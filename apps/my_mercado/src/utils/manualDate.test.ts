import { describe, expect, it } from "vitest";
import {
  brDateToIsoDatePart,
  buildDefaultManualDate,
  isoDateToBrPreservingTime,
} from "./manualDate";
import { validateManualReceiptForm } from "./validation";

describe("manualDate", () => {
  it("não inventa data quando o BR está vazio ou inválido", () => {
    expect(brDateToIsoDatePart("")).toBe("");
    expect(brDateToIsoDatePart("invalida")).toBe("");
    expect(brDateToIsoDatePart("31/02/2026")).toBe("");
  });

  it("converte BR válido para parte ISO", () => {
    expect(brDateToIsoDatePart("05/10/2026 14:30:00")).toBe("2026-10-05");
    expect(brDateToIsoDatePart("05/10/2026")).toBe("2026-10-05");
  });

  it("preserva a hora ao converter ISO para BR", () => {
    expect(isoDateToBrPreservingTime("2026-10-06", "05/10/2026 14:30:00")).toBe(
      "06/10/2026 14:30:00"
    );
  });

  it("ignora ISO intermediário vazio/inválido sem zerar a data", () => {
    expect(isoDateToBrPreservingTime("", "05/10/2026 14:30:00")).toBe("");
    expect(isoDateToBrPreservingTime("2026-13-40", "05/10/2026")).toBe("");
  });

  it("gera default válido para o schema do formulário manual", () => {
    const date = buildDefaultManualDate(new Date(2026, 9, 14, 8, 5, 9));
    expect(date).toBe("14/10/2026 08:05:09");
    const validation = validateManualReceiptForm({
      establishment: "Mercado",
      date,
      items: [{ name: "Arroz", qty: "1", unitPrice: "5,00" }],
    });
    expect(validation.success).toBe(true);
  });

  it("simula troca de dia e depois de mês preservando o dia", () => {
    let storeDate = "14/10/2026 08:05:09";
    // Usuário troca o dia para 05
    storeDate = isoDateToBrPreservingTime("2026-10-05", storeDate);
    expect(storeDate).toBe("05/10/2026 08:05:09");
    // Usuário troca o mês para 09 (o input emite a data completa com o dia já alterado)
    storeDate = isoDateToBrPreservingTime("2026-09-05", storeDate);
    expect(storeDate).toBe("05/09/2026 08:05:09");
  });
});
