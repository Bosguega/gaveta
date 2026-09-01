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
    expect(screen.getByText(/Preço original/)).toBeInTheDocument();
    expect(screen.getAllByText("12,50").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("10,00")).toBeInTheDocument();
    expect(screen.getAllByText("25,00").length).toBeGreaterThan(0);
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

    fireEvent.change(screen.getByLabelText("Preço pago /un"), {
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

  it("applies negative total input as discount on original total", () => {
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
      target: { value: "-1,50" },
    });
    // (25,00 - 1,50) / 2 = 11,75
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSavePaidPrice).toHaveBeenCalledWith(11.75);
  });

  it("applies negative unit price input as discount on original unit price", () => {
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

    fireEvent.change(screen.getByLabelText("Preço pago /un"), {
      target: { value: "-2,50" },
    });
    // 12,50 - 2,50 = 10,00
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSavePaidPrice).toHaveBeenCalledWith(10);
  });

  it("shows effective values in summary when using negative discount", () => {
    render(
      <PriceEditModal
        item={item}
        isOpen
        busy={false}
        onCancel={vi.fn()}
        onSavePaidPrice={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Total pago"), {
      target: { value: "-1,50" },
    });

    // Resumo deve exibir os valores efetivos (11,75 / 23,50), não o "-1,50" digitado
    expect(screen.getByText("11,75")).toBeInTheDocument();
    expect(screen.getByText("23,50")).toBeInTheDocument();
    expect(screen.queryByText("-1,50")).not.toBeInTheDocument();
  });
});
