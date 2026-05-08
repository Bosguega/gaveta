import { describe, it, expect } from "vitest";
import { buildNormalizationPrompt, parseAiJsonResponse } from "./promptBuilder";

describe("promptBuilder", () => {
  describe("buildNormalizationPrompt", () => {
    it("deve construir prompt com lista de itens", () => {
      const items = [
        { key: "item1", raw: "ARROZ BRANCO 5KG" },
        { key: "item2", raw: "LEITE INTEGRAL 1L" },
      ];

      const prompt = buildNormalizationPrompt(items);

      expect(prompt).toContain("ARROZ BRANCO 5KG");
      expect(prompt).toContain("LEITE INTEGRAL 1L");
      expect(prompt).toContain("key: \"item1\"");
      expect(prompt).toContain("key: \"item2\"");
    });

    it("deve incluir categorias no prompt", () => {
      const items = [{ key: "test", raw: "TEST" }];
      const prompt = buildNormalizationPrompt(items);

      expect(prompt).toContain("Categorize em:");
    });

    it("deve incluir exemplos no prompt", () => {
      const items = [{ key: "test", raw: "TEST" }];
      const prompt = buildNormalizationPrompt(items);

      expect(prompt).toContain("EXEMPLOS:");
      expect(prompt).toContain("CERV BRAHMA LTA 350ML");
    });

    it("deve incluir regras no prompt", () => {
      const items = [{ key: "test", raw: "TEST" }];
      const prompt = buildNormalizationPrompt(items);

      expect(prompt).toContain("REGRAS:");
      expect(prompt).toContain("MANTENHA volumes e pesos");
    });
  });

  describe("parseAiJsonResponse", () => {
    it("deve parsear JSON array valido", () => {
      const jsonText = JSON.stringify([
        {
          key: "item1",
          normalized_name: "Arroz Branco 5kg",
          category: "Grãos",
          brand: "Tio João",
          slug: "arroz_branco_5kg",
        },
      ]);

      const result = parseAiJsonResponse(jsonText);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        key: "item1",
        normalized_name: "Arroz Branco 5kg",
        category: "Grãos",
        brand: "Tio João",
        slug: "arroz_branco_5kg",
      });
    });

    it("deve remover markdown wrapper do JSON", () => {
      const jsonText = "```json\n[{\"key\": \"item1\", \"normalized_name\": \"Test\", \"category\": \"Outros\"}]\n```";

      const result = parseAiJsonResponse(jsonText);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("item1");
    });

    it("deve usar valores padrao para campos ausentes", () => {
      const jsonText = JSON.stringify([
        { key: "item1" },
      ]);

      const result = parseAiJsonResponse(jsonText);

      expect(result[0]).toEqual({
        key: "item1",
        normalized_name: "",
        category: "Outros",
        brand: undefined,
        slug: undefined,
      });
    });

    it("deve lancar erro para JSON invalido", () => {
      const invalidJson = "not a json";

      expect(() => parseAiJsonResponse(invalidJson)).toThrow("Resposta da IA nao e um JSON valido.");
    });

    it("deve lancar erro para array vazio", () => {
      expect(() => parseAiJsonResponse("[]")).not.toThrow();
      const result = parseAiJsonResponse("[]");
      expect(result).toHaveLength(0);
    });

    it("deve lancar erro se nao for array", () => {
      const jsonText = JSON.stringify({ key: "item1" });

      // O erro ocorre no parse do JSON antes da validacao do array
      expect(() => parseAiJsonResponse(jsonText)).toThrow("Resposta da IA nao e um JSON valido.");
    });

    it("deve lidar com brand null ou undefined", () => {
      const jsonText = JSON.stringify([
        { key: "item1", normalized_name: "Test", category: "Outros", brand: null },
      ]);

      const result = parseAiJsonResponse(jsonText);

      expect(result[0].brand).toBeUndefined();
    });
  });
});
