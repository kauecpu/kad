import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { AuthCaptchaFrame } from '@/components/auth-captcha-frame';
import { Button } from '@/components/ui/button';
import { CAPTCHA_MESSAGE, captchaEnabled, captchaPageUrl } from '@/contracts/auth-captcha';
import { useTheme } from '@/hooks/use-theme';

type Result = { token?: string; error?: string };

export function useAuthCaptcha() {
  const [challenge, setChallenge] = useState<{ url: string; nonce: string }>();
  const pending = useRef<((result: Result) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = useCallback((result: Result) => {
    clearTimeout(timer.current);
    const resolve = pending.current; pending.current = null;
    setChallenge(undefined); resolve?.(result);
  }, []);
  useEffect(() => () => {
    clearTimeout(timer.current);
    pending.current?.({ error: CAPTCHA_MESSAGE }); pending.current = null;
  }, []);
  const requestCaptcha = useCallback(async (): Promise<Result> => {
    try {
      if (!captchaEnabled(process.env.EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED)) return {};
      if (pending.current) return { error: 'Conclua a verificação de segurança que já está aberta.' };
      const url = captchaPageUrl(process.env.EXPO_PUBLIC_AUTH_CAPTCHA_URL);
      const nonce = Crypto.randomUUID();
      return await new Promise<Result>(resolve => {
        pending.current = resolve;
        setChallenge({ url, nonce });
        timer.current = setTimeout(() => finish({ error: CAPTCHA_MESSAGE }), 125000);
      });
    } catch { return { error: CAPTCHA_MESSAGE }; }
  }, [finish]);
  return { requestCaptcha, captchaView: <CaptchaModal challenge={challenge} finish={finish} /> };
}

function CaptchaModal({ challenge, finish }: { challenge?: { url: string; nonce: string }; finish: (result: Result) => void }) {
  const { colors } = useTheme();
  const cancel = () => finish({ error: 'Verificação cancelada. Tente novamente quando quiser.' });
  return <Modal visible={Boolean(challenge)} transparent animationType="none" onRequestClose={cancel}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Verificação de segurança</Text>
        <View style={styles.frame}>{challenge && <AuthCaptchaFrame {...challenge} onResult={finish} />}</View>
        <Button label="Cancelar" onPress={cancel} />
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 8, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { padding: 16, borderRadius: 12, width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  frame: { height: 220, marginHorizontal: -16, marginBottom: 12 },
});
