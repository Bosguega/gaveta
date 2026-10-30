import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IdleScreen } from "./IdleScreen";
import { useScannerStore } from "../../../stores/useScannerStore";

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
        onIaPhoto={vi.fn()}
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
        onIaPhoto={vi.fn()}
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
        onIaPhoto={vi.fn()}
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
        onIaPhoto={vi.fn()}
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

  it("exibe input de câmera ao escolher Tirar foto no card IA", () => {
    const onIaPhoto = vi.fn();
    const { container } = render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onIaPhoto={onIaPhoto}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />,
    );

    // Entra no grupo IA pelo método Imagem
    fireEvent.click(screen.getByRole("button", { name: /Enviar imagem/i }));
    // Agora o botão "Tirar foto" do menu inferior do grupo IA está disponível
    fireEvent.click(screen.getByRole("tab", { name: /Tirar foto da nota para IA/i }));
    // O input de câmera aparece
    const input = container.querySelector(
      'input[type="file"][accept="image/*"][capture="environment"]',
    );
    expect(input).toBeInTheDocument();

    const file = new File(["image"], "receipt.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(onIaPhoto).toHaveBeenCalledTimes(1);
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
        onIaPhoto={vi.fn()}
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

  it("permite alternar entre opções pelo menu inferior estilo relógio sem voltar para a home", () => {
    const onStartCamera = vi.fn();
    render(
      <IdleScreen
        onStartCamera={onStartCamera}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onIaPhoto={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />
    );

    // Entra em "Carregar imagem"
    fireEvent.click(screen.getByRole("button", { name: /Carregar imagem/i }));

    // Menu inferior deve estar visível com todas as opções do grupo QR lado a lado
    const tablist = screen.getByRole("tablist", { name: /Opções de entrada de nota/i });
    expect(tablist).toBeInTheDocument();

    const linkTab = screen.getByRole("tab", { name: /Informar link da nota fiscal/i });
    const cameraTab = screen.getByRole("tab", { name: /Ler com Câmera ao vivo/i });

    // Alterna para Link direto pelo menu inferior
    fireEvent.click(linkTab);
    expect(screen.getByPlaceholderText(/Cole aqui a URL da NFC-e/i)).toBeInTheDocument();

    // Alterna para Câmera direto pelo menu inferior
    fireEvent.click(cameraTab);
    expect(onStartCamera).toHaveBeenCalledTimes(1);
  });

  it("preserva o link digitado ao alternar entre métodos no menu inferior", () => {
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onIaPhoto={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />
    );

    // Entra em Link
    fireEvent.click(screen.getByRole("button", { name: /Carregar link/i }));
    const input = screen.getByPlaceholderText(/Cole aqui a URL da NFC-e/i);
    fireEvent.change(input, { target: { value: "https://www.fazenda.sp.gov.br/nfce/qrcode?p=12345" } });

    // Alterna para Carregar imagem pelo menu inferior
    const galleryTab = screen.getByRole("tab", { name: /Carregar imagem da galeria/i });
    fireEvent.click(galleryTab);
    expect(screen.getByText(/Selecione uma imagem ou print salvo/i)).toBeInTheDocument();

    // Retorna para Link pelo menu inferior
    const linkTab = screen.getByRole("tab", { name: /Informar link da nota fiscal/i });
    fireEvent.click(linkTab);

    // O valor do input deve permanecer intacto
    const restoredInput = screen.getByPlaceholderText(/Cole aqui a URL da NFC-e/i) as HTMLInputElement;
    expect(restoredInput.value).toBe("https://www.fazenda.sp.gov.br/nfce/qrcode?p=12345");
  });

  it("preserva o texto copiado na IA ao alternar para imagem e retornar", () => {
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onIaPhoto={vi.fn()}
        onManualMode={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />
    );

    // Entra em Texto
    fireEvent.click(screen.getByRole("button", { name: /Enviar texto/i }));
    const textarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da nota/i);
    fireEvent.change(textarea, { target: { value: "NOTA FISCAL DE TESTE" } });

    // Alterna para Imagem pelo menu inferior
    const imageTab = screen.getByRole("tab", { name: /Enviar imagem da nota para IA/i });
    fireEvent.click(imageTab);
    expect(screen.getByText(/Tire uma foto ou selecione uma imagem da nota inteira/i)).toBeInTheDocument();

    // Retorna para Texto pelo menu inferior
    const textTab = screen.getByRole("tab", { name: /Enviar texto copiado para IA/i });
    fireEvent.click(textTab);

    // O texto deve permanecer preservado
    const restoredTextarea = screen.getByPlaceholderText(/Cole aqui o conteúdo da nota/i) as HTMLTextAreaElement;
    expect(restoredTextarea.value).toBe("NOTA FISCAL DE TESTE");
  });

  it("permite retornar à seleção inicial de cards pelo botão Voltar", () => {
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        onIaPhoto={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />
    );

    // Entra no grupo QR
    fireEvent.click(screen.getByRole("button", { name: /Carregar link/i }));
    expect(screen.getByPlaceholderText(/Cole aqui a URL da NFC-e/i)).toBeInTheDocument();

    // Clica em Voltar
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));

    // Deve voltar para a tela inicial com os 2 cards e botão manual
    expect(screen.getByText(/Escolha como importar/i)).toBeInTheDocument();
    expect(screen.getByText(/Digitar manualmente/i)).toBeInTheDocument();
  });

  it("atualiza isScannerEntryActive no store ao abrir entradas e ao clicar em Voltar", () => {
    useScannerStore.getState().resetScannerState();
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        onIaPhoto={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
      />
    );

    expect(useScannerStore.getState().isScannerEntryActive).toBe(false);

    // Clica em um método de entrada (ex: Carregar link)
    fireEvent.click(screen.getByRole("button", { name: /Carregar link/i }));
    expect(useScannerStore.getState().isScannerEntryActive).toBe(true);

    // Clica no botão Voltar
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(useScannerStore.getState().isScannerEntryActive).toBe(false);
  });

  it("notifica onEntryActiveChange ao abrir as entradas e ao clicar em Voltar", () => {
    const onEntryActiveChange = vi.fn();
    render(
      <IdleScreen
        onStartCamera={vi.fn()}
        onQrPhoto={vi.fn()}
        onQrGallery={vi.fn()}
        onUrlSubmit={vi.fn()}
        onIaText={vi.fn()}
        onIaImage={vi.fn()}
        onManualMode={vi.fn()}
        onIaPhoto={vi.fn()}
        isLoading={false}
        isScanning={false}
        error={null}
        onEntryActiveChange={onEntryActiveChange}
      />
    );

    expect(onEntryActiveChange).toHaveBeenCalledWith(false);

    // Clica em Enviar texto no grupo IA
    fireEvent.click(screen.getByRole("button", { name: /Enviar texto/i }));
    expect(onEntryActiveChange).toHaveBeenLastCalledWith(true);

    // Clica em Voltar
    fireEvent.click(screen.getByRole("button", { name: /Voltar/i }));
    expect(onEntryActiveChange).toHaveBeenLastCalledWith(false);
  });
});

