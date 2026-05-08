import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InputDialog from "./InputDialog";

describe("InputDialog", () => {
  it("does not render when closed", () => {
    render(
      <InputDialog
        isOpen={false}
        title="Novo nome"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText("Novo nome")).not.toBeInTheDocument();
  });

  it("disables confirm when input is empty", () => {
    render(
      <InputDialog
        isOpen
        title="Novo nome"
        initialValue=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("calls onConfirm with typed value", () => {
    const onConfirm = vi.fn();

    render(
      <InputDialog
        isOpen
        title="Nova lista"
        initialValue=""
        confirmText="Criar"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Feira" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("Feira");
  });

  it("submits on Enter when value is valid", () => {
    const onConfirm = vi.fn();

    render(
      <InputDialog
        isOpen
        title="Renomear"
        initialValue="Mercado"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("Mercado");
  });

  it("calls onCancel", () => {
    const onCancel = vi.fn();

    render(
      <InputDialog
        isOpen
        title="Nova lista"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
