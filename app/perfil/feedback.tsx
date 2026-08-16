import Ionicons from '@/components/ui/app-icon';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { StackHeader } from '@/components/ui/stack-header';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_LENGTH,
  submitFeedback,
  type FeedbackCategory,
  type FeedbackPlatform,
} from '@/lib/feedback';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

const platform: FeedbackPlatform =
  Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web'
    ? Platform.OS
    : 'unknown';

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isConfigured } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError(undefined);
    setSubmitting(true);
    const result = await submitFeedback({
      category,
      message,
      sourceScreen: 'perfil/feedback',
      platform,
      appVersion: Constants.expoConfig?.version,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setMessage('');
    setSubmitted(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Fale com o KAD" onBack={() => router.back()} center />

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
          <LinearGradient
            colors={[colors.primaryStrong, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={23} color="#FFFFFF" />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introEyebrow}>TESTE FECHADO</Text>
              <Text style={styles.introTitle}>Sua experiência ajuda a decidir o próximo passo.</Text>
              <Text style={styles.introText}>
                Envie uma ideia, dúvida ou problema. A equipe receberá a mensagem no painel do KAD.
              </Text>
            </View>
          </LinearGradient>

          {!session ? (
            <View
              style={[
                styles.accountCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <View style={[styles.accountIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="person-circle-outline" size={25} color={colors.primary} />
              </View>
              <Text style={[styles.accountTitle, { color: colors.text }]}>Entre para enviar</Text>
              <Text style={[styles.accountText, { color: colors.textMuted }]}>
                Assim o feedback fica associado à conta certa e o canal permanece protegido contra spam.
              </Text>
              <Button
                label={isConfigured ? 'Entrar na minha conta' : 'Login indisponível neste ambiente'}
                icon="log-in-outline"
                onPress={() => router.push('/auth/login')}
                disabled={!isConfigured}
                fullWidth
              />
              <Button
                label="Criar conta"
                variant="secondary"
                onPress={() => router.push('/auth/cadastro')}
                disabled={!isConfigured}
                fullWidth
              />
            </View>
          ) : submitted ? (
            <View
              accessibilityLiveRegion="polite"
              style={[
                styles.successCard,
                { backgroundColor: colors.successSoft, borderColor: colors.success },
              ]}>
              <View style={[styles.successIcon, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>Mensagem recebida</Text>
              <Text style={[styles.successText, { color: colors.textMuted }]}>
                Ela já está na fila da equipe. Obrigado por ajudar a melhorar o KAD.
              </Text>
              <Button
                label="Enviar outro comentário"
                variant="secondary"
                onPress={() => setSubmitted(false)}
                fullWidth
              />
              <Button label="Voltar ao perfil" variant="ghost" onPress={() => router.back()} fullWidth />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Sobre o que você quer falar?</Text>
                <View style={styles.categoryRow}>
                  {FEEDBACK_CATEGORIES.map((option) => {
                    const selected = option.value === category;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setCategory(option.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        style={({ pressed }) => [
                          styles.categoryOption,
                          {
                            backgroundColor: selected ? colors.primarySoft : colors.surface,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons
                          name={option.icon}
                          size={19}
                          color={selected ? colors.primary : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.categoryLabel,
                            { color: selected ? colors.primary : colors.textMuted },
                          ]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: colors.text }]}>Seu comentário</Text>
                  <Text style={[styles.counter, { color: colors.textSubtle }]}>
                    {message.length}/{FEEDBACK_MAX_LENGTH}
                  </Text>
                </View>
                <TextInput
                  value={message}
                  onChangeText={(value) => {
                    setMessage(value);
                    if (error) setError(undefined);
                  }}
                  placeholder="Conte o que aconteceu ou o que você gostaria de encontrar no KAD..."
                  placeholderTextColor={colors.textSubtle}
                  multiline
                  maxLength={FEEDBACK_MAX_LENGTH}
                  textAlignVertical="top"
                  accessibilityLabel="Seu comentário"
                  style={[
                    styles.messageInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.surfaceAlt,
                      borderColor: error ? colors.danger : colors.border,
                    },
                  ]}
                />
                {error ? (
                  <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
                    {error}
                  </Text>
                ) : null}
              </View>

              <View style={[styles.privacyNote, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
                <Text style={[styles.privacyText, { color: colors.textMuted }]}>
                  Não inclua senha, dados bancários ou outras informações sensíveis.
                </Text>
              </View>

              <Button
                label={submitting ? 'Enviando...' : 'Enviar para o KAD'}
                icon="send-outline"
                onPress={handleSubmit}
                disabled={submitting}
                size="lg"
                fullWidth
              />
            </View>
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
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  introIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  introCopy: { flex: 1, gap: Spacing.sm },
  introEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: FontSize.title,
    lineHeight: 29,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.4,
  },
  introText: { color: 'rgba(255,255,255,0.82)', fontSize: FontSize.small, lineHeight: 20 },
  form: { gap: Spacing.xl },
  fieldGroup: { gap: Spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  counter: { fontSize: FontSize.tiny },
  categoryRow: { flexDirection: 'row', gap: Spacing.sm },
  categoryOption: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  categoryLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  messageInput: {
    minHeight: 180,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  error: { fontSize: FontSize.small, lineHeight: 18 },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  privacyText: { flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  accountCard: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  accountIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  accountTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  accountText: { maxWidth: 480, textAlign: 'center', fontSize: FontSize.small, lineHeight: 20 },
  successCard: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderWidth: 1,
    borderRadius: Radius.xl,
  },
  successIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  successTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  successText: { maxWidth: 480, textAlign: 'center', fontSize: FontSize.small, lineHeight: 20 },
  pressed: { opacity: 0.72 },
});
