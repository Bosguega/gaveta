import { useState, useCallback, useEffect } from "react";
import {
  Scan,
  Camera,
  QrCode,
  Bot,
  FileText,
  Image as ImageIcon,
  LinkIcon,
  Edit3,
  X,
  ArrowLeft,
  Plus,
  Sparkles,
} from "lucide-react";
import { notify } from "../../../utils/notifications";
import { validateNfcUrl } from "../../../utils/validation";
import type {
  InitialScannerScreenProps,
  ImportGroup,
  ImportMethod,
  QrMethod,
  IaMethod,
} from "../../../types/scanner";
import { WatchBottomNav, type WatchNavItem } from "../components/WatchBottomNav";
import { ScannerView } from "../views/ScannerView";

const QR_METHODS: WatchNavItem<QrMethod>[] = [
  { id: "camera", label: "Câmera", icon: Camera, ariaLabel: "Ler com Câmera ao vivo" },
  { id: "photo", label: "Tirar foto", icon: Camera, ariaLabel: "Tirar foto do QR Code" },
  { id: "gallery", label: "Carregar imagem", icon: ImageIcon, ariaLabel: "Carregar imagem da galeria" },
  { id: "link", label: "Carregar link", icon: LinkIcon, ariaLabel: "Informar link da nota fiscal" },
];

const IA_METHODS: WatchNavItem<IaMethod>[] = [
  { id: "text", label: "Enviar texto", icon: FileText, ariaLabel: "Enviar texto copiado para IA" },
  { id: "image", label: "Enviar imagem", icon: ImageIcon, ariaLabel: "Enviar imagem da nota para IA" },
];

