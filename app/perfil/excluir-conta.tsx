import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSimulation } from '@/providers/simulation-provider';

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, deleteRemoteAccount } = useAuth();
  const { deleteAccount } = useApp();
  const { clearSimulationData } = useSimulation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!session) {
      setError('Entre novamente para excluir sua conta.');
      return;
    }
    if (!password) {
      setError('Informe sua senha atual.');
      return;
    }

    setError(undefined);
    setSubmitting(true);
    const result = await deleteRemoteAccount(password);
    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }

    try {
      await Promise.all([clearSimulationData(), deleteAccount()]);
    } finally {
      router.replace('/');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Excluir conta" onBack={() => router.back()} center />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + Spacing.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.warning, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="warning-outline" size={22} color={colors.danger} />
            <View style={styles.warningCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Esta ação é permanente</Text>
              <Text style={[styles.description, { color: colors.textMuted }]}>
                Seu perfil, respostas, favoritos e demais dados serão apagados. Não será possível
                recuperar a conta depois.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={[styles.prompt, { color: colors.text }]}>Confirme sua identidade</Text>
            <TextField
              label="Senha atual"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setError(undefined);
              }}
              placeholder="Digite sua senha"
              secureTextEntry
              showPasswordToggle
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              error={error}
            />
          </View>

          <Button
            label={submitting ? 'Excluindo conta...' : 'Excluir minha conta'}
            variant="danger"
            icon="trash-outline"
            onPress={handleDelete}
            disabled={submitting}
            fullWidth
            size="lg"
          />
          <Button
            label="Cancelar"
            variant="secondary"
            onPress={() => router.back()}
            disabled={submitting}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  warningCopy: { flex: 1, gap: Spacing.xs },
  title: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  description: { fontSize: FontSize.small, lineHeight: 20 },
  form: { gap: Spacing.md },
  prompt: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
