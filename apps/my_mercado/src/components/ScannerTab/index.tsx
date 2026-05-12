import { useCallback } from "react";
import { notify } from "../../utils/notifications";
import { logger } from "../../utils/logger";
import { useReceiptScanner } from "../../hooks/useReceiptScanner";
import { useImageQrScanner } from "../../hooks/useImageQrScanner";
import { useReceiptsSessionStore } from "../../stores/useReceiptsSessionStore";
import { useUiStore } from "../../stores/useUiStore";
import { useScannerStore } from "../../stores/useScannerStore";
import { useSaveReceipt } from "../../hooks/queries/useReceiptsQuery";
import { IdleScreen } from "./screens/IdleScreen";
import { ScanningScreen } from "./screens/ScanningScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { ManualReceiptForm } from "./forms/ManualReceiptForm";
import { DuplicateModal } from "./modals/DuplicateModal";
import type { Receipt, ReceiptItem } from "../../types/domain";
import type { SaveReceiptResponse } from "../../types/scanner";

function ScannerTab() {
  const saveReceiptMutation = useSaveReceipt();
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const tab = useUiStore((state) => state.tab);
  const loadingStep = useScannerStore((state) => state.loadingStep);
  const isSaving = useScannerStore((state) => state.isSaving);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);
  const setDuplicateReceipt = useScannerStore((state) => state.setDuplicateReceipt);
  const { decodeQRFromImage } = useImageQrScanner();

  // Wrapper para adaptar a interface da mutation do React Query
  const saveReceipt = useCallback(
    async (
      receipt: Receipt,
      forceReplace?: boolean
    ): Promise<SaveReceiptResponse> => {
      const result = await saveReceiptMutation.mutateAsync({
        receipt,
        sessionUserId,
        forceReplace,
      });

      if ("duplicate" in result && result.duplicate) {
        return { duplicate: true, existingReceipt: result.existingReceipt };
      }
      if ("success" in result && result.success) {
        return { success: true, receipt: result.receipt };
      }
      return { success: false, error: "Unknown error" };
    },
    [saveReceiptMutation, sessionUserId]
  );

  const {
    currentReceipt,
    loading,
    scanning,
    error,
    duplicateReceipt,
    manualMode,
    setManualMode,
    manualData,
    manualItem,
    setManualItem,
    torch,
    torchSupported,
    nativeVideoRef,
    isNativeSupported,
    startCamera,
    stopCamera,
    applyTorch,
    handleScanSuccess,
    processRawText,
    saveCurrentReceipt,
    handleAddManualItem,
    handleSaveManualReceipt,
    handleCancelManualReceipt,
    getDefaultManualData,
  } = useReceiptScanner({ saveReceipt, tab });

  // Estados derivados
  const isLoading = loading;
  const isScanning = scanning;

  // Handler de upload de arquivo (foto/galeria)
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        // Notificar que está processando
        notify.loading('Analisando imagem...');

        // Decodificar QR Code da imagem usando BarcodeDetector ou html5-qrcode
        const decodedText = await decodeQRFromImage(file);

        if (decodedText) {
          // QR Code encontrado! Processar o texto decodificado
          notify.success('QR Code encontrado na imagem!');
          await handleScanSuccess(decodedText);
        } else {
          notify.error('Nenhum QR Code encontrado na imagem.');
        }
      } catch (err) {
        logger.error('ScannerTab', 'Erro ao processar arquivo', err);
        notify.error('Erro ao processar imagem.');
      }
    },
    [handleScanSuccess, decodeQRFromImage]
  );

  // Handler de URL
  const handleUrlSubmit = useCallback(
    async (url: string) => {
      await handleScanSuccess(url);
    },
    [handleScanSuccess]
  );

  // Handler de reset (descartar)
  const handleReset = useCallback(() => {
    setCurrentReceipt(null);
    stopCamera();
  }, [setCurrentReceipt, stopCamera]);

  // Handler de salvar nota (chamado pelo ResultScreen)
  const handleSaveCurrentReceipt = useCallback(async () => {
    if (!currentReceipt) return;

    useScannerStore.getState().setIsSaving(true);

    try {
      const result = await saveCurrentReceipt(currentReceipt);

      if ("success" in result && result.success) {
        // Sucesso: o currentReceipt já foi atualizado pelo saveCurrentReceipt
        // Vamos resetar após breve delay para mostrar o estado de sucesso
        setTimeout(() => {
          setCurrentReceipt(null);
          stopCamera();
        }, 1000);
      }
      // Se for duplicata, o DuplicateModal será exibido (lida no saveCurrentReceipt)
      // Se for erro, a notificação já foi mostrada
    } catch (err) {
      logger.error('ScannerTab', 'Erro ao salvar nota', err);
      notify.error('Erro ao salvar nota.');
    } finally {
      useScannerStore.getState().setIsSaving(false);
    }
  }, [currentReceipt, saveCurrentReceipt, setCurrentReceipt, stopCamera]);

  // Handler de duplicata
  const handleSetDuplicateReceipt = useCallback(
    (receipt: typeof duplicateReceipt) => {
      setDuplicateReceipt(receipt);
    },
    [setDuplicateReceipt]
  );

  const handleForceSaveDuplicate = useCallback(async () => {
    if (!duplicateReceipt) return;

    // Re-salvar com forceReplace
    const result = await saveReceipt(duplicateReceipt, true);
    if ("success" in result && result.success) {
      setCurrentReceipt(result.receipt);
      setDuplicateReceipt(null);
      notify.success('Nota atualizada com sucesso!');
      // Resetar após breve delay
      setTimeout(() => {
        setCurrentReceipt(null);
        stopCamera();
      }, 1000);
    }
  }, [duplicateReceipt, saveReceipt, setCurrentReceipt, setDuplicateReceipt, stopCamera]);

  // Calcular total do receipt
  const calculateReceiptTotal = useCallback(
    (items: ReceiptItem[]) => {
      return items.reduce((acc, item) => acc + (item.total ?? item.price * item.quantity), 0);
    },
    []
  );

  return (
    <>
      {/* Tela Manual */}
      {manualMode && (
        <ManualReceiptForm
          manualData={manualData}
          setManualData={getDefaultManualData}
          manualItem={manualItem}
          setManualItem={setManualItem}
          onAddManualItem={handleAddManualItem}
          onSaveManualReceipt={handleSaveManualReceipt}
          onCancel={handleCancelManualReceipt}
          calculateReceiptTotal={calculateReceiptTotal}
        />
      )}

      {/* Tela de Resultado (prioridade máxima) */}
      {!manualMode && currentReceipt && (
        <ResultScreen
          currentReceipt={currentReceipt}
          onReset={handleReset}
          onSave={handleSaveCurrentReceipt}
          isSaving={isSaving}
          calculateReceiptTotal={calculateReceiptTotal}
        />
      )}

      {/* Tela Inicial */}
      {!manualMode && !currentReceipt && !isScanning && !isLoading && (
        <IdleScreen
          onStartCamera={() => startCamera('environment', handleScanSuccess)}
          onFileUpload={handleFileUpload}
          onManualMode={() => setManualMode(true)}
          handleUrlSubmit={handleUrlSubmit}
          handleTextSubmit={processRawText}
          isLoading={isLoading}
          isScanning={isScanning}
          error={error}
        />
      )}

      {/* Tela de Escaneamento */}
      {!manualMode && !currentReceipt && isScanning && (
        <ScanningScreen
          onStopCamera={stopCamera}
          torch={torch}
          torchSupported={torchSupported}
          applyTorch={applyTorch}
          isNative={isNativeSupported}
          nativeVideoRef={nativeVideoRef}
        />
      )}

      {/* Tela de Loading */}
      {!manualMode && !currentReceipt && isLoading && (
        <LoadingScreen step={loadingStep} />
      )}

      {/* Modal de Duplicata */}
      {duplicateReceipt && (
        <DuplicateModal
          duplicateReceipt={duplicateReceipt}
          onCancel={() => handleSetDuplicateReceipt(null)}
          onForceSave={handleForceSaveDuplicate}
        />
      )}
    </>
  );
}

export default ScannerTab;
