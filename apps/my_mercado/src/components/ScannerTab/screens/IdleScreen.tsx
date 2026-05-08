import { useState, useCallback } from "react";
import { Scan, Camera, Image as ImageIcon, Edit3, LinkIcon, Plus, X, Aperture, FileText } from "lucide-react";
import { notify } from "../../../utils/notifications";
import { validateNfcUrl } from "../../../utils/validation";
import type { InitialScannerScreenProps } from "../../../types/scanner";

export function IdleScreen({
  onStartCamera,
  onFileUpload,
  onManualMode,
  handleUrlSubmit,
  handleTextSubmit,
  isLoading,
  isScanning,
  error,
}: InitialScannerScreenProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [textPasteMode, setTextPasteMode] = useState(false);
  const [pastedUrl, setPastedUrl] = useState("");
  const [pastedText, setPastedText] = useState("");

  const onLinkSubmit = useCallback(() => {
    const rawUrl = pastedUrl.trim();

    const validation = validateNfcUrl(rawUrl);

    if (!validation.success) {
      notify.error(validation.error);
      return;
    }

    handleUrlSubmit(validation.data);
    setPastedUrl("");
    setPasteMode(false);
  }, [pastedUrl, handleUrlSubmit]);

  const onTextSubmit = useCallback(() => {
    const text = pastedText.trim();
    if (!text) {
      notify.error("Por favor, cole o conteúdo da nota.");
      return;
    }

    handleTextSubmit(text);
    setPastedText("");
    setTextPasteMode(false);
  }, [pastedText, handleTextSubmit]);

  return (
    <div className="glass-card text-center py-10 px-6">
      <div className="mb-8">
        <div className="pulse-container mx-auto w-20 h-20 flex items-center justify-center bg-blue-500/10 rounded-full">
          <Scan size={40} color="var(--primary)" />
        </div>
        <h2 className="mt-5 text-slate-50 text-[1.4rem] font-bold">
          Escanear Nota Fiscal
        </h2>
        <p className="mt-2 text-slate-400 leading-relaxed text-[0.95rem]">
          Aponte a câmera para o QR Code ou faça upload da galeria.
        </p>
      </div>

      <div className="scanner-action-grid">
        <button
          className="btn h-14 text-[0.95rem]"
          onClick={onStartCamera}
          disabled={isLoading || isScanning}
        >
          <Camera size={20} />
          Câmera
        </button>

        <label
          className={`btn h-14 text-[0.95rem] bg-[var(--primary)] border-[var(--primary)] cursor-pointer ${isLoading || isScanning ? "opacity-70" : "opacity-100"}`}
        >
          <Aperture size={20} />
          Foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileUpload}
            disabled={isLoading || isScanning}
            className="hidden"
          />
        </label>

        <label
          className={`btn btn-success h-14 text-[0.95rem] cursor-pointer ${isLoading || isScanning ? "opacity-70" : "opacity-100"}`}
        >
          <ImageIcon size={20} />
          Galeria
          <input
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            disabled={isLoading || isScanning}
            className="hidden"
          />
        </label>
      </div>

      <div className="mb-3 space-y-3">
        {!pasteMode ? (
          <button
            className="btn w-full h-[52px] text-[0.95rem] bg-blue-500/5 border border-blue-500/20 text-[var(--primary)]"
            onClick={() => {
              setPasteMode(true);
              setTextPasteMode(false);
            }}
            disabled={isLoading || isScanning}
          >
            <LinkIcon size={18} />
            Colar Link da Nota
          </button>
        ) : (
          <div className="glass-card p-3 bg-slate-900/40 mb-0">
            <div className="scanner-link-row">
              <input
                type="text"
                placeholder="URL da NFC-e..."
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                autoFocus
                className="search-input text-sm"
              />
              <button className="btn btn-success px-3" onClick={onLinkSubmit}>
                <Plus size={20} />
              </button>
              <button
                className="btn px-3 bg-red-500/10 border-none text-red-400 hover:bg-red-500/20"
                onClick={() => setPasteMode(false)}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {!textPasteMode ? (
          <button
            className="btn w-full h-[52px] text-[0.95rem] bg-emerald-500/5 border border-emerald-500/20 text-emerald-400"
            onClick={() => {
              setTextPasteMode(true);
              setPasteMode(false);
            }}
            disabled={isLoading || isScanning}
          >
            <FileText size={18} />
            Colar Texto da Nota
          </button>
        ) : (
          <div className="glass-card p-3 bg-slate-900/40 mb-0">
            <div className="flex flex-col gap-3">
              <textarea
                placeholder="Cole aqui o conteúdo copiado da nota..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                autoFocus
                rows={4}
                className="search-input text-sm w-full resize-none bg-slate-800/50 border border-slate-700/50 p-3"
              />
              <div className="flex gap-2">
                <button className="btn btn-success flex-1 h-12" onClick={onTextSubmit}>
                  <Plus size={18} />
                  Processar Texto
                </button>
                <button
                  className="btn px-4 bg-red-500/10 border-none text-red-400 hover:bg-red-500/20"
                  onClick={() => setTextPasteMode(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="btn w-full h-[52px] text-[0.95rem] bg-transparent border border-[var(--card-border)] text-slate-500"
        onClick={onManualMode}
        disabled={isLoading || isScanning}
      >
        <Edit3 size={18} />
        Digitar Manualmente
      </button>

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
