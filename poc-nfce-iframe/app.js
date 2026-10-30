const ALLOWED_HOSTS = ['www.nfce.fazenda.sp.gov.br', 'nfce.fazenda.sp.gov.br'];
const urlInput = document.getElementById('url');
const frame = document.getElementById('frame');
const target = document.getElementById('target');
const diag = document.getElementById('diag');

function log(msg) { diag.textContent += msg + '\n'; }

function validateUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { return { ok: false, reason: 'URL inválida: ' + e.message }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'URL não usa HTTPS.' };
  if (!ALLOWED_HOSTS.includes(u.hostname)) return { ok: false, reason: 'Domínio não permitido: ' + u.hostname };
  return { ok: true, url: u.href };
}

document.getElementById('open').addEventListener('click', () => {
  const v = validateUrl(urlInput.value.trim());
  if (!v.ok) { log('[Abrir] ' + v.reason); return; }
  log('[Abrir] carregando ' + v.url);
  frame.src = v.url;
  frame.onload = () => log('[Abrir] onload disparado (carregamento visual concluído).');
  frame.onerror = (e) => log('[Abrir] onerror disparado: ' + (e && e.message ? e.message : 'erro observável'));
});

document.getElementById('read').addEventListener('click', () => {
  try {
    const doc = frame.contentDocument;
    if (!doc) { log('[Ler] contentDocument é null (provável cross-origin ou sem permissão).'); return; }
    const text = doc.body ? doc.body.innerText : '';
    target.value = text;
    log('[Ler] texto lido com sucesso (' + text.length + ' chars).');
  } catch (e) {
    log('[Ler] ERRO de segurança/acesso: ' + (e && e.message ? e.message : e));
    log('[Ler] Causa provável: política Same-Origin (CORS/X-Frame-Options/CSP). O carregamento visual não garante acesso ao DOM.');
  }
});

document.getElementById('paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    target.value = text;
    log('[Colar] leitura da área de transferência bem-sucedida (' + text.length + ' chars).');
  } catch (e) {
    log('[Colar] falha: ' + (e && e.name ? e.name : '') + ' - ' + (e && e.message ? e.message : e));
    log('[Colar] Permissão negada ou API indisponível. Nenhuma cópia foi simulada.');
  }
});