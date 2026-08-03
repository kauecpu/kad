import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { StackHeader } from '@/components/ui/stack-header';
import { TextField } from '@/components/ui/text-field';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { TARGET_GOALS } from '@/data/roles';
import { useTheme } from '@/hooks/use-theme';
import { formatBrazilianPhone } from '@/lib/profile';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';

export default function EditarPerfilScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, hydrated } = useApp();
  const { session } = useAuth();

  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(formatBrazilianPhone(profile.phone ?? ''));
  const [city, setCity] = useState(profile.city ?? '');
  const [targetRole, setTargetRole] = useState(profile.targetRole ?? '');
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setName(profile.name);
    setEmail(profile.email);
    setPhone(formatBrazilianPhone(profile.phone ?? ''));
    setCity(profile.city ?? '');
    setTargetRole(profile.targetRole ?? '');
  }, [hydrated, profile]);

  const handleSave = async () => {
    const nextErrors: { name?: string } = {};
    if (!name.trim()) nextErrors.name = 'Informe seu nome.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: session?.user.email ?? '',
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        targetRole: targetRole.trim() || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Editar dados" onBack={() => router.back()} center />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="Nome completo"
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            autoCapitalize="words"
            error={errors.name}
          />
          {session ? (
            <TextField
              label="E-mail de acesso"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={false}
              helper="O e-mail é gerenciado pela sua conta."
            />
          ) : null}
          <TextField
            label="Telefone"
            value={phone}
            onChangeText={(value) => setPhone(formatBrazilianPhone(value))}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />
          <TextField
            label="Cidade"
            value={city}
            onChangeText={setCity}
            placeholder="Cidade, UF"
            autoCapitalize="words"
          />
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Cargo desejado</Text>
            <Pressable
              onPress={() => setRoleSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={
                targetRole
                  ? `Cargo desejado: ${targetRole}. Toque para alterar`
                  : 'Selecionar cargo desejado'
              }
              style={({ pressed }) => [
                styles.selectField,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="search-outline" size={19} color={colors.primary} />
              <Text
                style={[
                  styles.selectValue,
                  { color: targetRole ? colors.text : colors.textSubtle },
                ]}
                numberOfLines={1}>
                {targetRole || 'Pesquisar ou selecionar um cargo'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSubtle} />
            </Pressable>
            <Text style={[styles.helper, { color: colors.textSubtle }]}>
              Aparece como sua meta no perfil.
            </Text>
          </View>

          <Button
            label={submitting ? 'Salvando...' : 'Salvar alterações'}
            icon="checkmark"
            onPress={handleSave}
            disabled={submitting || !hydrated}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <MultiSelectSheet
        visible={roleSheetVisible}
        title="Cargo desejado"
        options={TARGET_GOALS}
        selected={targetRole ? [targetRole] : []}
        onChange={(selected) => setTargetRole(selected[0] ?? '')}
        onClose={() => setRoleSheetVisible(false)}
        selectionMode="single"
      />
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
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  selectField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  selectValue: {
    flex: 1,
    fontSize: FontSize.body,
  },
  helper: {
    fontSize: FontSize.tiny,
  },
  pressed: {
    opacity: 0.75,
  },
});
