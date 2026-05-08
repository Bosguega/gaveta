import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useSortedShoppingItems } from "./useSortedShoppingItems";
import type { ShoppingListItem } from "../../types/ui";

// Declarar variável global para testes React
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
// Required by React 18 to silence act-environment warnings in jsdom tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function runHook(items: ShoppingListItem[]): ShoppingListItem[] {
  let captured: ShoppingListItem[] = [];
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent({ value }: { value: ShoppingListItem[] }) {
    captured = useSortedShoppingItems(value);
    return null;
  }

  act(() => {
    root.render(<TestComponent value={items} />);
  });

  act(() => {
    root.unmount();
  });

  return captured;
}

describe("useSortedShoppingItems", () => {
  it("places pending items before checked items", () => {
    const now = new Date().toISOString();
    const items: ShoppingListItem[] = [
      {
        id: "1",
        name: "A",
        normalized_key: "A",
        checked: true,
        created_at: now,
      },
      {
        id: "2",
        name: "B",
        normalized_key: "B",
        checked: false,
        created_at: now,
      },
    ];

    const sorted = runHook(items);
    expect(sorted.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("sorts items by created_at descending within the same checked group", () => {
    const items: ShoppingListItem[] = [
      {
        id: "old",
        name: "Old",
        normalized_key: "OLD",
        checked: false,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "new",
        name: "New",
        normalized_key: "NEW",
        checked: false,
        created_at: "2026-02-01T00:00:00.000Z",
      },
    ];

    const sorted = runHook(items);
    expect(sorted.map((i) => i.id)).toEqual(["new", "old"]);
  });
});
