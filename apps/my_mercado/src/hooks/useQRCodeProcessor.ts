import { useCallback } from 'react';
import { notify } from '../utils/notifications';
import { errorMessages } from '../utils/errorMessages';
import { parseNFCeSP, parseRawTextReceipt } from '../services/receiptParser';
import { useScannerStore } from '../stores/useScannerStore';
import { logger } from '../utils/logger';
import type { Receipt } from '../types/domain';
import type { LoadingStep } from '../types/scanner';

type SaveReceiptResponse =
  | { duplicate: true; existingReceipt: Receipt }
  | { success: true; receipt: Receipt }
  | { success: false; error: unknown };

type SaveReceiptFn = (receipt: Receipt, forceReplace?: boolean) => Promise<SaveReceiptResponse>;

function isDuplicateResult(
  result: SaveReceiptResponse,
): result is { duplicate: true; existingReceipt: Receipt } {
  return 'duplicate' in result && result.duplicate === true;
}

function isSuccessResult(
  result: SaveReceiptResponse,
): result is { success: true; receipt: Receipt } {
  return 'success' in result && result.success === true;
}

function setLoadingStep(step: LoadingStep | null) {
  useScannerStore.getState().setLoadingStep(step);
}

/**
 * Hook para processamento de QR Code e URL de NFC-e
 * Agora APENAS faz o parse e exibe no ResultScreen.
 * O salvamento é feito posteriormente pelo ScannerTab.
 */
export function useQRCodeProcessor(saveReceipt: SaveReceiptFn) {
  const setLoading = useScannerStore((state) => state.setLoading);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);
  const setDuplicateReceipt = useScannerStore((state) => state.setDuplicateReceipt);
  const setError = useScannerStore((state) => state.setError);

  /**
   * Salva a nota atualmente exibida (chamado pelo ScannerTab)
   */
  const saveCurrentReceipt = useCallback(
    async (receipt: Receipt): Promise<SaveReceiptResponse> => {
      setLoadingStep('saving');
      try {
        const result = await saveReceipt(receipt);

        if (isDuplicateResult(result)) {
          logger.info('QRProcessor', 'Nota duplicada detectada');
          setDuplicateReceipt(receipt);
          notify.nfceDuplicate(result.existingReceipt.date.split(' ')[0]);
        } else if (isSuccessResult(result)) {
          logger.info('QRProcessor', 'Nota salva com sucesso!', result.receipt.id);
          setCurrentReceipt(result.receipt);
          notify.success('Nota fiscal processada com sucesso!');
        }

        return result;
      } catch (err: unknown) {
        logger.error('QRProcessor', 'Erro ao salvar nota', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        notify.error(`Erro ao salvar: ${errorMessage}`);
        setError(errorMessage);
        return { success: false, error: err };
      } finally {
        setLoadingStep(null);
        // O loading é desligado externamente
      }
    },
    [saveReceipt, setCurrentReceipt, setDuplicateReceipt, setError],
  );

  const processQRCode = useCallback(
    async (decodedText: string) => {
      logger.debug('QRProcessor', 'Processando QR Code', decodedText.substring(0, 100));

      setLoading(true);
      setLoadingStep('fetching');

      try {
        if (!decodedText || typeof decodedText !== 'string') {
          logger.error('QRProcessor', 'Texto inválido', decodedText);
          notify.qrCodeInvalid();
          throw new Error('Conteúdo do QR Code inválido.');
        }

        setError(null);

        // Verificar se é URL da NFC-e
        const isNfceUrl = decodedText.trim().includes('fazenda.sp.gov.br');

        logger.debug('QRProcessor', 'É URL NFC-e?', isNfceUrl);

        if (isNfceUrl) {
          notify.loading('Buscando dados da NFC-e...');
        }

        logger.debug('QRProcessor', 'Chamando parseNFCeSP...');
        setLoadingStep('parsing');
        const extractedData = await parseNFCeSP(decodedText.trim());

        logger.debug('QRProcessor', 'Parse completado!', {
          itens: extractedData.items.length,
          estabelecimento: extractedData.establishment,
        });

        if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
          logger.error('QRProcessor', 'Nenhum item extraído');
          const errorMsg = isNfceUrl
            ? errorMessages.NFC_E_NOT_FOUND
            : errorMessages.QR_CODE_INVALID;

          notify.error(errorMsg, 15000);
          setError('Falha ao extrair itens da nota.');
          return;
        }

        setLoadingStep('processing');
        logger.debug('QRProcessor', 'Exibindo nota para revisão (sem salvar ainda)...');

        // Apenas exibe a nota no ResultScreen — NÃO salva ainda
        setCurrentReceipt(extractedData);
      } catch (err: unknown) {
        logger.error('QRProcessor', 'Erro ao processar QR Code', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        if (errorMessage.includes('Falha ao obter HTML da NFC-e')) {
          notify.error(errorMessages.NFC_E_PROXY_ERROR, 15000);
        } else {
          notify.error(`Erro ao processar QR Code: ${errorMessage}`);
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
        setLoadingStep(null);
      }
    },
    [setLoading, setCurrentReceipt, setError],
  );

  const processRawText = useCallback(
    async (text: string) => {
      logger.debug('QRProcessor', 'Processando texto manual');
      setLoading(true);
      setLoadingStep('parsing');
      setError(null);

      try {
        const extractedData = parseRawTextReceipt(text);

        if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
          setError('Nenhum item encontrado no texto.');
          notify.error('Texto não contém itens válidos.');
          return;
        }

        setLoadingStep('processing');
        // Apenas exibe — NÃO salva ainda
        setCurrentReceipt(extractedData);
      } catch (err: unknown) {
        logger.error('QRProcessor', 'Erro ao processar texto', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        notify.error(errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
        setLoadingStep(null);
      }
    },
    [setLoading, setCurrentReceipt, setError]
  );

  return {
    processQRCode,
    processRawText,
    saveCurrentReceipt,
  };
}