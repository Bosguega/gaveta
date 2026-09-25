/**
 * Testes para formatadores de quantidade/quantidade (format.ts)
 */

import { describe, it, expect } from "vitest";
import { parseQuantity, formatQuantity } from "./format";

describe("format utils", () => {
  describe("parseQuantity", () => {
    it("preserva a precisão de pesos com 3 casas decimais (pt-BR)", () => {
      expect(parseQuantity("0,434")).toBe(0.434);
      expect(parseQuantity("0,472")).toBe(0.472);
      expect(parseQuantity("1,250")).toBe(1.25);
    });

    it("preserva a precisão em formato decimal (en-US)", () => {
      expect(parseQuantity("0.434")).toBe(0.434);
      expect(parseQuantity("2.5")).toBe(2.5);
    });

    it("lida com separador de milhar pt-BR", () => {
      expect(parseQuantity("1.250,5")).toBe(1250.5);
      expect(parseQuantity("1,250.5")).toBe(1250.5);
    });

    it("aceita números diretamente sem truncar", () => {
      expect(parseQuantity(0.434)).toBe(0.434);
      expect(parseQuantity(3)).toBe(3);
    });

    it("usa o fallback para valores vazios ou inválidos", () => {
      expect(parseQuantity("")).toBe(1);
      expect(parseQuantity(null)).toBe(1);
      expect(parseQuantity(undefined)).toBe(1);
      expect(parseQuantity("invalid")).toBe(1);
      expect(parseQuantity("0,434", 0)).toBe(0.434);
      expect(parseQuantity("", 2)).toBe(2);
    });
  });

  describe("formatQuantity", () => {
    it("formata pesos preservando casas significativas", () => {
      expect(formatQuantity(0.434)).toBe("0,434");
      expect(formatQuantity(0.472)).toBe("0,472");
      expect(formatQuantity(1.5)).toBe("1,5");
      expect(formatQuantity(3)).toBe("3");
    });

    it("usa '1' como padrão para valores nulos", () => {
      expect(formatQuantity(null)).toBe("1");
      expect(formatQuantity(undefined)).toBe("1");
    });
  });
});
