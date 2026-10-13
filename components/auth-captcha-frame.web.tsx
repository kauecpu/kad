import { useEffect, useRef } from 'react';
import { CAPTCHA_MESSAGE, captchaMessage } from '@/contracts/auth-captcha';
import type { CaptchaFrameProps } from './auth-captcha-frame';

export function AuthCaptchaFrame({ url, nonce, onResult }: CaptchaFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (new URL(url).origin !== location.origin) {
      onResult({ error: 'Configure a página de verificação no mesmo domínio desta versão web.' });
      return;
    }
    const listener = (event: MessageEvent) => {
      if (event.origin !== new URL(url).origin || event.source !== ref.current?.contentWindow) return;
      const result = captchaMessage(event.data, nonce);
      if (result) onResult(result);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [url, nonce, onResult]);
  return <iframe ref={ref} title="Verificação de segurança" src={`${url}#nonce=${nonce}`}
    referrerPolicy="no-referrer" style={{ width: '100%', height: 220, border: 0 }}
    onError={() => onResult({ error: CAPTCHA_MESSAGE })} />;
}
