/** Dedicated HTTPS page shared by the browser dialog and native WebView. No credentials. */
export function captchaPage(siteKey: string | undefined): Response {
  const nonce = crypto.randomUUID();
  const validKey = typeof siteKey === 'string' && /^[a-zA-Z0-9_-]{3,100}$/.test(siteKey);
  const script = `
    const nonce = new URLSearchParams(location.hash.slice(1)).get('nonce');
    function send(value) {
      const message = {type: 'kad-captcha', nonce, ...value};
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
      else if (parent !== window) parent.postMessage(message, location.origin);
    }
    let widget;
    let resolved = false;
    window.kadCaptchaReady = () => {
      widget = turnstile.render('#challenge', {
        sitekey: ${JSON.stringify(validKey ? siteKey : '')}, size: 'flexible', language: 'pt-br', retry: 'never',
        callback: token => { resolved = true; send({token}); },
        'expired-callback': () => send({error:'expired'}),
        'error-callback': () => { send({error:'failed'}); return true; },
        'timeout-callback': () => send({error:'expired'})
      });
    };
    setTimeout(() => { if (!resolved) send({error:'unavailable'}); }, 120000);
    ${validKey ? '' : "send({error:'unavailable'});"}
  `;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Verificação de segurança | KAD</title>
    <style nonce="${nonce}">:root{color-scheme:light dark;font-family:Inter,system-ui,sans-serif}body{margin:0}p{margin:8px 12px 12px;font-size:14px;line-height:1.5}#challenge{min-height:70px}</style></head><body>
    <p role="status">${validKey ? 'Conclua a verificação para continuar.' : 'Verificação indisponível. Feche esta janela e tente mais tarde.'}</p><div id="challenge"></div>
    <script nonce="${nonce}">${script}</script>${validKey ? `<script nonce="${nonce}" src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=kadCaptchaReady&amp;render=explicit" async defer></script>` : ''}</body></html>`;
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; style-src 'nonce-${nonce}'; frame-src https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; base-uri 'none'; form-action 'none'; frame-ancestors 'self'`,
  } });
}
