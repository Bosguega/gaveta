import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import UniversalSearchBar from "./UniversalSearchBar";
import { PeriodSelector, PeriodDatePickers } from "./PeriodSelector";
import type { SearchSortBy } from "../types/ui";
import { useUiStore } from "../stores/useUiStore";
import { useAllReceiptsQuery } from "../hooks/queries/useReceiptsQuery";
import { useCanonicalProductsQuery } from "../hooks/queries/useCanonicalProductsQuery";
import { useSearchItems } from "../hooks/queries/useSearchItems";
import { useFilteredSearchItems } from "../hooks/queries/useFilteredSearchItems";
import { useSearchChartData } from "../hooks/queries/useSearchChartData";
import { SearchItemRow } from "./SearchItemRow";
import { SearchItemSkeleton } from "./SearchItemSkeleton";

const PriceChart = lazy(() => import("./PriceChart"));
const PAGE_SIZE = 100;

const ChartSkeleton = () => (
  <div className="glass-card p-5 text-center">
    <div className="skeleton-line w-[100px] h-[36px] mx-auto mb-6" />
    <div className="skeleton-line w-[200px] h-[24px] mx-auto mb-6" />
    <div className="skeleton-line w-full h-[300px]" />
  </div>
);

function SearchTab() {
  const { data: savedReceipts = [], isLoading: loading } = useAllReceiptsQuery();
  const { data: canonicalProducts = [] } = useCanonicalProductsQuery();

  const searchQuery = useUiStore((state) => state.searchQuery);
  const setSearchQuery = useUiStore((state) => state.setSearchQuery);
  const sortOrder = useUiStore((state) => state.sortOrder);
  const setSortOrder = useUiStore((state) => state.setSortOrder);
  const sortDirection = useUiStore((state) => state.searchSortDirection);
  const setSortDirection = useUiStore((state) => state.setSearchSortDirection);
  const searchFilters = useUiStore((state) => state.searchFilters);
  const setSearchFilters = useUiStore((state) => state.setSearchFilters);

  const [showChart, setShowChart] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const showSkeleton = loading && savedReceipts.length === 0;

  const { items: allItems } = useSearchItems(savedReceipts, canonicalProducts);
  const { items: filteredItems, totalCount } = useFilteredSearchItems({
    items: allItems,
    searchQuery,
    sortOrder,
    sortDirection,
    searchFilters,
  });

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, sortOrder, sortDirection, searchFilters]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );
  const hasMore = visibleItems.length < totalCount;

  const { groupedItems, chartData } = useSearchChartData(
    filteredItems,
    canonicalProducts,
    showChart,
  );

  if (showChart) {
    return (
      <Suspense fallback={<ChartSkeleton />}>
        <PriceChart
          chartData={chartData}
          groupedItems={groupedItems}
          onBack={() => setShowChart(false)}
        />
      </Suspense>
    );
  }

  return (
    <div>
      <UniversalSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        sortValue={sortOrder}
        onSortChange={(value) => setSortOrder(value as SearchSortBy)}
        sortOrder={sortDirection}
        onSortOrderChange={setSortDirection}
        sortOptions={[
          { value: "recent", label: "Recentes" },
          { value: "price", label: "Preço" },
        ]}
        extraActions={
          <div className="flex items-center gap-4 flex-wrap">
            <PeriodSelector filters={searchFilters} onChange={setSearchFilters} />

            {searchQuery && filteredItems.length > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-500">
                  Exibindo {visibleItems.length} de {totalCount} itens
                </span>
                <button
                  onClick={() => setShowChart(true)}
                  className="bg-transparent border-none text-[var(--success)] text-[0.8rem] font-semibold flex items-center gap-1 cursor-pointer hover:opacity-80"
                >
                  <LineChartIcon size={16} /> Gráfico
                </button>
              </div>
            )}
          </div>
        }
      />

      <PeriodDatePickers filters={searchFilters} onChange={setSearchFilters} />

      <div className="items-list">
        {showSkeleton ? (
          [...Array(6)].map((_, i) => <SearchItemSkeleton key={i} />)
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <p>Nenhum item encontrado.</p>
          </div>
        ) : (
          <>
            {visibleItems.map((item, idx) => (
              <SearchItemRow
                key={`${item.normalized_name || item.name}-${item.purchasedAt}-${idx}`}
                item={item}
              />
            ))}
            {hasMore && (
              <div className="flex justify-center mt-2">
                <button className="btn" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                  Carregar mais
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchTab;
