import { X } from "lucide-react";
import { ScannerView } from "../views/ScannerView";
import type { ScanningScreenProps } from "../../../types/scanner";

export function ScanningScreen({
  onStopCamera,
  torch,
  torchSupported,
  applyTorch,
}: ScanningScreenProps) {
  return (
    <>
      <div className="mb-4">
        <button
          className="btn w-full bg-red-500/20 border border-red-500/30 text-red-400"
          onClick={onStopCamera}
        >
          <X size={20} />
          Cancelar Escaneamento
        </button>
      </div>
      <ScannerView
        isScanning={true}
        torchSupported={torchSupported}
        torch={torch}
        applyTorch={applyTorch}
      />
    </>
  );
}
