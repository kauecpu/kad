import { WebView } from 'react-native-webview';
import { CAPTCHA_MESSAGE, captchaMessage } from '@/contracts/auth-captcha';

export type CaptchaFrameProps = {
  url: string; nonce: string; onResult: (result: { token?: string; error?: string }) => void;
};

export function AuthCaptchaFrame({ url, nonce, onResult }: CaptchaFrameProps) {
  const source = `${url}#nonce=${encodeURIComponent(nonce)}`;
  return <WebView source={{ uri: source }} javaScriptEnabled domStorageEnabled
    // Route EVERY navigation through the strict callback below. A narrower
    // originWhitelist makes WebView open rejected origins in the system browser.
    originWhitelist={['*']}
    allowFileAccess={false} mixedContentMode="never" setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={request => {
      if (request.isTopFrame !== false) return request.url === source || request.url === url;
      return request.url === 'about:blank' || request.url === 'about:srcdoc'
        || request.url.startsWith('https://challenges.cloudflare.com/');
    }}
    onMessage={event => {
      if (event.nativeEvent.url !== source && event.nativeEvent.url !== url) return;
      try {
        const result = captchaMessage(JSON.parse(event.nativeEvent.data), nonce);
        if (result) onResult(result);
      } catch { /* Untrusted non-protocol message. */ }
    }}
    onError={() => onResult({ error: CAPTCHA_MESSAGE })}
    onHttpError={() => onResult({ error: CAPTCHA_MESSAGE })} />;
}
