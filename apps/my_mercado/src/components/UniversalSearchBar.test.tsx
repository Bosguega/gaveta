import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UniversalSearchBar from "./UniversalSearchBar";

describe("UniversalSearchBar", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  };

  it("deve renderizar o input de busca com placeholder idle padrao", () => {
    render(<UniversalSearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Pesquisar por nome ou categoria");
    expect(input).toBeInTheDocument();
  });

  it("deve usar placeholder customizado quando fornecido", () => {
    render(
      <UniversalSearchBar
        {...defaultProps}
        placeholder="Buscar por mercado..."
      />,
    );
    expect(screen.getByPlaceholderText("Buscar por mercado...")).toBeInTheDocument();
  });

  it("deve mudar placeholder para dica de sintaxe ao focar", () => {
    render(<UniversalSearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Pesquisar por nome ou categoria");

    fireEvent.focus(input);

    expect(
      screen.getByPlaceholderText("Use espaço para separar termos e - para excluir"),
    ).toBeInTheDocument();
  });

  it("deve voltar ao placeholder idle ao perder o foco", () => {
    render(<UniversalSearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText("Pesquisar por nome ou categoria");

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(
      screen.getByPlaceholderText("Pesquisar por nome ou categoria"),
    ).toBeInTheDocument();
  });

  it("deve respeitar placeholder customizado ao perder o foco", () => {
    render(
      <UniversalSearchBar
        {...defaultProps}
        placeholder="Buscar por mercado..."
      />,
    );
    const input = screen.getByPlaceholderText("Buscar por mercado...");

    fireEvent.focus(input);
    expect(
      screen.getByPlaceholderText("Use espaço para separar termos e - para excluir"),
    ).toBeInTheDocument();

    fireEvent.blur(input);
    expect(
      screen.getByPlaceholderText("Buscar por mercado..."),
    ).toBeInTheDocument();
  });

  it("nao deve alterar o valor digitado ao focar/desfocar", () => {
    const onChange = vi.fn();
    render(<UniversalSearchBar {...defaultProps} value="leite" onChange={onChange} />);

    const input = screen.getByDisplayValue("leite");
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(screen.getByDisplayValue("leite")).toBeInTheDocument();
  });

  it("deve chamar onChange ao digitar", () => {
    const onChange = vi.fn();
    render(<UniversalSearchBar {...defaultProps} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Pesquisar por nome ou categoria");

    fireEvent.change(input, { target: { value: "leite -doce" } });

    expect(onChange).toHaveBeenCalledWith("leite -doce");
  });
});
