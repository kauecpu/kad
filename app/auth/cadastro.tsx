import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import {
  cardShadow,
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-security';
import { isValidUsername, normalizeUsername } from '@/lib/profile';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  { icon: 'sync-outline' as const, label: 'Progresso sincronizado entre aparelhos' },
  { icon: 'bookmark-outline' as const, label: 'Questões e concursos salvos em um só lugar' },
  { icon: 'shield-checkmark-outline' as const, label: 'Seus dados protegidos e sob seu controle' },
];

type FieldError = 'name' | 'username' | 'email' | 'password' | 'passwordConfirmation';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const isWide = width >= 820;
  const passwordIsValid = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;

  const clearFieldError = (field: FieldError) => {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
    setSubmitError(undefined);
  };

  const submit = async () => {
    const nextErrors: {
      name?: string;
      username?: string;
      email?: string;
      password?: string;
      passwordConfirmation?: string;
    } = {};
    if (!name.trim()) nextErrors.name = 'Informe seu nome.';
    if (!isValidUsername(username)) {
      nextErrors.username = 'Use de 3 a 24 letras, números ou underline.';
    }
    if (!EMAIL_REGEX.test(email.trim())) nextErrors.email = 'Informe um e-mail válido.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (!passwordConfirmation) {
      nextErrors.passwordConfirmation = 'Repita sua senha.';
    } else if (password !== passwordConfirmation) {
      nextErrors.passwordConfirmation = 'As senhas não coincidem.';
    }
    setErrors(nextErrors);
    setSubmitError(undefined);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const result = await signUp(name.trim(), username, email.trim(), password);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    if (result.requiresEmailConfirmation) {
      router.replace('/auth/confirmar-email');
      return;
    }
    router.replace('/onboarding');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[styles.backgroundAccent, { backgroundColor: colors.primarySoft }]}
      />
      <StackHeader title="Criar conta" onBack={() => router.back()} center />

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
          <View style={[styles.layout, isWide && styles.layoutWide]}>
            <View
              style={[
                styles.brandPanel,
                isWide ? styles.brandPanelWide : styles.brandPanelCompact,
                { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
              ]}>
              <View
                style={[styles.brandGlow, { backgroundColor: colors.accentSoft }]}
              />
              <Image
                source={require('../../assets/images/kad-logo-v3.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="KAD Concursos"
              />

              <View style={styles.brandCopy}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>SEU ESTUDO CONTINUA AQUI</Text>
                <Text style={[styles.brandTitle, { color: colors.text }]}>Todo o seu progresso, sempre com você.</Text>
                <Text style={[styles.brandDescription, { color: colors.textMuted }]}>Crie uma conta gratuita para estudar com foco e retomar de onde parou.</Text>
              </View>

              {isWide ? (
                <View style={styles.benefits}>
                  {BENEFITS.map((benefit) => (
                    <View key={benefit.label} style={styles.benefitRow}>
                      <View style={[styles.benefitIcon, { backgroundColor: colors.surface }]}>
                        <Ionicons name={benefit.icon} size={17} color={colors.primary} />
                      </View>
                      <Text style={[styles.benefitText, { color: colors.textMuted }]}>{benefit.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                cardShadow(colors.shadow, 2),
              ]}>
              <>
                  <View style={styles.heading}>
                    <Text style={[styles.eyebrow, { color: colors.primary }]}>CRIE SEU ACESSO</Text>
                    <Text style={[styles.title, { color: colors.text }]}>Comece sua preparação</Text>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>Gratuito para começar. Leva menos de um minuto.</Text>
                  </View>

                  <View style={styles.form}>
                    <TextField
                      label="Nome completo"
                      value={name}
                      onChangeText={(value) => {
                        setName(value);
                        clearFieldError('name');
                      }}
                      placeholder="Como podemos chamar você?"
                      icon="person-outline"
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      error={errors.name}
                    />
                    <TextField
                      label="Usuário"
                      value={username}
                      onChangeText={(value) => {
                        setUsername(normalizeUsername(value));
                        clearFieldError('username');
                      }}
                      placeholder="seu_usuario"
                      helper="Identificador único · 3 a 24 caracteres"
                      icon="at-outline"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="username"
                      textContentType="username"
                      error={errors.username}
                    />
                    <TextField
                      label="E-mail"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        clearFieldError('email');
                      }}
                      placeholder="voce@email.com"
                      icon="mail-outline"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      error={errors.email}
                    />
                    <View style={styles.passwordArea}>
                      <TextField
                        label="Senha"
                        value={password}
                        onChangeText={(value) => {
                          setPassword(value);
                          clearFieldError('password');
                          clearFieldError('passwordConfirmation');
                        }}
                        placeholder="Crie uma senha segura"
                        icon="lock-closed-outline"
                        secureTextEntry
                        showPasswordToggle
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        error={errors.password}
                      />
                      {!errors.password ? (
                        <View style={styles.passwordHint}>
                          <Ionicons
                            name={passwordIsValid ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={passwordIsValid ? colors.success : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.passwordHintText,
                              { color: passwordIsValid ? colors.success : colors.textSubtle },
                            ]}>Pelo menos {MIN_PASSWORD_LENGTH} caracteres</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.passwordArea}>
                      <TextField
                        label="Repetir senha"
                        value={passwordConfirmation}
                        onChangeText={(value) => {
                          setPasswordConfirmation(value);
                          clearFieldError('passwordConfirmation');
                        }}
                        placeholder="Digite a mesma senha"
                        icon="shield-checkmark-outline"
                        secureTextEntry
                        showPasswordToggle
                        autoCapitalize="none"
                        autoComplete="new-password"
                        textContentType="newPassword"
                        error={errors.passwordConfirmation}
                      />
                      {passwordConfirmation && !errors.passwordConfirmation ? (
                        <View style={styles.passwordHint}>
                          <Ionicons
                            name={passwordsMatch ? 'checkmark-circle' : 'ellipse-outline'}
                            size={14}
                            color={passwordsMatch ? colors.success : colors.textSubtle}
                          />
                          <Text
                            style={[
                              styles.passwordHintText,
                              { color: passwordsMatch ? colors.success : colors.textSubtle },
                            ]}>{passwordsMatch ? 'As senhas coincidem' : 'As senhas devem ser iguais'}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {submitError ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft }]}>
                      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                      <Text style={[styles.submitError, { color: colors.danger }]}>{submitError}</Text>
                    </View>
                  ) : null}

                  <Button
                    label={submitting ? 'Criando sua conta...' : 'Criar minha conta'}
                    icon="person-add-outline"
                    size="lg"
                    onPress={submit}
                    disabled={submitting}
                    fullWidth
                  />

                  <Text style={[styles.legal, { color: colors.textSubtle }]}>Ao criar sua conta, você concorda com os{' '}
                    <Text
                      style={[styles.legalLink, { color: colors.text }]}
                      onPress={() => router.push('/legal/termos')}>Termos de Uso</Text>{' '}e a{' '}
                    <Text
                      style={[styles.legalLink, { color: colors.text }]}
                      onPress={() => router.push('/legal/privacidade')}>Política de Privacidade</Text>.
                  </Text>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <Pressable
                    onPress={() => router.replace('/auth/login')}
                    accessibilityRole="button"
                    accessibilityLabel="Já tem conta? Entrar"
                    style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>Já tem uma conta? </Text>
                    <Text style={[styles.link, { color: colors.primary }]}>Entrar</Text>
                  </Pressable>
              </>
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
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  layout: {
    width: '100%',
    gap: Spacing.md,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  brandPanel: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  brandPanelWide: {
    width: 310,
    minHeight: 520,
    justifyContent: 'space-between',
  },
  brandPanelCompact: {
    gap: Spacing.md,
  },
  brandGlow: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 190,
    height: 190,
    borderRadius: Radius.pill,
    right: -80,
    top: -95,
    opacity: 0.65,
  },
  logo: {
    width: 172,
    height: 56,
  },
  brandCopy: { gap: Spacing.sm },
  eyebrow: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.9,
  },
  brandTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  brandDescription: { fontSize: FontSize.body, lineHeight: 21 },
  benefits: { gap: Spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: FontSize.small, lineHeight: 18 },
  formCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  heading: { gap: Spacing.xs },
  title: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.6,
  },
  subtitle: { fontSize: FontSize.body, lineHeight: 21 },
  form: { gap: Spacing.md },
  passwordArea: { gap: Spacing.xs },
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  passwordHintText: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  submitError: { flex: 1, fontSize: FontSize.small, lineHeight: 18 },
  legal: { fontSize: FontSize.tiny, lineHeight: 17, textAlign: 'center' },
  legalLink: { fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  divider: { height: StyleSheet.hairlineWidth },
  footerAction: {
    minHeight: 36,
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  footerText: { fontSize: FontSize.small },
  link: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  backgroundAccent: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 420,
    height: 420,
    borderRadius: Radius.pill,
    right: -210,
    bottom: -240,
    opacity: 0.55,
  },
  pressed: { opacity: 0.6 },
});
