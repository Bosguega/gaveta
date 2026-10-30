(function () {
  const isSefaz = location.hostname === 'www.nfce.fazenda.sp.gov.br';

  if (isSefaz) {
    function capture() {
      const text = document.body ? document.body.innerText : '';
      chrome.runtime.sendMessage({ type: 'nfce-captured', text: text });
    }
    const start = Date.now();
    const timeout = 10000;
    const minChars = 200;
    const interval = setInterval(() => {
      const text = document.body ? document.body.innerText : '';
      if (text.length >= minChars || Date.now() - start > timeout) {
        clearInterval(interval);
        capture();
      }
    }, 500);
    return;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'nfce-import') {
      chrome.runtime.sendMessage({ type: 'import-nfce', requestId: data.requestId, url: data.url }, (resp) => {
        window.postMessage({ type: 'nfce-import-ack', requestId: data.requestId, ok: !!(resp && resp.ok), error: resp && resp.error }, '*');
      });
    }
    if (data.type === 'nfce-delivery-ack') {
      chrome.runtime.sendMessage({ type: 'delivery-ack', requestId: data.requestId }, (resp) => {
        window.postMessage({ type: 'nfce-delivery-ack-result', requestId: data.requestId, ok: !!(resp && resp.ok) }, '*');
      });
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'import-result') {
      window.postMessage({
        type: 'nfce-import-result',
        requestId: msg.requestId,
        ok: msg.ok,
        text: msg.text,
        charCount: msg.charCount,
        error: msg.error,
        step: msg.step
      }, '*');
    }
  });

  chrome.runtime.sendMessage({ type: 'ping' }, (resp) => {
    window.postMessage({ type: 'nfce-ext-status', active: !!(resp && resp.ok) }, '*');
  });
})();