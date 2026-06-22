import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PriceEditModal } from "./PriceEditModal";
import type { ReceiptItem } from "../types/domain";

const item: ReceiptItem = {
  id: "item-1",
  name: "Cafe Torrado",
  normalized_name: "Cafe",
  quantity: 2,
  price: 12.5,
  paid_price: 10,
  total: 25,
};

describe("PriceEditModal", () => {
  it("shows product price data", () => {
    render(
      <PriceEditModal
        item={item}
        isOpen
        busy={false}
        onCancel={vi.fn()}
        onSavePaidPrice={vi.fn()}
      />,
    );

    expect(screen.getByText("Cafe")).toBeInTheDocument();
    expect(screen.getByText("Preco original")).toBeInTheDocument();
    expect(screen.getByText("12,50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10,00")).toBeInTheDocument();
    expect(screen.getByText("25,00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20,00")).toBeInTheDocument();
  });

  it("saves an edited paid price directly", () => {
    const onSavePaidPrice = vi.fn();

    render(
      <PriceEditModal
        item={item}
        isOpen
        busy={false}
        onCancel={vi.fn()}
        onSavePaidPrice={onSavePaidPrice}
      />,
    );

    fireEvent.change(screen.getByLabelText("Preco pago"), {
      target: { value: "8,75" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSavePaidPrice).toHaveBeenCalledWith(8.75);
  });

  it("converts an edited total into paid price per unit", () => {
    const onSavePaidPrice = vi.fn();

    render(
      <PriceEditModal
        item={item}
        isOpen
        busy={false}
        onCancel={vi.fn()}
        onSavePaidPrice={onSavePaidPrice}
      />,
    );

    fireEvent.change(screen.getByLabelText("Total pago"), {
      target: { value: "15,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSavePaidPrice).toHaveBeenCalledWith(7.5);
  });
});
