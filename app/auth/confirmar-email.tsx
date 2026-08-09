import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  EMAIL_OTP_LENGTH,
  EMAIL_OTP_RESEND_SECONDS,
  isValidEmailOtp,
  normalizeEmailOtp,
} from '@/lib/auth-security';
import { getPostAuthRoute } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConfirmEmailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const {
    pendingVerificationEmail,
    authLinkChecking,
    recoveryReady,
    resendEmailConfirmation,
    session,
    verifyEmailCode,
  } = useAuth();
  const [email, setEmail] = useState(pendingVerificationEmail ?? '');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(
    pendingVerificationEmail ? EMAIL_OTP_RESEND_SECONDS : 0
  );

  useEffect(() => {
    if (!pendingVerificationEmail) return;
    setEmail((current) => current || pendingVerificationEmail);
    setResendSeconds((current) => current || EMAIL_OTP_RESEND_SECONDS);
  }, [pendingVerificationEmail]);

  useEffect(() => {
    let active = true;

    if (
      session &&
      !authLinkChecking &&
      !recoveryReady &&
      pathname === '/auth/confirmar-email'
    ) {
      void getPostAuthRoute(session.user.id).then((route) => {
        if (active) router.replace(route);
      });
    }

    return () => {
      active = false;
    };
  }, [authLinkChecking, pathname, recoveryReady, router, session]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timeout = setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [resendSeconds]);

  const validateEmail = () => {
    const valid = EMAIL_REGEX.test(email.trim());
    setEmailError(valid ? undefined : 'Informe o e-mail usado no cadastro.');
    return valid;
  };

  const confirmCode = async () => {
    const emailIsValid = validateEmail();
    const codeIsValid = isValidEmailOtp(code);
    setCodeError(codeIsValid ? undefined : `Digite os ${EMAIL_OTP_LENGTH} números do código.`);
    setMessage(undefined);
    if (!emailIsValid || !codeIsValid) return;

    setSubmitting(true);
    const result = await verifyEmailCode(email.trim(), code);
    setSubmitting(false);
    if (!result.ok) {
      setCodeError(result.message);
      return;
    }
    setMessage('E-mail confirmado. Entrando no KAD...');
  };

  const resendCode = async () => {
    if (!validateEmail() || resendSeconds > 0) return;
    setMessage(undefined);
    setCodeError(undefined);
    setResending(true);
    const result = await resendEmailConfirmation(email.trim());
    setResending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setCode('');
    setResendSeconds(EMAIL_OTP_RESEND_SECONDS);
    setMessage('Novo código enviado. Confira também a caixa de spam.');
  };

  const resendLabel = resending
    ? 'Enviando novo código...'
    : resendSeconds > 0
      ? `Reenviar código em ${resendSeconds}s`
      : 'Reenviar código';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Confirmar e-mail"
        onBack={() => router.replace('/auth/login')}
        center
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="keypad-outline" size={30} color={colors.primary} />
          </View>

          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>FALTA SÓ UM PASSO</Text>
            <Text style={[styles.title, { color: colors.text }]}>Digite o código recebido</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Se este e-mail for novo, enviaremos um código de {EMAIL_OTP_LENGTH} dígitos para confirmar o cadastro.
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="E-mail"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setEmailError(undefined);
                setMessage(undefined);
              }}
              placeholder="voce@email.com"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              error={emailError}
            />
            <TextField
              label={`Código de ${EMAIL_OTP_LENGTH} dígitos`}
              value={code}
              onChangeText={(value) => {
                setCode(normalizeEmailOtp(value));
                setCodeError(undefined);
                setMessage(undefined);
              }}
              placeholder="000000"
              icon="keypad-outline"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={EMAIL_OTP_LENGTH}
              style={styles.codeInput}
              error={codeError}
            />
          </View>

          {message ? (
            <View style={[styles.messageBox, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            </View>
          ) : null}

          <Button
            label={submitting ? 'Confirmando...' : 'Confirmar código'}
            icon="checkmark-circle-outline"
            size="lg"
            onPress={confirmCode}
            disabled={submitting || resending}
            fullWidth
          />
          <Button
            label={resendLabel}
            variant="secondary"
            onPress={resendCode}
            disabled={submitting || resending || resendSeconds > 0}
            fullWidth
          />

          <View
            style={[
              styles.accountHelp,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}>
            <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
            <View style={styles.accountHelpBody}>
              <Text style={[styles.accountHelpTitle, { color: colors.text }]}>Não recebeu o código?</Text>
              <Text style={[styles.accountHelpText, { color: colors.textMuted }]}>Este e-mail pode já estar cadastrado. Tente entrar ou recuperar sua senha.</Text>
              <View style={styles.accountActions}>
                <Pressable
                  onPress={() => router.replace('/auth/login')}
                  accessibilityRole="button"
                  accessibilityLabel="Entrar na conta existente"
                  style={({ pressed }) => [styles.accountAction, pressed && styles.pressed]}>
                  <Text style={[styles.link, { color: colors.primary }]}>Entrar</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/auth/recuperar-senha')}
                  accessibilityRole="button"
                  accessibilityLabel="Recuperar senha"
                  style={({ pressed }) => [styles.accountAction, pressed && styles.pressed]}>
                  <Text style={[styles.link, { color: colors.primary }]}>Recuperar senha</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: Math.min(CONTENT_MAX_WIDTH, 480),
    alignSelf: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  icon: {
    width: 62,
    height: 62,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { gap: Spacing.xs },
  eyebrow: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.9,
  },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: FontSize.body, lineHeight: 21 },
  form: { gap: Spacing.lg },
  codeInput: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    letterSpacing: 8,
    textAlign: 'center',
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  message: { flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  accountHelp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  accountHelpBody: { flex: 1, gap: 4 },
  accountHelpTitle: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  accountHelpText: { fontSize: FontSize.small, lineHeight: 19 },
  accountActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  accountAction: { paddingVertical: Spacing.xs },
  link: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  pressed: { opacity: 0.6 },
});
