import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IdleScreen } from "./IdleScreen";

describe("IdleScreen", () => {
  it("renderiza os dois cards principais e a opção manual", () => {
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    expect(screen.getByText(/Ler QR Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Enviar conteúdo para IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Digitar manualmente/i)).toBeInTheDocument();
  });

  it("chama onStartCamera ao escolher Câmera no card QR Code", () => {
    const onStartCamera = vi.fn();
    render(
      <IdleScreen
        onStartCamera={onStartCamera}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Câmera/i }));
    expect(onStartCamera).toHaveBeenCalledTimes(1);
  });

  it("entra no grupo QR ao escolher Carregar imagem e exibe menu inferior", () => {
    const onQrGallery = vi.fn();
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={onQrGallery}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Carregar imagem/i }));
    // Abre a área de importação do grupo QR
    expect(screen.getByText(/Ler QR Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Carregar link/i)).toBeInTheDocument();
  });

  it("chama onIaImage ao escolher Enviar imagem no card IA", () => {
    const onIaImage = vi.fn();
    const { container } = render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={onIaImage}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Enviar imagem/i }));
    // Entra no grupo IA; o input de arquivo aparece
    const input = container.querySelector('input[type="file"][accept="image/*"]');
    expect(input).toBeInTheDocument();

    const file = new File(["image"], "receipt.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(onIaImage).toHaveBeenCalledTimes(1);
  });

  it("chama onIaText ao processar texto no grupo IA", () => {
    const onIaText = vi.fn();
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={onIaText}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Enviar texto/i }));
    const textarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da nota/i);
    fireEvent.change(textarea, { target: { value: "SUPERMERCADO X\nArroz 1 kg 5,00" } });
    fireEvent.click(screen.getByRole("button", { name: /Processar Texto/i }));
    expect(onIaText).toHaveBeenCalledWith("SUPERMERCADO X\nArroz 1 kg 5,00");
  });
});
