import { useCallback, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { notify } from '../utils/notifications';
import { logger } from '../utils/logger';
import { useScannerStore } from '../stores/useScannerStore';

/**
 * Hook para controle da câmera no scanner de NFC-e
 * Gerencia inicialização, parada e controles (torch/zoom)
 */
export function useCameraScanner() {
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const torchTrackRef = useRef<MediaStreamTrack | null>(null);

  const scanning = useScannerStore((state) => state.scanning);
  const setScanning = useScannerStore((state) => state.setScanning);
  const zoom = useScannerStore((state) => state.setZoom);
  const setZoom = useScannerStore((state) => state.setZoom);
  const zoomSupported = useScannerStore((state) => state.zoomSupported);
  const setZoomSupported = useScannerStore((state) => state.setZoomSupported);
  const torch = useScannerStore((state) => state.torch);
  const setTorch = useScannerStore((state) => state.setTorch);
  const torchSupported = useScannerStore((state) => state.torchSupported);
  const setTorchSupported = useScannerStore((state) => state.setTorchSupported);

  // Ref para controle de processamento
  const processingRef = useRef(false);

  const stopCamera = useCallback(() => {
    // Parar o torch track se existir
    if (torchTrackRef.current) {
      torchTrackRef.current.stop();
      torchTrackRef.current = null;
    }

    if (html5QrcodeRef.current) {
      html5QrcodeRef.current
        .stop()
        .then(() => {
          html5QrcodeRef.current?.clear();
          html5QrcodeRef.current = null;
        })
        .catch((err) => {
          console.warn('Erro ao parar html5-qrcode:', err);
          html5QrcodeRef.current = null;
        });
    }
    setScanning(false);
    setZoom(1);
    setZoomSupported(false);
    setTorch(false);
  }, [setScanning, setTorch, setZoom, setZoomSupported]);

  const startCamera = useCallback(
    async (
      cameraId: string,
      handleScanSuccess: (decodedText: string) => Promise<void>,
    ) => {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        html5QrcodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        };

        await html5QrCode.start(
          cameraId,
          config,
          (decodedText) => {
            if (!processingRef.current && decodedText) {
              stopCamera();
              handleScanSuccess(decodedText);
            }
          },
          (errorMessage) => {
            // Erros de leitura são normais durante o scan
            if (import.meta.env.DEV) {
              console.warn('Scan error:', errorMessage);
            }
          },
        );

        // Verificar suporte a torch (lanterna)
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          const track = testStream.getVideoTracks()[0];

          if (track) {
            const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
              torch?: boolean;
            };
            setTorchSupported(!!capabilities.torch);
            track.stop();
          }

          // Parar todos os tracks do stream de teste
          testStream.getTracks().forEach((t) => t.stop());
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('Torch capability check failed:', err);
          }
          setTorchSupported(false);
        }

        // Zoom não é suportado nativamente pelo html5-qrcode
        setZoomSupported(false);
      } catch (err) {
        setScanning(false);
        notify.error(
          'Câmera não disponível. Verifique as permissões ou se o site usa HTTPS.',
        );
        logger.error('CameraScanner', 'Camera fail', err);
      }
    },
    [setScanning, setTorchSupported, setZoomSupported, stopCamera],
  );

  const applyTorch = useCallback(
    async (on: boolean) => {
      if (!html5QrcodeRef.current) return;

      try {
        // Se já tem um track ativo, parar primeiro
        if (torchTrackRef.current) {
          torchTrackRef.current.stop();
          torchTrackRef.current = null;
        }

        // html5-qrcode não tem API direta para torch
        // Tentar acessar a câmera e aplicar torch manualmente
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
          torch?: boolean;
        };

        if (capabilities.torch) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.applyConstraints({ advanced: [{ torch: on }] as any });
          setTorch(on);

          // Manter referência do track se a lanterna estiver ligada
          if (on) {
            torchTrackRef.current = track;
          } else {
            track.stop();
          }
        } else {
          // Sem suporte a torch, apenas paramos o stream
          track.stop();
        }

        // Parar todos os outros tracks do stream
        stream.getTracks().forEach((t) => {
          if (t !== track) t.stop();
        });
      } catch (err) {
        console.warn('Torch error:', err);
      }
    },
    [setTorch],
  );

  return {
    html5QrcodeRef,
    processingRef,
    scanning,
    zoom,
    zoomSupported,
    torch,
    torchSupported,
    startCamera,
    stopCamera,
    applyTorch,
  };
}