export function IdleScreen({
  onStartCamera,
  onStopCamera,
  torch = false,
  torchSupported = false,
  applyTorch,
  isNative = false,
  nativeVideoRef,
  onQrPhoto,
  onQrGallery,
  onUrlSubmit,
  onIaText,
  onIaImage,
  onManualMode,
  isLoading,
  isScanning,
  error,
}: InitialScannerScreenProps) {
  const [activeGroup, setActiveGroup] = useState<ImportGroup | null>(() => (isScanning ? "qr" : null));
  const [activeMethod, setActiveMethod] = useState<ImportMethod | null>(() => (isScanning ? "camera" : null));
  const [pastedUrl, setPastedUrl] = useState("");
  const [pastedText, setPastedText] = useState("");

  // Sincroniza se o scanner for acionado externamente
  useEffect(() => {
    if (isScanning && activeGroup === null) {
      setActiveGroup("qr");
      setActiveMethod("camera");
    }
  }, [isScanning, activeGroup]);

  const isImportActive = activeGroup !== null;
  const disabled = isLoading;

  const groupTitle = activeGroup === "qr" ? "Ler QR Code" : "Enviar conteúdo para IA";

  const getMethodSubtitle = (group: ImportGroup, method: ImportMethod | null) => {
    if (group === "qr") {
      switch (method) {
        case "camera":
          return "Aponte a câmera para o QR Code da nota fiscal.";
        case "photo":
          return "Tire uma foto nítida do QR Code da nota fiscal.";
        case "gallery":
          return "Selecione uma imagem salva com o QR Code da nota.";
        case "link":
          return "Cole o link da nota fiscal (NFC-e) para importar.";
        default:
          return "Acesse os dados da nota pelo QR Code ou pelo link.";
      }
    } else {
      switch (method) {
        case "text":
          return "Cole o conteúdo da nota para extração inteligente com IA.";
        case "image":
          return "Envie uma foto da nota para a IA ler todos os dados.";
        default:
          return "Extraia os dados da nota a partir de um texto ou de uma imagem.";
      }
    }
  };

  const enterGroup = useCallback(
    (group: ImportGroup, method: ImportMethod) => {
      setActiveGroup(group);
      setActiveMethod(method);
      if (group === "qr" && method === "camera") {
        onStartCamera();
      }
    },
    [onStartCamera]
  );

  const backToHome = useCallback(() => {
    if (isScanning && onStopCamera) {
      onStopCamera();
    }
    setActiveGroup(null);
    setActiveMethod(null);
  }, [isScanning, onStopCamera]);

  const handleMethodChange = useCallback(
    (method: ImportMethod) => {
      if (activeGroup === "qr") {
        if (method === "camera") {
          setActiveMethod("camera");
          if (!isScanning) {
            onStartCamera();
          }
        } else {
          if (isScanning && onStopCamera) {
            onStopCamera();
          }
          setActiveMethod(method);
        }
      } else {
        setActiveMethod(method);
      }
    },
    [activeGroup, isScanning, onStartCamera, onStopCamera]
  );

  const handleQrPhotoChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQrPhoto(event);
    },
    [onQrPhoto]
  );

  const handleQrGalleryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQrGallery(event);
    },
    [onQrGallery]
  );

  const handleIaImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onIaImage(event);
    },
    [onIaImage]
  );

  const handleLinkSubmit = useCallback(() => {
    const rawUrl = pastedUrl.trim();
    const validation = validateNfcUrl(rawUrl);
    if (!validation.success) {
      notify.error(validation.error);
      return;
    }
    onUrlSubmit(validation.data);
    setPastedUrl("");
  }, [pastedUrl, onUrlSubmit]);

  const handleTextSubmit = useCallback(() => {
    const text = pastedText.trim();
    if (!text) {
      notify.error("Por favor, cole o conteúdo da nota.");
      return;
    }
    onIaText(text);
    setPastedText("");
  }, [pastedText, onIaText]);

  return (
    <div className={`glass-card ${isImportActive ? "scanner-entry-card" : "text-center py-10 px-6"}`}>
      {!isImportActive ? (
        <>
          <div className="mb-8">
            <div className="pulse-container mx-auto w-20 h-20 flex items-center justify-center bg-blue-500/10 rounded-full">
              <Scan size={40} color="var(--primary)" />
            </div>
            <h2 className="mt-5 text-slate-50 text-[1.4rem] font-bold">
              Escolha como importar
            </h2>
            <p className="mt-2 text-slate-400 leading-relaxed text-[0.95rem]">
              Selecione o método de entrada da nota fiscal.
            </p>
          </div>

          {/* Card A — Ler QR Code */}
          <section className="mb-6 text-left">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <QrCode size={20} className="text-blue-400" />
                <h3 className="text-slate-50 font-bold text-lg">Ler QR Code</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Acesse os dados da nota pelo QR Code ou pelo link.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("qr", "camera")}
                  disabled={disabled}
                >
                  <Camera size={16} /> Câmera
                </button>
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("qr", "photo")}
                  disabled={disabled}
                >
                  <Camera size={16} /> Tirar foto
                </button>
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("qr", "gallery")}
                  disabled={disabled}
                >
                  <ImageIcon size={16} /> Carregar imagem
                </button>
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("qr", "link")}
                  disabled={disabled}
                >
                  <LinkIcon size={16} /> Carregar link
                </button>
              </div>
            </div>
          </section>

          {/* Card B — Enviar conteúdo para IA */}
          <section className="text-left">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot size={20} className="text-emerald-400" />
                <h3 className="text-slate-50 font-bold text-lg">
                  Enviar conteúdo para IA
                </h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Extraia os dados da nota a partir de um texto ou de uma imagem.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("ia", "text")}
                  disabled={disabled}
                >
                  <FileText size={16} /> Enviar texto
                </button>
                <button
                  type="button"
                  className="btn w-full text-[0.9rem] flex items-center justify-center gap-2"
                  onClick={() => enterGroup("ia", "image")}
                  disabled={disabled}
                >
                  <ImageIcon size={16} /> Enviar imagem
                </button>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="btn w-full h-[52px] text-[0.95rem] bg-transparent border border-[var(--card-border)] text-slate-400 hover:text-slate-200 mt-8 flex items-center justify-center gap-2"
            onClick={onManualMode}
            disabled={disabled}
          >
            <Edit3 size={18} /> Digitar manualmente
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Header Superior da Tela de Entrada */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--card-border)] mb-4">
            <button
              type="button"
              className="btn w-fit px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-full flex items-center gap-1.5 transition-all"
              onClick={backToHome}
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="flex items-center gap-2">
              {activeGroup === "qr" ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium flex items-center gap-1">
                  <QrCode size={12} /> QR Code
                </span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <Sparkles size={12} /> Assistente IA
                </span>
              )}
            </div>
          </div>

          <div className="text-left mb-4">
            <h2 className="text-slate-50 text-[1.25rem] font-bold">
              {groupTitle}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              {getMethodSubtitle(activeGroup, activeMethod)}
            </p>
          </div>

          {/* Área Central de Conteúdo */}
          <div className="scanner-entry-content">
            {activeGroup === "qr" && (
              <>
                {activeMethod === "camera" && (
                  <div className="w-full flex flex-col items-center">
                    {isScanning && applyTorch ? (
                      <ScannerView
                        isScanning={isScanning}
                        torchSupported={torchSupported}
                        torch={torch}
                        applyTorch={applyTorch}
                        isNative={isNative}
                        nativeVideoRef={nativeVideoRef}
                      />
                    ) : (
                      <div className="glass-card p-6 w-full max-w-sm text-center flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                          <Camera size={32} />
                        </div>
                        <p className="text-slate-300 text-sm">
                          Pronto para escanear a nota fiscal pela câmera.
                        </p>
                        <button
                          type="button"
                          className="btn w-full bg-[var(--primary)] border-[var(--primary)] mt-2"
                          onClick={onStartCamera}
                        >
                          <Camera size={18} /> Iniciar Câmera
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeMethod === "photo" && (
                  <div className="w-full max-w-sm glass-card p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Camera size={32} />
                    </div>
                    <p className="text-slate-300 text-sm">
                      Tire uma foto nítida do QR Code da nota fiscal com a câmera do celular.
                    </p>
                    <label className="btn w-full bg-[var(--primary)] border-[var(--primary)] cursor-pointer mt-2 flex items-center justify-center gap-2">
                      <Camera size={18} /> Tirar foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleQrPhotoChange}
                        disabled={disabled}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {activeMethod === "gallery" && (
                  <div className="w-full max-w-sm glass-card p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-slate-300 text-sm">
                      Selecione uma imagem ou print salvo com o QR Code da nota fiscal.
                    </p>
                    <label className="btn w-full border border-slate-600/50 text-slate-200 hover:bg-slate-800/60 cursor-pointer mt-2 flex items-center justify-center gap-2">
                      <ImageIcon size={18} /> Carregar imagem
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrGalleryChange}
                        disabled={disabled}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {activeMethod === "link" && (
                  <div className="w-full max-w-sm glass-card p-5 text-left">
                    <label className="block text-slate-400 text-xs font-semibold mb-2">
                      Link da NFC-e (URL completa)
                    </label>
                    <div className="scanner-link-row mb-3">
                      <input
                        type="text"
                        placeholder="Cole aqui a URL da NFC-e..."
                        value={pastedUrl}
                        onChange={(e) => setPastedUrl(e.target.value)}
                        autoFocus
                        className="search-input text-sm w-full"
                      />
                      <button
                        type="button"
                        className="btn btn-success px-4 flex items-center justify-center"
                        onClick={handleLinkSubmit}
                        disabled={disabled || !pastedUrl.trim()}
                        title="Processar Link"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Dica: Você pode copiar o endereço impresso na nota ou recebido por mensagem.
                    </p>
                  </div>
                )}
              </>
            )}

            {activeGroup === "ia" && (
              <>
                {activeMethod === "text" && (
                  <div className="w-full max-w-md glass-card p-5 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-slate-400 text-xs font-semibold">
                        Texto da nota fiscal
                      </label>
                      {pastedText && (
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                          onClick={() => setPastedText("")}
                        >
                          <X size={12} /> Limpar
                        </button>
                      )}
                    </div>
                    <textarea
                      placeholder="Cole aqui o conteúdo da nota..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      autoFocus
                      rows={5}
                      className="search-input text-sm w-full resize-none bg-slate-900/60 border border-slate-700/60 p-3 mb-3 leading-relaxed"
                    />
                    <button
                      type="button"
                      className="btn btn-success w-full h-12 flex items-center justify-center gap-2"
                      onClick={handleTextSubmit}
                      disabled={disabled || !pastedText.trim()}
                    >
                      <Sparkles size={18} /> Processar Texto
                    </button>
                  </div>
                )}

                {activeMethod === "image" && (
                  <div className="w-full max-w-sm glass-card p-6 text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <ImageIcon size={32} />
                    </div>
                    <p className="text-slate-300 text-sm">
                      Tire uma foto ou selecione uma imagem da nota inteira. A Inteligência Artificial lerá todos os itens e preços automaticamente.
                    </p>
                    <label className="btn w-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 cursor-pointer mt-2 flex items-center justify-center gap-2">
                      <ImageIcon size={18} /> Enviar imagem
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIaImageChange}
                        disabled={disabled}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Menu de Navegação Inferior Inspirado em Relógio */}
          <WatchBottomNav
            items={activeGroup === "qr" ? QR_METHODS : IA_METHODS}
            activeId={activeMethod || (activeGroup === "qr" ? "camera" : "text")}
            onChange={(methodId) => handleMethodChange(methodId as ImportMethod)}
            accentColor={activeGroup === "qr" ? "blue" : "emerald"}
            disabled={disabled}
          />
        </>
      )}
    </div>
  );
}
export default IdleScreen;
