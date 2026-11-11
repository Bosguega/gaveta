(function () {
  const isSefazPage =
    location.hostname === 'www.nfce.fazenda.sp.gov.br' &&
    /^\/NFCeConsultaPublica\/Paginas\/ConsultaQRCode\.aspx$/i.test(location.pathname);

  if (isSefazPage) {
    const startedAt = Date.now();
    const maxWait = 15000;
    const minChars = 200;
    let sent = false;

    function tryCapture(force = false) {
      if (sent) return;
      const text = document.body ? document.body.innerText : '';
      const hasReceiptContent = text.length >= minChars && /NFC-?e|Nota Fiscal/i.test(text);
      if (hasReceiptContent || force || Date.now() - startedAt >= maxWait) {
        sent = true;
        chrome.runtime.sendMessage({ type: 'nfce-captured', text });
      }
    }

    const interval = setInterval(() => {
      if (sent) {
        clearInterval(interval);
        return;
      }
      tryCapture(Date.now() - startedAt >= maxWait);
    }, 500);
    return;
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'nfce-ping') {
      if (!chrome || !chrome.runtime) {
        window.postMessage({ type: 'nfce-ext-status', active: false }, '*');
        return;
      }
      chrome.runtime.sendMessage({ type: 'ping' }, (resp) => {
        window.postMessage({ type: 'nfce-ext-status', active: !!(resp && resp.ok) }, '*');
      });
      return;
    }
    if (data.type === 'nfce-import') {
      chrome.runtime.sendMessage({ type: 'import-nfce', requestId: data.requestId, url: data.url }, (resp) => {
        window.postMessage({
          type: 'nfce-import-ack',
          requestId: data.requestId,
          ok: !!(resp && resp.ok),
          error: resp && resp.error,
        }, '*');
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
        step: msg.step,
      }, '*');
    }
  });

  chrome.runtime.sendMessage({ type: 'ping' }, (resp) => {
    window.postMessage({ type: 'nfce-ext-status', active: !!(resp && resp.ok) }, '*');
  });
})();
