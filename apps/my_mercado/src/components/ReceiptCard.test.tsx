import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReceiptCard } from "./ReceiptCard";
import type { Receipt } from "../types/domain";

vi.mock("../hooks/queries/useUpdateItemPaidPrice", () => ({
  useUpdateItemPaidPrice: () => ({ mutate: vi.fn(), isPending: false }),
}));

const receiptWithPendingDiscount: Receipt = {
  id: "r1",
  establishment: "Mercado X",
  establishment_display: "Mercado X",
  date: "10/09/2026 14:30:00",
  total_discount: 5,
  items: [
    { id: "i1", name: "CAFE 500G", quantity: 1, price: 20, total: 20 },
    { id: "i2", name: "ARROZ 5KG", quantity: 1, price: 24.9, total: 24.9 },
  ],
};

describe("ReceiptCard — indicador de desconto pendente", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("quando há desconto pendente, o indicador é um botão que abre o modal de conferência", async () => {
    render(
      <ReceiptCard
        receipt={receiptWithPendingDiscount}
        isExpanded={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const badge = screen.getByTitle(/ainda não inserido/);
    expect(badge.tagName).toBe("BUTTON");

    fireEvent.click(badge);

    await waitFor(() =>
      expect(screen.getByText("Conferir descontos pela foto")).toBeInTheDocument(),
    );
  });

  it("expande a nota automaticamente ao clicar na tag com o card colapsado", async () => {
    const onToggle = vi.fn();
    render(
      <ReceiptCard
        receipt={receiptWithPendingDiscount}
        isExpanded={false}
        onToggle={onToggle}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle(/ainda não inserido/));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("r1");
    await waitFor(() =>
      expect(screen.getByText("Conferir descontos pela foto")).toBeInTheDocument(),
    );
  });

  it("não alterna o colapso ao clicar na tag com a nota já expandida", async () => {
    const onToggle = vi.fn();
    render(
      <ReceiptCard
        receipt={receiptWithPendingDiscount}
        isExpanded={true}
        onToggle={onToggle}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle(/ainda não inserido/));

    expect(onToggle).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("Conferir descontos pela foto")).toBeInTheDocument(),
    );
  });

  it("não exibe o indicador quando não há desconto pendente", () => {
    const noDiscount: Receipt = { ...receiptWithPendingDiscount, total_discount: undefined };
    render(
      <ReceiptCard
        receipt={noDiscount}
        isExpanded={false}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByTitle(/ainda não inserido/)).not.toBeInTheDocument();
  });
});
