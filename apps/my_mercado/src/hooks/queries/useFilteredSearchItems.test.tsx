import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useFilteredSearchItems } from "./useFilteredSearchItems";
import type { PurchasedItem, SearchFilters } from "../../types/ui";

// Declarar variável global para testes React
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function runHook(items: PurchasedItem[]) {
  let captured: { items: PurchasedItem[]; totalCount: number } = {
    items: [],
    totalCount: 0,
  };
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent() {
    captured = useFilteredSearchItems({
      items,
      searchQuery: "",
      sortOrder: "recent",
      sortDirection: "desc",
      searchFilters: {
        period: "all",
        startDate: "",
        endDate: "",
      } as SearchFilters,
    });
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  act(() => {
    root.unmount();
  });

  return captured;
}

describe("useFilteredSearchItems", () => {
  it("does not truncate results internally", () => {
    const items: PurchasedItem[] = Array.from({ length: 120 }).map((_, idx) => ({
      name: `Item ${idx}`,
      quantity: 1,
      price: idx,
      total: idx,
      purchasedAt: "10/03/2026",
      store: "Mercado",
    }));

    const result = runHook(items);
    expect(result.totalCount).toBe(120);
    expect(result.items).toHaveLength(120);
  });
});
