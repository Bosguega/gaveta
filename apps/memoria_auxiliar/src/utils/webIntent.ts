/**
 * Detecção de intenção explícita de consulta à web.
 *
 * Regra conservadora: a web só é considerada quando o usuário pede de forma
 * explícita uma pesquisa/consulta a uma fonte externa. Na dúvida, a resposta é
 * `false` — a busca local (notas + RAG) permanece como comportamento padrão.
 *
 * Não é análise de linguagem natural: apenas exige um verbo de consulta
 * ("pesquise", "busque", "consulte"...) próximo de uma fonte externa
 * ("web", "internet", "online"). Frases como "qual o preço atual?" não liberam
 * a web, porque não pedem consulta externa.
 */

/**
 * Verbos que indicam uma consulta/pesquisa.
 * `busqu?` e `verific?` cobrem "buscar"/"busque" e "verificar"/"verifique" —
 * na conjugação o "c" final cai ("busque", "verifique").
 */
const SEARCH_VERBS =
  /\b(?:pesquis\w*|busqu?\w*|procur\w*|consult\w*|verific?\w*|olh\w*|veja|ve)\b/gi;

/** Fontes externas que caracterizam a consulta à web. */
const WEB_SOURCES = /\b(?:web|internet|online)\b/gi;

/** Distância máxima, em caracteres, entre o verbo e a fonte. */
const MAX_DISTANCE = 40;

function findPositions(text: string, pattern: RegExp): number[] {
  const positions: number[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match.index !== undefined) positions.push(match.index);
  }
  return positions;
}

/**
 * Indica se a pergunta pede explicitamente uma pesquisa na web.
 *
 * Reconhece pedidos como "pesquise na web sobre X", "busque na internet...",
 * "consulte a web para comparar...", "procure online se ainda é válido" e
 * "veja na internet o que existe atualmente sobre esse assunto".
 */
export function isWebSearchRequested(question: string): boolean {
  const text = question.toLowerCase();
  const verbs = findPositions(text, SEARCH_VERBS);
  const sources = findPositions(text, WEB_SOURCES);

  if (verbs.length === 0 || sources.length === 0) return false;

  return verbs.some((verb) =>
    sources.some((source) => Math.abs(verb - source) <= MAX_DISTANCE),
  );
}