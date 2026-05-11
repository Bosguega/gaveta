import { useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { logger } from '../utils/logger';

/**
 * Hook para escanear QR Code a partir de arquivos de imagem (foto/galeria).
 *
 * Usa BarcodeDetector API nativa quando disponível (mais rápido),
 * com fallback para html5-qrcode.scanFile.
 */
export function useImageQrScanner() {

    const decodeQRFromImage = useCallback(async (file: File): Promise<string | null> => {
        logger.debug('ImageScanner', 'Decodificando QR Code da imagem', file.name);

        // Tentar usar BarcodeDetector nativo primeiro
        if ('BarcodeDetector' in window) {
            try {
                const bitmap = await createImageBitmap(file);
                try {
                    const detector = new BarcodeDetector({ formats: ['qr_code'] });
                    const barcodes = await detector.detect(bitmap);

                    if (barcodes.length > 0 && barcodes[0].rawValue) {
                        logger.debug('ImageScanner', 'QR Code detectado via BarcodeDetector!');
                        return barcodes[0].rawValue;
                    }
                } finally {
                    bitmap.close();
                }
            } catch (err) {
                logger.warn('ImageScanner', 'BarcodeDetector falhou, tentando fallback html5-qrcode', err);
            }
        }

        // Fallback: usar html5-qrcode scanFile
        try {
            logger.debug('ImageScanner', 'Usando fallback html5-qrcode.scanFile');
            const html5QrCode = new Html5Qrcode('qr-image-reader');

            // O scanFile retorna uma Promise com o texto decodificado
            const decodedText = await html5QrCode.scanFile(file, false);

            if (decodedText) {
                logger.debug('ImageScanner', 'QR Code detectado via html5-qrcode!');
                return decodedText;
            }

            return null;
        } catch (err) {
            logger.warn('ImageScanner', 'html5-qrcode.scanFile falhou', err);
            return null;
        }
    }, []);

    return { decodeQRFromImage };
}
