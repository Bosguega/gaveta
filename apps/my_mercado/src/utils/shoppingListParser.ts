/**
 * Utilitário para analisar entradas de itens da lista de compras.
 * Permite extrair a quantidade e o nome do item de uma única string.
 * 
 * Exemplos:
 * "3x leite" -> { quantity: "3x", name: "leite" }
 * "arroz 5kg" -> { name: "arroz", quantity: "5kg" }
 * "2 pães" -> { quantity: "2", name: "pães" }
 */

export interface ParsedItem {
  name: string;
  quantity?: string;
}

export function parseSmartItemInput(input: string): ParsedItem {
  const trimmed = input.trim();
  if (!trimmed) return { name: "" };

  // Regex para detectar quantidades no início ou fim
  // Suporta: 3x, 5kg, 2.5l, 10, 1/2, etc.
  const units = "kg|g|ml|l|un|x|unid|unidades|pct|caixas|latas|garrafas|folhas|rolos";
  
  // Padrão 1: Quantidade no início (ex: "3x Leite", "500g Carne")
  const qtyStartRegex = new RegExp(`^(\\d+(?:[.,]\\d+)?\\s*(?:${units})?)\\s+(.+)$`, "i");
  
  // Padrão 2: Quantidade no fim (ex: "Arroz 5kg", "Cerveja 12 latas")
  const qtyEndRegex = new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?\\s*(?:${units})?)$`, "i");

  let match = trimmed.match(qtyStartRegex);
  if (match) {
    return { quantity: match[1].trim(), name: match[2].trim() };
  }

  match = trimmed.match(qtyEndRegex);
  if (match) {
    return { name: match[1].trim(), quantity: match[2].trim() };
  }

  return { name: trimmed };
}
