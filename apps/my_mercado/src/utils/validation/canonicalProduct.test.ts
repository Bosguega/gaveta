import { describe, expect, it } from "vitest";
import {
  parseCreateCanonicalProductInput,
  parseUpdateCanonicalProductInput,
  toCanonicalSlug,
} from "./canonicalProduct";

describe("canonicalProduct validation", () => {
  it("normalizes slug deterministically", () => {
    expect(toCanonicalSlug("  Coca-Cola 2L ")).toBe("coca_cola_2l");
    expect(toCanonicalSlug("Água / Sem Gás")).toBe("agua_sem_gas");
    expect(toCanonicalSlug("___Leite***Integral___")).toBe("leiteintegral");
  });

  it("parses valid create input", () => {
    const parsed = parseCreateCanonicalProductInput({
      slug: "Coca Cola 2L",
      name: "Coca-Cola 2L",
      category: "Bebidas",
      brand: "Coca-Cola",
    });

    expect(parsed.slug).toBe("coca_cola_2l");
    expect(parsed.name).toBe("Coca-Cola 2L");
  });

  it("rejects invalid create input", () => {
    expect(() =>
      parseCreateCanonicalProductInput({
        slug: "__",
        name: "A",
      }),
    ).toThrow();
  });

  it("parses valid update input", () => {
    const parsed = parseUpdateCanonicalProductInput({
      name: "  Novo Nome ",
      category: " ",
      brand: " Marca ",
    });

    expect(parsed).toEqual({
      name: "Novo Nome",
      category: undefined,
      brand: "Marca",
    });
  });

  it("rejects update without any fields", () => {
    expect(() => parseUpdateCanonicalProductInput({})).toThrow();
  });
});
