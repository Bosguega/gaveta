import { describe, it, expect, beforeEach } from "vitest";
import {
  generateId,
  generateUserScopedReceiptId,
  generateShoppingListId,
  generateCanonicalProductId,
  generateDictionaryEntryId,
  generateShareCode,
} from "./idGenerator";

describe("idGenerator", () => {
  beforeEach(() => {
    // Reset any internal state if needed
  });

  describe("generateId", () => {
    it("deve gerar um ID unico", () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it("deve gerar IDs no formato esperado", () => {
      const id = generateId();

      // Deve ser uma string não vazia
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe("generateUserScopedReceiptId", () => {
    it("deve gerar um ID scoped por usuario", () => {
      const userId = "user-123";
      const receiptId = generateUserScopedReceiptId(userId, "receipt-456");

      expect(receiptId).toContain(userId);
      expect(receiptId).toContain("receipt-456");
    });

    it("deve gerar um ID sem rawReceiptId se nao fornecido", () => {
      const userId = "user-123";
      const receiptId = generateUserScopedReceiptId(userId);

      expect(receiptId).toContain(userId);
      expect(receiptId).toMatch(/^receipt_/);
    });
  });

  // generateManualReceiptId foi removido deste arquivo e movido para utils/receiptId.ts
  // Testes para essa função estão em receiptId.test.ts (se existir)

  describe("generateShoppingListId", () => {
    it("deve gerar um ID para lista de compras", () => {
      const id = generateShoppingListId();

      expect(id).toMatch(/^list_/);
    });

    it("deve gerar IDs unicos", () => {
      const id1 = generateShoppingListId();
      const id2 = generateShoppingListId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateCanonicalProductId", () => {
    it("deve gerar um ID para produto canonico", () => {
      const id = generateCanonicalProductId();

      expect(id).toMatch(/^canonical_/);
    });

    it("deve gerar IDs unicos", () => {
      const id1 = generateCanonicalProductId();
      const id2 = generateCanonicalProductId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateDictionaryEntryId", () => {
    it("deve gerar um ID para entrada do dicionario", () => {
      const id = generateDictionaryEntryId();

      expect(id).toMatch(/^dict_/);
    });

    it("deve gerar IDs unicos", () => {
      const id1 = generateDictionaryEntryId();
      const id2 = generateDictionaryEntryId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateShareCode", () => {
    it("deve gerar um codigo de 6 caracteres", () => {
      const code = generateShareCode();

      expect(code).toHaveLength(6);
    });

    it("deve gerar codigos unicos", () => {
      const code1 = generateShareCode();
      const code2 = generateShareCode();

      expect(code1).not.toBe(code2);
    });

    it("deve conter apenas caracteres validos (sem I, O, 0, 1)", () => {
      const code = generateShareCode();

      expect(code).not.toContain("I");
      expect(code).not.toContain("O");
      expect(code).not.toContain("0");
      expect(code).not.toContain("1");
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
    });

    it("deve gerar codigos em uppercase", () => {
      const code = generateShareCode();

      expect(code).toBe(code.toUpperCase());
    });
  });
});
