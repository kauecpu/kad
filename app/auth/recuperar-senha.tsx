import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordRecoveryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const result = await sendPasswordReset(email.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Recuperar senha" onBack={() => router.back()} center />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {sent ? (
            <View style={styles.success}>
              <View style={[styles.successIcon, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="mail-outline" size={24} color={colors.success} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Confira seu e-mail</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enviamos as instruções para {email.trim()}.</Text>
              <Button label="Voltar para entrar" variant="secondary" onPress={() => router.replace('/auth/login')} fullWidth />
            </View>
          ) : (
            <>
              <View style={styles.heading}>
                <Text style={[styles.title, { color: colors.text }]}>Esqueceu sua senha?</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>Informe seu e-mail para receber as instruções.</Text>
              </View>
              <TextField
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                error={error}
              />
              <Button
                label={submitting ? 'Enviando...' : 'Enviar instruções'}
                size="lg"
                onPress={submit}
                disabled={submitting}
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
  success: { alignItems: 'center', gap: Spacing.md },
  successIcon: { width: 52, height: 52, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
