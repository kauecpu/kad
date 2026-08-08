import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPostAuthRoute } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { authLinkChecking, linkError, recoveryReady, session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    if (
      session &&
      !authLinkChecking &&
      !recoveryReady &&
      pathname === '/auth/login'
    ) {
      void getPostAuthRoute(session.user.id).then((route) => {
        if (active) router.replace(route);
      });
    }

    return () => {
      active = false;
    };
  }, [authLinkChecking, pathname, recoveryReady, router, session]);

  const submit = async () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!EMAIL_REGEX.test(email.trim())) nextErrors.email = 'Informe um e-mail válido.';
    if (!password) nextErrors.password = 'Informe sua senha.';
    setErrors(nextErrors);
    setSubmitError(undefined);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      if (result.requiresEmailConfirmation) router.push('/auth/confirmar-email');
      return;
    }
  };

  const visibleError = submitError ?? linkError;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Entrar" onBack={() => router.back()} center />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: colors.text }]}>Bem-vindo de volta</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Acesse seu espaço de estudo.</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              error={errors.email}
            />
            <TextField
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              error={errors.password}
            />
            <Pressable
              onPress={() => router.push('/auth/recuperar-senha')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.recovery, pressed && styles.pressed]}>
              <Text style={[styles.link, { color: colors.primary }]}>Esqueci minha senha</Text>
            </Pressable>
          </View>

          <Button
            label={submitting ? 'Entrando...' : 'Entrar'}
            size="lg"
            onPress={submit}
            disabled={submitting}
            fullWidth
          />
          {visibleError ? (
            <Text style={[styles.submitError, { color: colors.danger }]}>{visibleError}</Text>
          ) : null}
          <Pressable
            onPress={() => router.replace('/auth/cadastro')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Não tem conta? </Text>
            <Text style={[styles.link, { color: colors.primary }]}>Criar conta</Text>
          </Pressable>
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
    gap: Spacing.xxl,
  },
  heading: { gap: Spacing.xs },
  title: { fontSize: 26, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.body, lineHeight: 21 },
  form: { gap: Spacing.lg },
  recovery: { alignSelf: 'flex-end', marginTop: -Spacing.xs },
  link: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  submitError: { marginTop: -Spacing.lg, fontSize: FontSize.small, textAlign: 'center' },
  footerAction: { flexDirection: 'row', alignSelf: 'center', padding: Spacing.sm },
  footerText: { fontSize: FontSize.small },
  pressed: { opacity: 0.6 },
});
