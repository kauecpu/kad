import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-security';
import { useAuth } from '@/providers/auth-provider';

export default function NewPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updatePassword, recoveryReady, linkError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [validationTimedOut, setValidationTimedOut] = useState(false);

  useEffect(() => {
    if (recoveryReady || linkError) return;
    const timeout = setTimeout(() => setValidationTimedOut(true), 2500);
    return () => clearTimeout(timeout);
  }, [linkError, recoveryReady]);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUpdated(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Nova senha" onBack={() => router.replace('/auth/login')} center />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {updated ? (
            <View style={styles.success}>
              <Text style={[styles.title, { color: colors.text }]}>Senha atualizada</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Sua conta já está pronta para continuar.</Text>
              <Button label="Continuar" onPress={() => router.replace('/inicio')} fullWidth />
            </View>
          ) : linkError || validationTimedOut ? (
            <View style={styles.success}>
              <Text style={[styles.title, { color: colors.text }]}>Link inválido</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}> 
                {linkError ?? 'Este link expirou ou já foi utilizado.'}
              </Text>
              <Button
                label="Solicitar novo link"
                variant="secondary"
                onPress={() => router.replace('/auth/recuperar-senha')}
                fullWidth
              />
            </View>
          ) : !recoveryReady ? (
            <View style={styles.success}>
              <Text style={[styles.title, { color: colors.text }]}>Validando link...</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Isso leva apenas alguns segundos.</Text>
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <Text style={[styles.title, { color: colors.text }]}>Crie uma nova senha</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Use pelo menos {MIN_PASSWORD_LENGTH} caracteres.</Text>
              </View>
              <View style={styles.form}>
                <TextField
                  label="Nova senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                />
                <TextField
                  label="Confirmar nova senha"
                  value={confirmation}
                  onChangeText={setConfirmation}
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  error={error}
                />
              </View>
              <Button
                label={submitting ? 'Salvando...' : 'Salvar nova senha'}
                onPress={submit}
                disabled={submitting}
                size="lg"
                fullWidth
              />
            </>
          )}
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
  success: { gap: Spacing.lg },
});
