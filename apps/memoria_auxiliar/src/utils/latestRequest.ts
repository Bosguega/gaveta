/**
 * Guarda de sequência para operações assíncronas.
 *
 * Resolve a corrida de UI em buscas encadeadas: cada `begin()` invalida as
 * operações anteriores, e `isCurrent(token)` diz se aquela operação ainda é a
 * mais recente. Uma resposta antiga nunca deve sobrescrever o resultado de uma
 * busca mais nova.
 */
export function createLatestRequestGate() {
  let latest = 0;

  return {
    /** Marca o início de uma nova operação e devolve seu token. */
    begin(): number {
      latest += 1;
      return latest;
    },
    /** Indica se o token ainda corresponde à operação mais recente. */
    isCurrent(token: number): boolean {
      return token === latest;
    },
  };
}