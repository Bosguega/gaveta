import { Zap, ZapOff } from "lucide-react";
import type { ScannerViewProps } from "../../../types/scanner";

export function ScannerView({
  isScanning,
  torchSupported,
  torch,
  applyTorch,
}: ScannerViewProps) {
  if (!isScanning) return null;

  return (
    <div
      className="scanner-container block bg-black rounded-2xl overflow-hidden border-2 border-[var(--primary)] w-full max-w-[500px] mx-auto relative min-h-[clamp(280px,64vh,420px)]"
    >
      {/* Elemento div para o html5-qrcode */}
      <div
        id="reader"
        className="w-full min-h-[clamp(280px,64vh,420px)]"
      />
      <div
        className="scanner-overlay-frame absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[clamp(150px,58vw,220px)] h-[clamp(150px,58vw,220px)] border-2 border-[var(--success)] rounded-2xl pointer-events-none shadow-[0_0_0_4000px_rgba(15,23,42,0.7)]"
      >
        <div
          className="scanner-overlay-text-top absolute -top-9 w-full text-center text-white text-[0.85rem] font-bold"
        >
          Alinhe o QR Code
        </div>
        <div
          className="scanner-overlay-text-bottom absolute -bottom-9 w-full text-center text-slate-400 text-xs"
        >
          Dica: Afaste um pouco para melhor leitura
        </div>
      </div>

      <div className="absolute bottom-5 right-5 flex flex-col gap-3 z-10">
        {torchSupported && (
          <button
            onClick={() => applyTorch(!torch)}
            className={`w-[52px] h-[52px] rounded-full border-2 border-[var(--primary)] text-white flex items-center justify-center cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${torch ? "bg-[var(--primary)]" : "bg-slate-900/90"}`}
          >
            {torch ? <ZapOff size={24} /> : <Zap size={24} />}
          </button>
        )}
      </div>
    </div>
  );
}
