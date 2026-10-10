import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DuplicateModal } from "./DuplicateModal";
import type { Receipt } from "../../../types/domain";

const duplicateReceipt: Receipt = {
  id: "r1",
  establishment: "Mercado X",
  date: "10/09/2026 14:30:00",
  items: [],
};

describe("DuplicateModal", () => {
  it("correspondência exata (padrão): mostra 'Nota Já Existente' e 'Atualizar Nota'", () => {
    const onForceSave = vi.fn();
    render(
      <DuplicateModal
        duplicateReceipt={duplicateReceipt}
        onCancel={vi.fn()}
        onForceSave={onForceSave}
      />,
    );

    expect(screen.getByText("Nota Já Existente")).toBeInTheDocument();
    expect(screen.queryByText("Possível Nota Duplicada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Atualizar Nota/i }));
    expect(onForceSave).toHaveBeenCalledTimes(1);
  });

  it("correspondência provável: mostra aviso e botão 'Substituir Nota'", () => {
    const onForceSave = vi.fn();
    render(
      <DuplicateModal
        duplicateReceipt={duplicateReceipt}
        onCancel={vi.fn()}
        onForceSave={onForceSave}
        matchLevel="probable"
      />,
    );

    expect(screen.getByText("Possível Nota Duplicada")).toBeInTheDocument();
    expect(screen.queryByText("Nota Já Existente")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Substituir Nota/i }));
    expect(onForceSave).toHaveBeenCalledTimes(1);
  });
});
