import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { usePurchaseHistory } from "./usePurchaseHistory";
import type { Receipt } from "../../types/domain";

// Declarar variável global para testes React
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function runHook(savedReceipts: Receipt[]) {
  let captured: ReturnType<typeof usePurchaseHistory> = {
    historyByKey: new Map(),
    suggestions: [],
  };
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent() {
    captured = usePurchaseHistory(savedReceipts);
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

describe("usePurchaseHistory", () => {
  it("normalizes normalized_key from receipts before indexing", () => {
    const receipts: Receipt[] = [
      {
        id: "r-1",
        establishment: "Mercado",
        date: "2026-03-10",
        items: [
          {
            name: "Leite Integral",
            normalized_key: "leite integral",
            quantity: 1,
            price: 5.5,
            total: 5.5,
          },
        ],
      },
    ];

    const result = runHook(receipts);
    expect(result.historyByKey.get("LEITE INTEGRAL")?.length).toBe(1);
  });
});
