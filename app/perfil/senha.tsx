import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
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
import { CONTENT_MAX_WIDTH, FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-security';
import { useAuth } from '@/providers/auth-provider';

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export default function AlterarSenhaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, updatePassword } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    const nextErrors: FieldErrors = {};
    if (!current) nextErrors.current = 'Informe sua senha atual.';
    if (next.length < MIN_PASSWORD_LENGTH) {
      nextErrors.next = `A nova senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (current && next === current) {
      nextErrors.next = 'A nova senha deve ser diferente da senha atual.';
    }
    if (next && confirm !== next) nextErrors.confirm = 'As senhas não coincidem.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!session?.user.email) {
      Alert.alert('Conta necessária', 'Entre na sua conta para alterar a senha.');
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(next, current);
    setSubmitting(false);
    if (!result.ok) {
      Alert.alert('Não foi possível alterar', result.message);
      return;
    }

    Alert.alert('Senha alterada', 'Sua senha foi atualizada com sucesso.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Alterar senha" onBack={() => router.back()} center />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.hint, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              Use ao menos {MIN_PASSWORD_LENGTH} caracteres. Uma frase longa e exclusiva é mais segura.
            </Text>
          </View>

          <TextField
            label="Senha atual"
            value={current}
            onChangeText={setCurrent}
            placeholder="Sua senha atual"
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            error={errors.current}
          />
          <TextField
            label="Nova senha"
            value={next}
            onChangeText={setNext}
            placeholder="Nova senha"
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.next}
          />
          <TextField
            label="Confirmar nova senha"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repita a nova senha"
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.confirm}
          />

          <Button
            label={submitting ? 'Salvando...' : 'Salvar nova senha'}
            icon="checkmark"
            onPress={handleSave}
            disabled={submitting}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  hintText: {
    flex: 1,
    fontSize: FontSize.small,
    lineHeight: 19,
  },
});
