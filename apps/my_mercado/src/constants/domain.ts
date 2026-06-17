export const CATEGORIES = [
  "Açougue",
  "Hortifruti",
  "Laticínios",
  "Padaria",
  "Limpeza",
  "Higiene",
  "Bebidas",
  "Mercearia",
  "Petshop",
  "Farmácia",
  "Outros"
] as const;

export type Category = (typeof CATEGORIES)[number];
