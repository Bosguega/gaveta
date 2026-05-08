import { describe, it, expect } from "vitest";
import {
  parseQuery,
  evaluateTokenSearch,
  filterByTokens,
  filterObjectsByTokens,
  buildHighlightHtml,
} from "./search";

describe("search - tokenized search", () => {
  // ---------------------------------------------------------------------------
  // parseQuery
  // ---------------------------------------------------------------------------
  describe("parseQuery", () => {
    it("deve retornar array vazio para query vazia", () => {
      expect(parseQuery("")).toEqual([]);
      expect(parseQuery("   ")).toEqual([]);
    });

    it("deve separar tokens por espaco", () => {
      const result = parseQuery("leite ovo");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: "LEITE", negative: false });
      expect(result[1]).toEqual({ text: "OVO", negative: false });
    });

    it("deve identificar token negativo com prefixo -", () => {
      const result = parseQuery("leite -doce");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: "LEITE", negative: false });
      expect(result[1]).toEqual({ text: "DOCE", negative: true });
    });

    it("deve lidar com multiplos tokens negativos", () => {
      const result = parseQuery("leite -doce -empo");
      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({ text: "DOCE", negative: true });
      expect(result[2]).toEqual({ text: "EMPO", negative: true });
    });

    it("deve normalizar acentos e maiusculas", () => {
      const result = parseQuery("água límão");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: "AGUA", negative: false });
      expect(result[1]).toEqual({ text: "LIMAO", negative: false });
    });

    it("deve normalizar token negativo com acento", () => {
      const result = parseQuery("-doçé");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: "DOCE", negative: true });
    });

    it("deve lidar com espacos extras", () => {
      const result = parseQuery("  leite   -doce  ");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: "LEITE", negative: false });
      expect(result[1]).toEqual({ text: "DOCE", negative: true });
    });
  });

  // ---------------------------------------------------------------------------
  // evaluateTokenSearch
  // ---------------------------------------------------------------------------
  describe("evaluateTokenSearch", () => {
    it("deve dar match com query vazia", () => {
      const result = evaluateTokenSearch([], "peito de frango");
      expect(result.match).toBe(true);
      expect(result.highlights).toEqual([]);
    });

    it("deve dar match quando token esta presente", () => {
      const tokens = parseQuery("frango");
      const result = evaluateTokenSearch(tokens, "peito de frango");
      expect(result.match).toBe(true);
      expect(result.highlights.length).toBeGreaterThan(0);
    });

    it("deve dar match parcial com includes", () => {
      const tokens = parseQuery("peit");
      const result = evaluateTokenSearch(tokens, "peito de frango");
      expect(result.match).toBe(true);
    });

    it("deve dar match com multiplos tokens positivos", () => {
      const tokens = parseQuery("peit os");
      const result = evaluateTokenSearch(tokens, "peito de frango com osso");
      expect(result.match).toBe(true);
    });

    it("deve dar fail quando um token positivo nao esta presente", () => {
      const tokens = parseQuery("peit xyz");
      const result = evaluateTokenSearch(tokens, "peito de frango");
      expect(result.match).toBe(false);
      expect(result.highlights).toEqual([]);
    });

    it("deve dar match com token positivo e fail com token negativo presente", () => {
      const tokens = parseQuery("leite -doce");
      const result = evaluateTokenSearch(tokens, "doce de leite");
      expect(result.match).toBe(false);
      expect(result.highlights).toEqual([]);
    });

    it("deve dar match com token positivo e pass sem token negativo", () => {
      const tokens = parseQuery("leite -doce");
      const result = evaluateTokenSearch(tokens, "leite 1L");
      expect(result.match).toBe(true);
    });

    it("deve ignorar maiusculas e acentos na busca", () => {
      const tokens = parseQuery("AGUA");
      const result = evaluateTokenSearch(tokens, "Água Mineral");
      expect(result.match).toBe(true);
    });

    it("deve ignorar acentos no token negativo", () => {
      const tokens = parseQuery("manga -doçé");
      const result = evaluateTokenSearch(tokens, "manga doce");
      expect(result.match).toBe(false);
    });

    it("deve retornar highlights com ranges validos", () => {
      const tokens = parseQuery("leite");
      const result = evaluateTokenSearch(tokens, "leite integral");
      expect(result.match).toBe(true);
      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0].start).toBe(0);
      expect(result.highlights[0].end).toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // filterByTokens
  // ---------------------------------------------------------------------------
  describe("filterByTokens", () => {
    const items = [
      "peito de frango",
      "frango inteiro",
      "doce de leite",
      "leite 1L",
      "manga",
      "manga doce",
    ];

    it("deve retornar todos os itens para query vazia", () => {
      expect(filterByTokens("", items)).toEqual(items);
    });

    it("deve filtrar por token unico", () => {
      const result = filterByTokens("leite", items);
      expect(result).toEqual(["doce de leite", "leite 1L"]);
    });

    it("deve filtrar por multiplos tokens positivos (AND)", () => {
      const result = filterByTokens("doce leite", items);
      expect(result).toEqual(["doce de leite"]);
    });

    it("deve filtrar com token negativo", () => {
      const result = filterByTokens("leite -doce", items);
      expect(result).toEqual(["leite 1L"]);
    });

    it("deve filtrar manga sem doce", () => {
      const result = filterByTokens("manga -doce", items);
      expect(result).toEqual(["manga"]);
    });

    it("deve lidar com token parcial", () => {
      const result = filterByTokens("peit", items);
      expect(result).toEqual(["peito de frango"]);
    });

    it("deve lidar com multiplos tokens parciais", () => {
      const result = filterByTokens("fran int", items);
      expect(result).toEqual(["frango inteiro"]);
    });

    it("deve ignorar acentos e case", () => {
      const accentedItems = ["Água Mineral", "agua com gas", "AGUA"];
      const result = filterByTokens("agua", accentedItems);
      expect(result).toEqual(["Água Mineral", "agua com gas", "AGUA"]);
    });
  });

  // ---------------------------------------------------------------------------
  // filterObjectsByTokens
  // ---------------------------------------------------------------------------
  describe("filterObjectsByTokens", () => {
    const items = [
      { name: "leite", category: "laticinios" },
      { name: "doce de leite", category: "doces" },
      { name: "peito de frango", category: "carnes" },
      { name: "manga", category: "frutas" },
      { name: "manga doce", category: "doces" },
    ];

    it("deve retornar todos os itens para query vazia", () => {
      expect(filterObjectsByTokens("", items, ["name"])).toEqual(items);
    });

    it("deve filtrar por campo name", () => {
      const result = filterObjectsByTokens("leite", items, ["name"]);
      expect(result).toEqual([
        { name: "leite", category: "laticinios" },
        { name: "doce de leite", category: "doces" },
      ]);
    });

    it("deve buscar em multiplos campos (OR entre campos)", () => {
      const result = filterObjectsByTokens("doces", items, ["name", "category"]);
      expect(result).toEqual([
        { name: "doce de leite", category: "doces" },
        { name: "manga doce", category: "doces" },
      ]);
    });

    it("deve aplicar token negativo corretamente", () => {
      const result = filterObjectsByTokens("leite -doce", items, ["name"]);
      expect(result).toEqual([{ name: "leite", category: "laticinios" }]);
    });

    it("deve excluir item se token negativo bater em qualquer campo", () => {
      const result = filterObjectsByTokens("manga -doces", items, ["name", "category"]);
      expect(result).toEqual([{ name: "manga", category: "frutas" }]);
    });

    it("deve lidar com multiplos tokens positivos", () => {
      const result = filterObjectsByTokens("doce leite", items, ["name"]);
      expect(result).toEqual([{ name: "doce de leite", category: "doces" }]);
    });

    it("deve ignorar acentos e case", () => {
      const accentedItems = [
        { name: "Água", category: "bebidas" },
        { name: "agua", category: "bebidas" },
      ];
      const result = filterObjectsByTokens("AGUA", accentedItems, ["name"]);
      expect(result).toEqual(accentedItems);
    });
  });

  // ---------------------------------------------------------------------------
  // buildHighlightHtml
  // ---------------------------------------------------------------------------
  describe("buildHighlightHtml", () => {
    it("deve retornar texto original sem highlights quando array vazio", () => {
      const result = buildHighlightHtml("leite integral", []);
      expect(result).toBe("leite integral");
    });

    it("deve envolver trecho encontrado com <mark>", () => {
      const result = buildHighlightHtml("leite integral", [
        { start: 0, end: 5, token: "leite" },
      ]);
      expect(result).toBe("<mark>leite</mark> integral");
    });

    it("deve lidar com multiplos highlights nao sobrepostos", () => {
      const result = buildHighlightHtml("leite com oleo", [
        { start: 0, end: 5, token: "leite" },
        { start: 10, end: 14, token: "oleo" },
      ]);
      expect(result).toBe("<mark>leite</mark> com <mark>oleo</mark>");
    });

    it("deve mesclar ranges sobrepostos", () => {
      const result = buildHighlightHtml("peito de frango", [
        { start: 0, end: 6, token: "peito" },
        { start: 5, end: 15, token: "frango" },
      ]);
      // Overlap: [0,6] e [5,15] -> [0,15]
      expect(result).toBe("<mark>peito de frango</mark>");
    });

    it("deve usar tag e className customizados", () => {
      const result = buildHighlightHtml("leite", [
        { start: 0, end: 5, token: "leite" },
      ], { tag: "span", className: "highlight" });
      expect(result).toBe('<span class="highlight">leite</span>');
    });

    it("deve escapar HTML no texto", () => {
      const result = buildHighlightHtml("leite <especial>", [
        { start: 0, end: 5, token: "leite" },
      ]);
      expect(result).toBe("<mark>leite</mark> &lt;especial&gt;");
    });
  });
});
