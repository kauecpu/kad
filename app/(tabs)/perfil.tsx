import Ionicons from '@/components/ui/app-icon';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatPercent } from '@/lib/format';
import { useApp, useAppTheme } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSimulation } from '@/providers/simulation-provider';
import type { SubscriptionPlan, ThemePreference } from '@/types';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Plano Básico',
  diamond: 'KAD Diamante',
  circle: 'KAD Círculo',
};

const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function PerfilScreen() {
  const { colors } = useTheme();
  const { themePreference, setThemePreference } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    subscription,
    performance,
    isPremium,
    canViewStatistics,
    dailyQuestionLimit,
    dailyQuestionsAnswered,
    dailyQuestionsRemaining,
    savedConcursos,
    updateProfile,
    resetProgress,
    deleteAccount,
  } = useApp();
  const { session, isConfigured, signOut } = useAuth();
  const { clearSimulationData } = useSimulation();

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        'Autorize o acesso às suas fotos para escolher uma imagem de perfil.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await updateProfile({ avatarUri: result.assets[0].uri });
      } catch {
        Alert.alert('Não foi possível salvar a foto', 'Tente novamente em instantes.');
      }
    }
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Zerar desempenho',
      'Isso apagará todas as respostas registradas. Não é possível desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Zerar', style: 'destructive', onPress: resetProgress },
      ]
    );
  };

  const performSignOut = async () => {
    const result = await signOut();
    if (!result.ok) {
      Alert.alert('Não foi possível sair', result.message);
      return;
    }
    router.replace('/');
  };

  const handleSignOut = () => {
    const title = 'Sair da conta';
    const message = 'Deseja encerrar esta sessão?';

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${title}\n\n${message}`)) void performSignOut();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: performSignOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (session) {
      router.push('/perfil/excluir-conta');
      return;
    }

    Alert.alert(
      'Apagar dados deste aparelho',
      'Respostas, concursos salvos, preferências e outros dados locais serão removidos. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar dados',
          style: 'destructive',
          onPress: async () => {
            await Promise.all([clearSimulationData(), deleteAccount()]);
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Perfil" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.userCard}>
          <Avatar name={profile.name} uri={profile.avatarUri} size={58} onEdit={handlePickAvatar} />
          <View style={styles.userText}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {profile.name}
            </Text>
            {session && profile.username ? (
              <Text style={[styles.userHandle, { color: colors.primary }]} numberOfLines={1}>
                @{profile.username}
              </Text>
            ) : null}
            <Text style={[styles.userEmail, { color: colors.textMuted }]} numberOfLines={1}>
              {session
                ? profile.email
                : 'Modo visitante · dados salvos neste aparelho'}
            </Text>
            {profile.targetRole ? (
              <View style={styles.userBadge}>
                <Badge label={`Meta: ${profile.targetRole}`} tone="accent" icon="flag" />
              </View>
            ) : null}
          </View>
        </Card>

        <Section title="Assinatura">
          <Card style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderText}>
                <Text style={[styles.planName, { color: colors.text }]}>
                  {PLAN_LABEL[subscription.plan]}
                </Text>
                <Text style={[styles.planDescription, { color: colors.textMuted }]}>
                  {isPremium
                    ? subscription.status === 'past_due'
                      ? `Acesso até ${formatDate(subscription.renewsAt)} · renovação pendente`
                      : `Acesso até ${formatDate(subscription.renewsAt)}${subscription.autoRenew ? ' · renovação automática' : ' · renovação cancelada'}`
                    : `${dailyQuestionsRemaining} de ${dailyQuestionLimit} questões disponíveis hoje`}
                </Text>
              </View>
              <Badge
                label={
                  subscription.plan === 'circle'
                    ? 'Círculo'
                    : subscription.plan === 'diamond'
                      ? 'Diamante'
                      : 'Básico'
                }
                tone={isPremium ? 'accent' : 'neutral'}
              />
            </View>

            {!isPremium ? (
              <View style={styles.quota}>
                <View style={styles.quotaHeader}>
                  <Text style={[styles.quotaLabel, { color: colors.textMuted }]}>
                    Uso de questões hoje
                  </Text>
                  <Text style={[styles.quotaValue, { color: colors.primary }]}>
                    {`${dailyQuestionsAnswered}/${dailyQuestionLimit}`}
                  </Text>
                </View>
                <ProgressBar
                  value={(dailyQuestionsAnswered / dailyQuestionLimit) * 100}
                  label={`${dailyQuestionsAnswered} de ${dailyQuestionLimit} questões usadas hoje`}
                />
              </View>
            ) : null}

            <Button
              label="Ver planos e benefícios"
              variant="secondary"
              icon="card-outline"
              onPress={() => router.push('/perfil/planos')}
              fullWidth
            />
          </Card>
        </Section>

        <Section title="Desempenho">
          <Card
            onPress={() => router.push('/perfil/desempenho')}
            accessibilityLabel="Abrir desempenho geral"
            style={styles.performanceCard}>
            <View style={styles.performanceIcon}>
              <Ionicons
                name={canViewStatistics ? 'bar-chart-outline' : 'lock-closed-outline'}
                size={21}
                color={colors.primary}
              />
            </View>
            <View style={styles.performanceBody}>
              <Text style={[styles.performanceTitle, { color: colors.text }]}>Desempenho geral</Text>
              <Text style={[styles.performanceDescription, { color: colors.textMuted }]}>
                {canViewStatistics
                  ? `${performance.total} ${
                      performance.total === 1 ? 'questão respondida' : 'questões respondidas'
                    }`
                  : 'Disponível nos planos KAD'}
              </Text>
            </View>
            {canViewStatistics ? (
              <Text style={[styles.performanceValue, { color: colors.primary }]}>
                {performance.total > 0 ? formatPercent(performance.accuracy) : '--'}
              </Text>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Card>
        </Section>

        <Section title="Aparência">
          <Card style={styles.appearanceCard}>
            <View style={styles.appearanceHeader}>
              <View style={styles.appearanceIcon}>
                <Ionicons name="contrast-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.appearanceText}>
                <Text style={[styles.appearanceTitle, { color: colors.text }]}>Tema do app</Text>
                <Text style={[styles.appearanceHint, { color: colors.textMuted }]}>
                  Escolha entre claro, escuro ou seguir o sistema.
                </Text>
              </View>
            </View>
            <Segmented
              options={THEME_OPTIONS}
              value={themePreference}
              onChange={setThemePreference}
              animated
              haptic
            />
          </Card>
        </Section>

        <Section title="Atalhos">
          <Card padded={false} style={styles.settingsCard}>
            <ListRow
              icon="bookmark-outline"
              label="Meus concursos"
              description={`${savedConcursos.length} ${savedConcursos.length === 1 ? 'concurso salvo' : 'concursos salvos'}`}
              tone="primary"
              onPress={() => router.push('/concursos/salvos')}
            />
            <ListRow
              icon="person-outline"
              label="Editar dados"
              description={session ? 'Nome, telefone, cidade e meta' : 'Nome, telefone, cidade e meta local'}
              tone="primary"
              onPress={() => router.push('/perfil/editar')}
              isLast={!session}
            />
            {session ? (
              <ListRow
                icon="lock-closed-outline"
                label="Alterar senha"
                description="Atualize sua senha de acesso"
                tone="accent"
                onPress={() => router.push('/perfil/senha')}
                isLast
              />
            ) : null}
          </Card>
        </Section>

        <Section title="Informações e conta">
          <Card padded={false} style={styles.settingsCard}>
            {session ? (
              <ListRow
                icon="log-out-outline"
                label="Sair da conta"
                description={session.user.email ?? 'Encerrar esta sessão'}
                onPress={handleSignOut}
                showChevron={false}
              />
            ) : (
              <ListRow
                icon="log-in-outline"
                label={isConfigured ? 'Entrar ou criar conta' : 'Login indisponível'}
                description={
                  isConfigured
                    ? 'Acesse seus dados em outro aparelho'
                    : 'Tente novamente mais tarde'
                }
                onPress={isConfigured ? () => router.push('/auth/login') : undefined}
                showChevron={isConfigured}
              />
            )}
            <ListRow
              icon="document-text-outline"
              label="Termos de Uso"
              description="Regras para utilização do KAD"
              onPress={() => router.push('/legal/termos')}
            />
            <ListRow
              icon="shield-checkmark-outline"
              label="Política de Privacidade"
              description="Como seus dados são tratados"
              onPress={() => router.push('/legal/privacidade')}
            />
            {canViewStatistics ? (
              <ListRow
                icon="refresh-outline"
                label="Zerar desempenho"
                description="Apaga todas as respostas registradas"
                tone="warning"
                onPress={handleResetProgress}
                showChevron={false}
              />
            ) : null}
            <ListRow
              icon="trash-outline"
              label={session ? 'Excluir conta' : 'Apagar dados deste aparelho'}
              description={
                session
                  ? 'Remove a conta e todos os seus dados'
                  : 'Remove respostas, salvos e preferências locais'
              }
              destructive
              onPress={handleDeleteAccount}
              showChevron={false}
              isLast
            />
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  userText: { flex: 1, gap: 3 },
  userName: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  userEmail: { fontSize: FontSize.body },
  userHandle: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  userBadge: { marginTop: Spacing.xs },
  planCard: { gap: Spacing.sm + 2 },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  planHeaderText: { flex: 1, gap: 3 },
  planName: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  planDescription: { fontSize: FontSize.small, lineHeight: 19 },
  quota: { gap: Spacing.sm },
  quotaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quotaLabel: { fontSize: FontSize.small },
  quotaValue: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  performanceIcon: {
    width: 22,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceBody: { flex: 1, gap: 2 },
  performanceTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  performanceDescription: { fontSize: FontSize.small, lineHeight: 18 },
  performanceValue: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  appearanceCard: { gap: Spacing.sm + 2 },
  appearanceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  appearanceIcon: {
    width: 22,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceText: { flex: 1, gap: 1 },
  appearanceTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  appearanceHint: { fontSize: FontSize.small, lineHeight: 18 },
  settingsCard: { overflow: 'hidden' },
});
