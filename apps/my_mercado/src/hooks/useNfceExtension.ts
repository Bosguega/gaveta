import { useCallback, useRef } from 'react';

const EXT_TIMEOUT = 25000;

export function useNfceExtension() {
  const pendingRef = useRef<Map<string, (text: string) => void>>(new Map());
  const rejectRef = useRef<Map<string, (err: Error) => void>>(new Map());

  const isAvailable = useCallback(async () => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', handler);
        window.clearTimeout(timeoutId);
        resolve(value);
      };
      const handler = (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin) return;
        if (e.data?.type === 'nfce-ext-status') finish(!!e.data.active);
      };
      const timeoutId = window.setTimeout(() => finish(false), 1000);
      window.addEventListener('message', handler);
      window.postMessage({ type: 'nfce-ping' }, '*');
    });
  }, []);

  const requestText = useCallback((url: string) => {
    return new Promise<string>((resolve, reject) => {
      const requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      let timeoutId: number | null = null;

      const cleanup = () => {
        window.removeEventListener('message', handler);
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        pendingRef.current.delete(requestId);
        rejectRef.current.delete(requestId);
      };

      const handler = (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin) return;
        const d = e.data;
        if (!d || typeof d !== 'object' || d.requestId !== requestId) return;

        if (d.type === 'nfce-import-ack' && !d.ok) {
          cleanup();
          reject(new Error(d.error || 'A extensão recusou o link da NFC-e'));
          return;
        }

        if (d.type === 'nfce-import-result') {
          if (!d.ok || typeof d.text !== 'string' || d.text.trim().length < 50) {
            cleanup();
            reject(new Error(d.error || 'Falha na captura da NFC-e'));
            return;
          }
          window.postMessage({ type: 'nfce-delivery-ack', requestId }, '*');
          cleanup();
          resolve(d.text);
        }
      };

      window.addEventListener('message', handler);
      pendingRef.current.set(requestId, resolve);
      rejectRef.current.set(requestId, reject);

      timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('Timeout na captura da NFC-e'));
      }, EXT_TIMEOUT);

      window.postMessage({ type: 'nfce-import', requestId, url }, '*');
    });
  }, []);

  return { isAvailable, requestText };
}
