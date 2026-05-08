import { useCallback } from "react";
import { notify } from "../../utils/notifications";
import { logger } from "../../utils/logger";
import { useReceiptScanner } from "../../hooks/useReceiptScanner";
import { useReceiptsSessionStore } from "../../stores/useReceiptsSessionStore";
import { useUiStore } from "../../stores/useUiStore";
import { useSaveReceipt } from "../../hooks/queries/useReceiptsQuery";
import { IdleScreen } from "./screens/IdleScreen";
import { ScanningScreen } from "./screens/ScanningScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { ManualReceiptForm } from "./forms/ManualReceiptForm";
import { DuplicateModal } from "./modals/DuplicateModal";
import type { Receipt } from "../../types/domain";
import type { SaveReceiptResponse } from "../../types/scanner";

function ScannerTab() {
  const saveReceiptMutation = useSaveReceipt();
  const sessionUserId = useReceiptsSessionStore((state) => state.sessionUserId);
  const tab = useUiStore((state) => state.tab);

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
    startCamera,
    stopCamera,
    applyTorch,
    handleScanSuccess,
    processRawText,
    handleAddManualItem,
    handleSaveManualReceipt,
    handleCancelManualReceipt,
    getDefaultManualData,
  } = useReceiptScanner({ saveReceipt, tab });

  // Estados derivados
  const isLoading = loading;
  const isScanning = scanning;

  // Handler de upload de arquivo
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const imageUrl = URL.createObjectURL(file);
        // Processar arquivo como URL para o QR Code
        await handleScanSuccess(imageUrl);
        URL.revokeObjectURL(imageUrl);
      } catch (err) {
        logger.error('ScannerTab', 'Erro ao processar arquivo', err);
      }
    },
    [handleScanSuccess]
  );

  // Handler de URL
  const handleUrlSubmit = useCallback(
    async (url: string) => {
      await handleScanSuccess(url);
    },
    [handleScanSuccess]
  );

  // Handler de reset
  const handleReset = useCallback(() => {
    setCurrentReceipt(null);
    stopCamera();
  }, [setCurrentReceipt, stopCamera]);

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
    }
  }, [duplicateReceipt, saveReceipt, setCurrentReceipt, setDuplicateReceipt]);

  // Calcular total do receipt
  // A função é pura e não depende de manualData, apenas do tipo
  const calculateReceiptTotal = useCallback(
    (items: typeof manualData.items) => {
      return items.reduce((acc, item) => acc + (item.total || item.price * item.quantity), 0);
    },
    [manualData]
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
        />
      )}

      {/* Tela de Loading */}
      {!manualMode && !currentReceipt && isLoading && <LoadingScreen />}

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
