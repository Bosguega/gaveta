import { useCallback } from "react";
import { notify } from "../../utils/notifications";
import { logger } from "../../utils/logger";
import { useReceiptScanner } from "../../hooks/useReceiptScanner";
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

  // Handler de upload de arquivo (foto/galeria) — OCR com IA
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const toastId = notify.loading('Extraindo dados da imagem com IA...');

        const { parseReceiptFromImage } = await import('../../services/imageReceiptParser');
        const result = await parseReceiptFromImage(file);

        notify.dismiss(toastId);

        // Feedback de confiança
        const confidenceMessages: Record<string, string> = {
          alta: 'Alta confiança na leitura.',
          media: 'Confiança média — revise os dados antes de salvar.',
          baixa: 'Confiança baixa — a imagem pode estar ilegível, revise cuidadosamente.',
        };

        const confMessage = confidenceMessages[result.confidence] || '';
        if (result.confidence === 'alta') {
          notify.success(`Nota identificada! ${confMessage}`);
        } else if (result.confidence === 'media') {
          notify.warning(`Nota identificada com ressalvas. ${confMessage}`);
        } else {
          notify.warning(`Leitura com baixa confiabilidade. ${confMessage}`);
        }

        // Passar os itens pela pipeline de normalização (consulta/alimenta o dicionário de produtos)
        const { processItemsPipeline } = await import('../../services/productService');

        const rawItemsForPipeline = result.receipt.items.map(item => ({
          name: item.name,
          qty: item.quantity.toString().replace('.', ','),
          unit: item.unit || 'UN',
          unitPrice: item.price.toString().replace('.', ','),
          total: (item.total ?? item.price * item.quantity).toString().replace('.', ',')
        }));

        const processedItems = await processItemsPipeline(rawItemsForPipeline);

        const processedReceipt = {
          ...result.receipt,
          items: processedItems,
        };

        // Atualiza o receipt processado no estado
        setCurrentReceipt(processedReceipt);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        logger.error('ScannerTab', 'Erro ao processar imagem com IA', err);
        notify.error(`Erro ao processar imagem: ${message}`);
      }
    },
    [setCurrentReceipt]
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
  const calculateTotal = useCallback(
    (items: ReceiptItem[]) => {
      return items.reduce((acc, item) => {
        // Se o item foi editado manualmente (preço pago diferente do preço original), calculamos dinamicamente
        const isEdited =
          item.paid_price !== undefined &&
          item.paid_price !== null &&
          item.price !== undefined &&
          item.price !== null &&
          item.paid_price !== item.price;
        if (isEdited) {
          return acc + (item.paid_price as number) * (item.quantity ?? 1);
        }
        if (item.total !== undefined && item.total !== null) {
          return acc + item.total;
        }
        if (item.paid_price !== undefined && item.paid_price !== null) {
          return acc + item.paid_price * (item.quantity ?? 1);
        }
        return acc + item.price * item.quantity;
      }, 0);
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
          calculateReceiptTotal={calculateTotal}
        />
      )}

      {/* Tela de Resultado (prioridade máxima) */}
      {!manualMode && currentReceipt && (
        <ResultScreen
          currentReceipt={currentReceipt}
          onReset={handleReset}
          onSave={handleSaveCurrentReceipt}
          isSaving={isSaving}
          calculateReceiptTotal={calculateTotal}
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
