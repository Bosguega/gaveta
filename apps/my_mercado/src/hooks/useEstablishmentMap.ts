import { useQuery } from "@tanstack/react-query";
import { getEstablishmentMapFromDB } from "../services";
import { normalizeKey } from "../utils/normalize";
import type { EstablishmentDictionaryMap } from "../types/domain";

/**
 * Hook que retorna o mapa nome_nota → nome_fantasia
 * para resolução de nomes de estabelecimentos na UI.
 *
 * O mapa usa chave normalizada (normalizeKey) para busca.
 * Se um estabelecimento não estiver no dicionário,
 * retorna o nome original.
 */
export function useEstablishmentMap(): EstablishmentDictionaryMap {
    const { data = {} } = useQuery({
        queryKey: ["establishment-dictionary", "map"],
        queryFn: getEstablishmentMapFromDB,
        staleTime: 10 * 60 * 1000,
    });

    return data;
}

/**
 * Função utilitária para resolver o nome exibido de um estabelecimento.
 * Se houver nome fantasia no mapa, retorna ele; senão retorna o original.
 */
export function resolveEstablishmentName(
    nomeNota: string,
    map: EstablishmentDictionaryMap,
): string {
    const key = normalizeKey(nomeNota);
    return map[key] || nomeNota;
}