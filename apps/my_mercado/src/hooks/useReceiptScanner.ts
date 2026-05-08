import { useCallback, useEffect } from 'react';
import { useScannerStore } from '../stores/useScannerStore';
import { useCameraScanner } from './useCameraScanner';
import { useManualReceipt } from './useManualReceipt';
import { useQRCodeProcessor } from './useQRCodeProcessor';
import { logger } from '../utils/logger';
import type { Receipt } from '../types/domain';
import type { AppTab } from '../types/ui';

type SaveReceiptResponse =
  | { duplicate: true; existingReceipt: Receipt }
  | { success: true; receipt: Receipt }
  | { success: false; error: unknown };

type SaveReceiptFn = (
  receipt: Receipt,
  forceReplace?: boolean,
) => Promise<SaveReceiptResponse>;

/**
 * Hook principal do Scanner - orquestra os hooks menores.
 */
export function useReceiptScanner({
  saveReceipt,
  tab,
}: {
  saveReceipt: SaveReceiptFn;
  tab: AppTab;
}) {
  const scanning = useScannerStore((state) => state.scanning);
  const manualMode = useScannerStore((state) => state.manualMode);
  const setManualMode = useScannerStore((state) => state.setManualMode);
  const currentReceipt = useScannerStore((state) => state.currentReceipt);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);
  const loading = useScannerStore((state) => state.loading);
  const error = useScannerStore((state) => state.error);
  const duplicateReceipt = useScannerStore((state) => state.duplicateReceipt);
  const setDuplicateReceipt = useScannerStore((state) => state.setDuplicateReceipt);

  const {
    html5QrcodeRef,
    processingRef,
    torch,
    torchSupported,
    startCamera,
    stopCamera,
    applyTorch,
  } = useCameraScanner();

  const { processQRCode, processRawText } = useQRCodeProcessor(saveReceipt);

  const {
    manualData,
    manualItem,
    setManualItem,
    handleAddManualItem,
    handleSaveManualReceipt,
    handleCancelManualReceipt,
    getDefaultManualData,
  } = useManualReceipt(saveReceipt);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) {
        if (import.meta.env.DEV) {
          logger.info('Scanner', 'Processamento ja em andamento, ignorando');
        }
        return;
      }
      processingRef.current = true;
      await processQRCode(decodedText);
      processingRef.current = false;
    },
    [processQRCode, processingRef],
  );

  // Nao iniciar camera automaticamente ao entrar na aba.
  // Isso permite mostrar primeiro a tela de escolha de metodo.
  useEffect(() => {
    if (tab !== 'scan') {
      stopCamera();
      setManualMode(false);
    }
  }, [tab, stopCamera, setManualMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    currentReceipt,
    setCurrentReceipt,
    loading,
    scanning,
    error,
    duplicateReceipt,
    setDuplicateReceipt,
    manualMode,
    setManualMode,
    manualData,
    manualItem,
    setManualItem,
    torch,
    torchSupported,

    html5QrcodeRef,
    processingRef,

    startCamera,
    stopCamera,
    applyTorch,

    handleScanSuccess,
    processRawText,

    handleAddManualItem,
    handleSaveManualReceipt,
    handleCancelManualReceipt,
    getDefaultManualData,
  };
}
