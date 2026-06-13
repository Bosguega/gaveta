import { useMemo } from "react";
import { useEstablishmentDictionaryQuery } from "./queries/useEstablishmentDictionaryQuery";
import { normalizeKey } from "../utils/normalize";
import type { EstablishmentDictionaryMap } from "../types/domain";

/**
 * Hook que retorna o mapa nome_nota → nome_fantasia
 * para resolução de nomes de estabelecimentos na UI.
 *
 * Reusa os dados da query principal do dicionário,
 * garantindo que qualquer atualização reflita na UI.
 */
export function useEstablishmentMap(): EstablishmentDictionaryMap {
    const { data: entries = [] } = useEstablishmentDictionaryQuery();

    const map = useMemo(() => {
        return entries.reduce<EstablishmentDictionaryMap>((acc, entry) => {
            const key = normalizeKey(entry.nome_nota);
            acc[key] = entry.nome_fantasia;
            return acc;
        }, {});
    }, [entries]);

    return map;
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