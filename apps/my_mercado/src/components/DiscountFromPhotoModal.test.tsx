import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DiscountFromPhotoModal } from "./DiscountFromPhotoModal";
import type { ReceiptItem } from "../types/domain";

const analyzeMock = vi.fn();
const mutateMock = vi.fn();

vi.mock("../services/discountImageAnalyzer", () => ({
  analyzeDiscountsFromImage: (...args: unknown[]) => analyzeMock(...args),
}));

vi.mock("../hooks/queries/useUpdateItemPaidPrice", () => ({
  useUpdateItemPaidPrice: () => ({
    mutate: (...args: unknown[]) => mutateMock(...args),
    isPending: false,
  }),
}));

vi.mock("../utils/notifications", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const items: ReceiptItem[] = [
  { id: "i1", name: "CAFE 500G", quantity: 1, price: 20, total: 20 },
  { id: "i2", name: "ARROZ 5KG", quantity: 1, price: 24.9, total: 24.9 },
  { id: "i3", name: "LEITE 1L", quantity: 1, price: 5, total: 5 },
];

function makeFile(): File {
  return new File(["x"], "nota.png", { type: "image/png" });
}

function renderModal() {
  const onClose = vi.fn();
  render(<DiscountFromPhotoModal isOpen items={items} onClose={onClose} />);
  return { onClose };
}

async function pickGalleryImage() {
  const input = screen.getByLabelText("Escolher da galeria") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [makeFile()] } });
}

describe("DiscountFromPhotoModal", () => {
  beforeEach(() => {
    analyzeMock.mockReset();
    mutateMock.mockReset();
  });

  it("oferece as opções de tirar foto e escolher da galeria", () => {
    renderModal();
    expect(screen.getByText("Tirar foto")).toBeInTheDocument();
    expect(screen.getByText("Escolher da galeria")).toBeInTheDocument();
    expect(screen.getByLabelText("Tirar foto")).toBeInTheDocument();
    expect(screen.getByLabelText("Escolher da galeria")).toBeInTheDocument();
  });

  it("revisa sugestões e aplica somente os itens selecionados", async () => {
    analyzeMock.mockResolvedValue({
      suggestions: [
        { itemIndex: 0, paidPrice: 17.5 },
        { itemIndex: 2, paidPrice: 4 },
      ],
      confidence: "alta",
      rawJson: "{}",
    });

    renderModal();
    await pickGalleryImage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Aplicar \(2\)/ })).toBeInTheDocument(),
    );

    // Desmarca o primeiro item — só o segundo deve ser aplicado.
    fireEvent.click(screen.getByLabelText("Aplicar desconto em CAFE 500G"));

    expect(screen.getByRole("button", { name: /Aplicar \(1\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Aplicar \(1\)/ }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith({ itemId: "i3", paidPrice: 4 });
  });

  it("preserva os dados em caso de erro e permite nova tentativa", async () => {
    analyzeMock.mockRejectedValue(new Error("Imagem ilegível"));

    renderModal();
    await pickGalleryImage();

    await waitFor(() => expect(screen.getByText("Imagem ilegível")).toBeInTheDocument());

    // Nada foi aplicado.
    expect(mutateMock).not.toHaveBeenCalled();

    // Nova tentativa volta para a escolha de imagem.
    fireEvent.click(screen.getByText("Tentar novamente"));
    await waitFor(() => expect(screen.getByText("Tirar foto")).toBeInTheDocument());
  });

  it("exibe aviso quando a confiança é baixa", async () => {
    analyzeMock.mockResolvedValue({
      suggestions: [{ itemIndex: 0, paidPrice: 10 }],
      confidence: "baixa",
      rawJson: "{}",
    });

    renderModal();
    await pickGalleryImage();

    await waitFor(() => expect(screen.getByText(/Confiança baixa/)).toBeInTheDocument());
  });

  it("informa quando não há itens editáveis (sem id)", () => {
    const onClose = vi.fn();
    render(
      <DiscountFromPhotoModal
        isOpen
        items={[{ name: "SEM ID", quantity: 1, price: 10, total: 10 }]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/não possui itens editáveis/)).toBeInTheDocument();
  });
});
