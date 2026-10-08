import { CAPTCHA_MESSAGE, captchaEnabled, captchaMessage } from '../../../contracts/auth-captcha.ts';

let running = false;

/** One challenge per explicit auth attempt; no persistence, token cache or retries. */
export async function requestAuthCaptcha(): Promise<{ token?: string; error?: string }> {
  if (running) return { error: 'Conclua a verificação de segurança que já está aberta.' };
  running = true;
  try {
    const response = await fetch('/api/public-config', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { error: CAPTCHA_MESSAGE };
    const config = await response.json() as { captchaEnabled?: unknown };
    if (!captchaEnabled(config.captchaEnabled)) return {};
    const nonce = crypto.randomUUID();
    const dialog = document.createElement('dialog');
    dialog.className = 'auth-captcha-dialog';
    dialog.setAttribute('aria-label', 'Verificação de segurança');
    const heading = document.createElement('h2'); heading.textContent = 'Verificação de segurança';
    const frame = document.createElement('iframe');
    frame.title = 'Desafio de segurança'; frame.src = `/auth/captcha#nonce=${nonce}`;
    frame.referrerPolicy = 'no-referrer';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar';
    dialog.append(heading, frame, cancel); document.body.append(dialog);
    const previousFocus = document.activeElement;
    return await new Promise((resolve) => {
      let finished = false;
      const finish = (result: { token?: string; error?: string }) => {
        if (finished) return; finished = true;
        clearTimeout(timer); window.removeEventListener('message', onMessage);
        window.removeEventListener('popstate', onCancel);
        dialog.close(); dialog.remove();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        resolve(result);
      };
      const onCancel = () => finish({ error: 'Verificação cancelada. Tente novamente quando quiser.' });
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const result = captchaMessage(event.data, nonce);
        if (result) finish(result);
      };
      const timer = setTimeout(() => finish({ error: CAPTCHA_MESSAGE }), 125000);
      window.addEventListener('message', onMessage); window.addEventListener('popstate', onCancel);
      cancel.onclick = onCancel;
      dialog.addEventListener('cancel', event => { event.preventDefault(); onCancel(); });
      frame.onerror = () => finish({ error: CAPTCHA_MESSAGE });
      try { dialog.showModal(); cancel.focus(); }
      catch { finish({ error: CAPTCHA_MESSAGE }); }
    });
  } catch { return { error: CAPTCHA_MESSAGE }; }
  finally { running = false; }
}
