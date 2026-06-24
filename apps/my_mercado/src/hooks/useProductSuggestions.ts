import { useMemo } from "react";
import { useDictionaryQuery } from "./queries/useDictionaryQuery";
import { useAllReceiptsQuery } from "./queries/useAllReceiptsQuery";
import { filterObjectsByTokens } from "../utils/search";

/**
 * Hook que combina dicionário de produtos + histórico de receipts
 * para gerar sugestões de produtos no formulário manual.
 *
 * Usa a mesma lógica de busca tokenizada da busca global:
 * - Múltiplos termos separados por espaço
 * - Tokens com "-" são negativos (excluem itens)
 */
export function useProductSuggestions(searchQuery: string) {
    const { data: dictionary = [] } = useDictionaryQuery();
    const { data: receipts = [] } = useAllReceiptsQuery();

    const suggestions = useMemo(() => {
        // 1. Coletar nomes do dicionário (normalized_name优先)
        const dictNames: { name: string; category?: string }[] = dictionary.map((entry) => ({
            name: entry.normalized_name,
            category: entry.category,
        }));

        // 2. Coletar nomes dos receipts históricos
        const receiptNames: { name: string; category?: string }[] = [];
        receipts.forEach((receipt) => {
            receipt.items.forEach((item) => {
                const name = item.normalized_name || item.name;
                const category = item.category;
                receiptNames.push({ name, category });
            });
        });

        // 3. Combinar e deduplicar por normalized_key (ou por nome se não houver chave)
        const uniqueMap = new Map<string, { name: string; category?: string }>();

        [...dictNames, ...receiptNames].forEach(({ name, category }) => {
            const key = name.toLowerCase().trim();
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, { name, category });
            } else {
                // Preferir entrada que tenha categoria
                const existing = uniqueMap.get(key)!;
                if (!existing.category && category) {
                    uniqueMap.set(key, { name, category });
                }
            }
        });

        const allProducts = Array.from(uniqueMap.values()).map((p) => p.name);

        // 4. Filtrar conforme busca tokenizada (mesma lógica de useFilteredSearchItems)
        if (!searchQuery || searchQuery.trim() === "") {
            // Sem busca: retorna todos (limitado a 200 para performance)
            return allProducts.slice(0, 200);
        }

        const fields: ("name" | "category")[] = ["name", "category"];
        const items: { name: string; category?: string }[] = allProducts.map((name) => ({ name }));
        const filtered = filterObjectsByTokens(searchQuery, items, fields);
        return filtered.map((item) => item.name).slice(0, 200);
    }, [dictionary, receipts, searchQuery]);

    return suggestions;
}