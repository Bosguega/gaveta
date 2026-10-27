import { useState, useCallback } from "react";
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
} from "lucide-react";
import { notify } from "../../../utils/notifications";
import { validateNfcUrl } from "../../../utils/validation";
import type { InitialScannerScreenProps } from "../../../types/scanner";

type ImportGroup = "qr" | "ia";
type QrMethod = "camera" | "photo" | "gallery" | "link";
type IaMethod = "text" | "image";
type ImportMethod = QrMethod | IaMethod;

interface MethodOption {
  id: ImportMethod;
  label: string;
  icon: React.ElementType;
}

const QR_METHODS: MethodOption[] = [
  { id: "camera", label: "Câmera", icon: Camera },
  { id: "photo", label: "Tirar foto", icon: Camera },
  { id: "gallery", label: "Carregar imagem", icon: ImageIcon },
  { id: "link", label: "Carregar link", icon: LinkIcon },
];

const IA_METHODS: MethodOption[] = [
  { id: "text", label: "Enviar texto", icon: FileText },
  { id: "image", label: "Enviar imagem", icon: ImageIcon },
];

export function IdleScreen({
  onStartCamera,
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
  const [activeGroup, setActiveGroup] = useState<ImportGroup | null>(null);
  const [activeMethod, setActiveMethod] = useState<ImportMethod | null>(null);
  const [pastedUrl, setPastedUrl] = useState("");
  const [pastedText, setPastedText] = useState("");

  const isImportActive = activeGroup !== null;
  const disabled = isLoading || isScanning;

  const methods = activeGroup === "qr" ? QR_METHODS : IA_METHODS;
  const groupTitle = activeGroup === "qr" ? "Ler QR Code" : "Enviar conteúdo para IA";
  const groupSubtitle =
    activeGroup === "qr"
      ? "Acesse os dados da nota pelo QR Code ou pelo link."
      : "Extraia os dados da nota a partir de um texto ou de uma imagem.";

  const enterGroup = useCallback((group: ImportGroup, method: ImportMethod) => {
    setActiveGroup(group);
    setActiveMethod(method);
  }, []);

  const backToHome = useCallback(() => {
    setActiveGroup(null);
    setActiveMethod(null);
    setPastedUrl("");
    setPastedText("");
  }, []);

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
    <div className="glass-card text-center py-10 px-6">
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
          <section className="mb-6">
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
                  className="btn w-full text-[0.9rem]"
                  onClick={() => {
                    backToHome();
                    onStartCamera();
                  }}
                  disabled={disabled}
                >
                  <Camera size={16} /> Câmera
                </button>
                <button
                  className="btn w-full text-[0.9rem]"
                  onClick={() => enterGroup("qr", "photo")}
                  disabled={disabled}
                >
                  <Camera size={16} /> Tirar foto
                </button>
                <button
                  className="btn w-full text-[0.9rem]"
                  onClick={() => enterGroup("qr", "gallery")}
                  disabled={disabled}
                >
                  <ImageIcon size={16} /> Carregar imagem
                </button>
                <button
                  className="btn w-full text-[0.9rem]"
                  onClick={() => enterGroup("qr", "link")}
                  disabled={disabled}
                >
                  <LinkIcon size={16} /> Carregar link
                </button>
              </div>
            </div>
          </section>

          {/* Card B — Enviar conteúdo para IA */}
          <section>
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
                  className="btn w-full text-[0.9rem]"
                  onClick={() => enterGroup("ia", "text")}
                  disabled={disabled}
                >
                  <FileText size={16} /> Enviar texto
                </button>
                <button
                  className="btn w-full text-[0.9rem]"
                  onClick={() => enterGroup("ia", "image")}
                  disabled={disabled}
                >
                  <ImageIcon size={16} /> Enviar imagem
                </button>
              </div>
            </div>
          </section>

          <button
            className="btn w-full h-[52px] text-[0.95rem] bg-transparent border border-[var(--card-border)] text-slate-500 mt-8"
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
          <button
            className="btn w-fit px-3 py-1.5 text-[0.9rem] bg-transparent border border-slate-600/50 text-slate-400 hover:text-slate-200 hover:border-slate-400 mb-4 self-start"
            onClick={backToHome}
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          <h2 className="mt-2 text-slate-50 text-[1.3rem] font-bold mb-1">
            {groupTitle}
          </h2>
          <p className="text-slate-400 text-sm mb-6">{groupSubtitle}</p>

          <div className="import-content flex-1 flex flex-col items-center justify-center min-h-[300px]">
            {activeGroup === "qr" && (
              <>
                {activeMethod === "photo" && (
                  <div className="w-full max-w-sm">
                    <p className="text-slate-400 text-sm mb-3">
                      Tire uma foto do QR Code da nota fiscal.
                    </p>
                    <label className="btn w-full bg-[var(--primary)] border-[var(--primary)] cursor-pointer">
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
                  <div className="w-full max-w-sm">
                    <p className="text-slate-400 text-sm mb-3">
                      Selecione uma imagem salva com o QR Code da nota.
                    </p>
                    <label className="btn w-full border border-slate-600/50 text-slate-300 cursor-pointer">
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
                  <div className="w-full max-w-sm">
                    <p className="text-slate-400 text-sm mb-3">
                      Cole o link da nota fiscal (NFC-e).
                    </p>
                    <div className="scanner-link-row mb-3">
                      <input
                        type="text"
                        placeholder="URL da NFC-e..."
                        value={pastedUrl}
                        onChange={(e) => setPastedUrl(e.target.value)}
                        autoFocus
                        className="search-input text-sm w-full"
                      />
                      <button className="btn btn-success px-3" onClick={handleLinkSubmit} disabled={disabled}>
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {activeGroup === "ia" && (
              <>
                {activeMethod === "text" && (
                  <div className="w-full max-w-sm">
                    <p className="text-slate-400 text-sm mb-3">
                      Cole aqui o conteúdo copiado da nota fiscal.
                    </p>
                    <textarea
                      placeholder="Cole aqui o conteúdo da nota..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      autoFocus
                      rows={4}
                      className="search-input text-sm w-full resize-none bg-slate-800/50 border border-slate-700/50 p-3 mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        className="btn btn-success flex-1 h-12"
                        onClick={handleTextSubmit}
                        disabled={disabled || !pastedText.trim()}
                      >
                        <Plus size={18} /> Processar Texto
                      </button>
                      <button
                        className="btn px-4 bg-red-500/10 border-none text-red-400 hover:bg-red-500/20"
                        onClick={() => setPastedText("")}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                )}
                {activeMethod === "image" && (
                  <div className="w-full max-w-sm">
                    <p className="text-slate-400 text-sm mb-3">
                      Tire uma foto da nota ou selecione uma imagem salva. A IA
                      extrairá todos os dados da nota.
                    </p>
                    <label className="btn w-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 cursor-pointer">
                      <ImageIcon size={18} /> Enviar imagem
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
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

          <div className="import-menu">
            {methods.map((m) => (
              <button
                key={m.id}
                className={`import-menu-btn w-full h-12 text-[0.85rem] flex flex-col items-center justify-center gap-1 transition-all ${activeMethod === m.id ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "bg-slate-900/40 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
                onClick={() => {
                  setActiveMethod(m.id);
                  if (m.id === "camera") {
                    backToHome();
                    onStartCamera();
                  }
                }}
                disabled={disabled}
              >
                <m.icon size={16} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
