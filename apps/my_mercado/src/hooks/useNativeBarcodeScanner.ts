import { useCallback, useRef, useEffect, useState } from 'react';
import { notify } from '../utils/notifications';
import { logger } from '../utils/logger';
import { useScannerStore } from '../stores/useScannerStore';

/**
 * Hook para escaneamento de QR Code usando a BarcodeDetector API nativa do navegador.
 * Muito mais rápido e preciso que o html5-qrcode, especialmente para QR Codes pequenos.
 *
 * Fallback: Se BarcodeDetector não estiver disponível, retorna isSupported=false
 * para que o componente pai possa usar html5-qrcode como alternativa.
 */
export function useNativeBarcodeScanner() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const detectorRef = useRef<BarcodeDetector | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const torchTrackRef = useRef<MediaStreamTrack | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    const scanning = useScannerStore((state) => state.scanning);
    const setScanning = useScannerStore((state) => state.setScanning);
    const torch = useScannerStore((state) => state.torch);
    const setTorch = useScannerStore((state) => state.setTorch);
    const torchSupported = useScannerStore((state) => state.torchSupported);
    const setTorchSupported = useScannerStore((state) => state.setTorchSupported);

    // Verificar suporte na inicialização
    useEffect(() => {
        const checkSupport = async () => {
            if (!('BarcodeDetector' in window)) {
                setIsSupported(false);
                return;
            }
            try {
                const supportedFormats = await BarcodeDetector.getSupportedFormats();
                const qrSupported = supportedFormats.includes('qr_code');
                setIsSupported(qrSupported);
                logger.debug('NativeScanner', 'BarcodeDetector suportado?', qrSupported);
            } catch {
                // Se falhar, tenta criar o detector mesmo assim
                setIsSupported(true);
            }
        };
        checkSupport();
    }, []);

    const stopCamera = useCallback(() => {
        // Parar o loop de detecção
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Parar o torch track se existir
        if (torchTrackRef.current) {
            torchTrackRef.current.stop();
            torchTrackRef.current = null;
        }

        // Parar o stream da câmera
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        // Limpar referência do vídeo
        if (videoRef.current) {
            videoRef.current.srcObject = null;
            videoRef.current = null;
        }

        detectorRef.current = null;
        setScanning(false);
        setTorch(false);
    }, [setScanning, setTorch]);

    const detectBarcode = useCallback(async () => {
        if (!videoRef.current || !detectorRef.current || !streamRef.current) return;

        try {
            const video = videoRef.current;

            // Verificar se o vídeo tem dimensões válidas
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                animationFrameRef.current = requestAnimationFrame(detectBarcode);
                return;
            }

            const barcodes = await detectorRef.current.detect(video);

            if (barcodes.length > 0 && !processingRef.current) {
                const barcode = barcodes[0];
                if (barcode.rawValue) {
                    logger.debug('NativeScanner', 'QR Code detectado!', barcode.rawValue.substring(0, 50));
                    processingRef.current = true;
                    stopCamera();
                    return barcode.rawValue;
                }
            }
        } catch (err) {
            // Erros de detecção são normais entre frames
            if (import.meta.env.DEV) {
                console.warn('NativeScanner detection error:', err);
            }
        }

        // Continuar o loop se ainda estiver escaneando
        if (streamRef.current) {
            animationFrameRef.current = requestAnimationFrame(detectBarcode);
        }

        return null;
    }, [stopCamera]);

    const startCamera = useCallback(
        async (
            cameraId: string,
            handleScanSuccess: (decodedText: string) => Promise<void>,
        ): Promise<boolean> => {
            // Se BarcodeDetector não for suportado, retorna false para fallback
            if (!isSupported) {
                logger.warn('NativeScanner', 'BarcodeDetector não suportado, usando fallback');
                return false;
            }

            try {
                // Criar detector
                detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] });

                // Acessar câmera
                const constraints: MediaStreamConstraints = {
                    video: {
                        deviceId: cameraId === 'environment' ? undefined : cameraId,
                        facingMode: cameraId === 'environment' ? 'environment' : undefined,
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                streamRef.current = stream;

                // Criar elemento de vídeo
                const video = document.createElement('video');
                video.setAttribute('playsinline', '');
                video.setAttribute('autoplay', '');
                video.setAttribute('muted', '');
                video.srcObject = stream;
                videoRef.current = video;

                // Aguardar o vídeo estar pronto
                await video.play();

                setScanning(true);

                // Verificar suporte a torch
                const track = stream.getVideoTracks()[0];
                if (track) {
                    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
                        torch?: boolean;
                    };
                    setTorchSupported(!!capabilities.torch);
                }

                // Iniciar loop de detecção
                const detectionLoop = async () => {
                    const result = await detectBarcode();
                    if (result) {
                        await handleScanSuccess(result);
                    }
                };
                animationFrameRef.current = requestAnimationFrame(detectionLoop);

                return true;
            } catch (err) {
                setScanning(false);
                logger.error('NativeScanner', 'Camera fail', err);
                notify.error(
                    'Câmera não disponível. Verifique as permissões ou se o site usa HTTPS.',
                );
                return false;
            }
        },
        [isSupported, setScanning, setTorchSupported, detectBarcode],
    );

    const applyTorch = useCallback(
        async (on: boolean) => {
            if (!streamRef.current) return;

            try {
                if (torchTrackRef.current) {
                    torchTrackRef.current.stop();
                    torchTrackRef.current = null;
                }

                const track = streamRef.current.getVideoTracks()[0];
                if (!track) return;

                const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
                    torch?: boolean;
                };

                if (capabilities.torch) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await track.applyConstraints({ advanced: [{ torch: on }] as any });
                    setTorch(on);

                    if (on) {
                        torchTrackRef.current = track;
                    }
                }
            } catch (err) {
                console.warn('Torch error:', err);
            }
        },
        [setTorch],
    );

    return {
        videoRef,
        isNativeSupported: isSupported,
        scanning,
        torch,
        torchSupported,
        startCamera,
        stopCamera,
        applyTorch,
    };
}
