import { useCallback } from 'react';
import { notify } from '../utils/notifications';
import { errorMessages } from '../utils/errorMessages';
import { parseNFCeSP, parseRawTextReceipt } from '../services/receiptParser';
import { useScannerStore } from '../stores/useScannerStore';
import { logger } from '../utils/logger';
import type { Receipt } from '../types/domain';

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

/**
 * Hook para processamento de QR Code e URL de NFC-e
 */
export function useQRCodeProcessor(saveReceipt: SaveReceiptFn) {
  const setLoading = useScannerStore((state) => state.setLoading);
  const setCurrentReceipt = useScannerStore((state) => state.setCurrentReceipt);
  const setDuplicateReceipt = useScannerStore((state) => state.setDuplicateReceipt);
  const setError = useScannerStore((state) => state.setError);

  const processQRCode = useCallback(
    async (decodedText: string) => {
      logger.debug('QRProcessor', 'Processando QR Code', decodedText.substring(0, 100));

      setLoading(true);

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

        logger.debug('QRProcessor', 'Salvando receipt...');

        const result = await saveReceipt(extractedData);

        logger.debug('QRProcessor', 'Result do save:', result);

        if (isDuplicateResult(result)) {
          logger.info('QRProcessor', 'Nota duplicada detectada');
          setDuplicateReceipt(extractedData);
          notify.nfceDuplicate(result.existingReceipt.date.split(' ')[0]);
        } else if (isSuccessResult(result)) {
          logger.info('QRProcessor', 'Nota salva com sucesso!', result.receipt.id);
          setCurrentReceipt(result.receipt);
          notify.success('Nota fiscal processada com sucesso!');
        }
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
      }
    },
    [saveReceipt, setLoading, setCurrentReceipt, setDuplicateReceipt, setError],
  );

  const processRawText = useCallback(
    async (text: string) => {
      logger.debug('QRProcessor', 'Processando texto manual');
      setLoading(true);
      setError(null);

      try {
        const extractedData = parseRawTextReceipt(text);

        const result = await saveReceipt(extractedData);

        if (isDuplicateResult(result)) {
          setDuplicateReceipt(extractedData);
          notify.nfceDuplicate(result.existingReceipt.date.split(' ')[0]);
        } else if (isSuccessResult(result)) {
          setCurrentReceipt(result.receipt);
          notify.success('Nota processada com sucesso!');
        }
      } catch (err: unknown) {
        logger.error('QRProcessor', 'Erro ao processar texto', err);
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        notify.error(errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [saveReceipt, setLoading, setCurrentReceipt, setDuplicateReceipt, setError]
  );

  return {
    processQRCode,
    processRawText,
  };
}
