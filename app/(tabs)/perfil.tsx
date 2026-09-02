import Ionicons from '@/components/ui/app-icon';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { LevelProgressCard } from '@/components/level-progress-card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { formatDate, formatPercent } from '@/lib/format';
import { profileHeroAction } from '@/lib/profile-presentation';
import { createDeferredThemeCommitter } from '@/lib/theme-responsiveness';
import { useApp, useAppTheme } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useSimulation } from '@/providers/simulation-provider';
import type { SubscriptionPlan, ThemePreference } from '@/types';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Plano Básico',
  platinum: 'KAD Platina',
  diamond: 'KAD Diamante',
  circle: 'KAD Círculo',
};

const THEME_OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

type DossierSectionProps = {
  title: string;
  children: ReactNode;
};

function DossierSection({ title, children }: DossierSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function ThemePreferenceControl() {
  const { themePreference, setThemePreference } = useAppTheme();
  const [visualPreference, setVisualPreference] = useState(themePreference);
  const commitRef = useRef(setThemePreference);
  commitRef.current = setThemePreference;
  const committer = useMemo(
    () =>
      createDeferredThemeCommitter(
        (preference) => commitRef.current(preference),
        {
          request: requestAnimationFrame,
          cancel: cancelAnimationFrame,
        }
      ),
    []
  );

  useEffect(() => {
    setVisualPreference(themePreference);
  }, [themePreference]);

  useEffect(() => () => committer.dispose(), [committer]);

  const handleChange = useCallback(
    (preference: ThemePreference) => {
      setVisualPreference(preference);
      committer.select(preference);
    },
    [committer]
  );

  return (
    <Segmented
      options={THEME_OPTIONS}
      value={visualPreference}
      onChange={handleChange}
      animated
    />
  );
}

export default function PerfilScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openMenu = useOpenAppDrawer();
  const {
    profile,
    subscription,
    performance,
    isPremium,
    canViewStatistics,
    savedConcursos,
    updateProfileAvatar,
    resetProgress,
    deleteAccount,
  } = useApp();
  const { session, isConfigured, signOut } = useAuth();
  const { clearSimulationData } = useSimulation();

  const primaryAction = profileHeroAction({
    isAuthenticated: Boolean(session),
    isAuthConfigured: isConfigured,
  });
  const targetRole = profile.targetRole?.trim();
  const performanceValue =
    canViewStatistics && performance.total > 0 ? formatPercent(performance.accuracy) : '--';
  const performanceDescription = canViewStatistics
    ? `${performance.total} ${performance.total === 1 ? 'questão respondida' : 'questões respondidas'}`
    : 'Disponível nos planos KAD';

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
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        await updateProfileAvatar(result.assets[0]);
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
      <ScreenHeader
        title="Meu KAD"
        subtitle="Conta, plano e preferências"
        onMenu={openMenu}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Card
          padded={false}
          style={[
            styles.identityCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <View style={styles.identityContent}>
            <View style={styles.identityHeader}>
              <Text style={[styles.identityTitle, { color: colors.textMuted }]}>Seu perfil</Text>
              <View
                style={[
                  styles.identityPlanBadge,
                  { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
                ]}>
                <Ionicons
                  name="ribbon-outline"
                  size={14}
                  color={colors.primary}
                  filled={false}
                />
                <Text style={[styles.identityPlanText, { color: colors.primary }]}>
                  {subscription.plan === 'circle'
                    ? 'Círculo'
                    : subscription.plan === 'platinum'
                      ? 'Platina'
                    : subscription.plan === 'diamond'
                      ? 'Diamante'
                      : 'Básico'}
                </Text>
              </View>
            </View>

            <View style={styles.identityUser}>
              <View style={[styles.identityAvatar, { borderColor: colors.primary }]}>
                <Avatar
                  name={profile.name}
                  uri={profile.avatarUri}
                  size={72}
                  onEdit={handlePickAvatar}
                />
              </View>
              <View style={styles.identityCopy}>
                <Text style={[styles.userName, { color: colors.text }]}>
                  {profile.name}
                </Text>
                {session && profile.username ? (
                  <Text style={[styles.userHandle, { color: colors.primary }]}>
                    @{profile.username}
                  </Text>
                ) : null}
                <View style={styles.identityStatusRow}>
                  <View
                    style={[
                      styles.identityStatusDot,
                      { backgroundColor: colors.success },
                    ]}
                  />
                  <Text
                    style={[styles.userDetail, { color: colors.textMuted }]}
                    numberOfLines={2}>
                    {session ? profile.email : 'Modo visitante · dados salvos neste aparelho'}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.identityStorageNote,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}>
              <Ionicons
                name={session ? 'cloud-done-outline' : 'shield-checkmark-outline'}
                size={16}
                color={colors.success}
                filled={false}
              />
              <Text style={[styles.identityStorageText, { color: colors.textMuted }]}>
                {session
                  ? 'Seu perfil e sua preparação podem acompanhar você em outros aparelhos.'
                  : 'Sua preparação fica salva só aqui. Crie uma conta para não perder nada.'}
              </Text>
            </View>

            <Pressable
              onPress={() => primaryAction.href && router.push(primaryAction.href)}
              disabled={!primaryAction.href}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
              accessibilityHint={primaryAction.description}
              accessibilityState={{ disabled: !primaryAction.href }}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
                !primaryAction.href && styles.disabled,
              ]}>
              <View style={styles.primaryActionIcon}>
                <Ionicons
                  name={session ? 'create-outline' : 'cloud-upload-outline'}
                  size={19}
                  color="#FFFFFF"
                  filled={false}
                />
              </View>
              <View style={styles.primaryActionCopy}>
                <Text style={styles.primaryActionLabel}>{primaryAction.label}</Text>
                <Text style={styles.primaryActionDescription}>{primaryAction.description}</Text>
              </View>
              {primaryAction.href ? (
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              ) : null}
            </Pressable>
          </View>
        </Card>

        <LevelProgressCard />

        <DossierSection title="Minha preparação">
          <View
            style={[
              styles.preparationPanel,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <Pressable
              onPress={() => router.push('/meta')}
              accessibilityRole="button"
              accessibilityLabel={targetRole ? `Meta atual: ${targetRole}` : 'Escolher minha meta'}
              style={({ pressed }) => [
                styles.targetRow,
                { borderBottomColor: colors.border },
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}>
              <View style={[styles.targetIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="flag-outline" size={19} color={colors.primary} />
              </View>
              <View style={styles.targetCopy}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Meta de concurso</Text>
                <Text style={[styles.targetValue, { color: colors.text }]}>
                  {targetRole || 'Escolher minha meta'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>

            <View style={styles.metricsRow}>
              <Pressable
                onPress={() => router.push('/perfil/desempenho')}
                accessibilityRole="button"
                accessibilityLabel={`Desempenho geral. ${performanceDescription}`}
                style={({ pressed }) => [
                  styles.metric,
                  styles.metricDivider,
                  { borderRightColor: colors.border },
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}>
                <View style={styles.metricTopline}>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Desempenho</Text>
                  <Ionicons
                    name={canViewStatistics ? 'bar-chart-outline' : 'lock-closed-outline'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <Text style={[styles.metricValue, { color: colors.primary }]}>{performanceValue}</Text>
                <Text style={[styles.metricDescription, { color: colors.textMuted }]}>
                  {performanceDescription}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/concursos/salvos')}
                accessibilityRole="button"
                accessibilityLabel={`${savedConcursos.length} ${savedConcursos.length === 1 ? 'concurso salvo' : 'concursos salvos'}`}
                style={({ pressed }) => [
                  styles.metric,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}>
                <View style={styles.metricTopline}>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Concursos salvos</Text>
                  <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.metricValue, { color: colors.primary }]}>
                  {savedConcursos.length}
                </Text>
                <Text style={[styles.metricDescription, { color: colors.textMuted }]}>
                  {savedConcursos.length === 1 ? 'concurso salvo' : 'concursos salvos'}
                </Text>
              </Pressable>
            </View>
          </View>
        </DossierSection>

        <DossierSection title="Plano e acesso">
          <Card
            style={[
              styles.planCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
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
                    : 'Questões ilimitadas, sem cobrança e sem prazo'}
                </Text>
              </View>
              <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
            </View>

            <Button
              label="Ver planos e benefícios"
              variant="secondary"
              icon="card-outline"
              onPress={() => router.push('/perfil/planos')}
              fullWidth
            />
          </Card>
        </DossierSection>

        <DossierSection title="Preferências">
          <Card
            style={[
              styles.appearanceCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <View style={styles.appearanceHeader}>
              <View style={[styles.preferenceIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="contrast-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.appearanceText}>
                <Text style={[styles.appearanceTitle, { color: colors.text }]}>Tema do app</Text>
                <Text style={[styles.appearanceHint, { color: colors.textMuted }]}>
                  Claro, escuro ou igual ao sistema
                </Text>
              </View>
            </View>
            <ThemePreferenceControl />
          </Card>
        </DossierSection>

        <DossierSection title="Ajude a construir">
          <Card
            onPress={() => router.push('/perfil/feedback')}
            accessibilityLabel="Enviar feedback para o KAD"
            style={[
              styles.feedbackCard,
              { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong },
            ]}>
            <View style={[styles.feedbackIcon, { backgroundColor: colors.primary }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={21} color="#FFFFFF" />
            </View>
            <View style={styles.feedbackCopy}>
              <Text style={[styles.feedbackEyebrow, { color: colors.primary }]}>Programa de testes</Text>
              <Text style={[styles.feedbackTitle, { color: colors.text }]}>Fale com o KAD</Text>
              <Text style={[styles.feedbackDescription, { color: colors.textMuted }]}>
                Envie uma sugestão, dúvida ou problema direto para a equipe.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color={colors.primary} />
          </Card>
        </DossierSection>

        <DossierSection title="Conta e privacidade">
          <Card padded={false} style={styles.settingsCard}>
            {session ? (
              <>
                <ListRow
                  icon="lock-closed-outline"
                  label="Alterar senha"
                  description="Atualize sua senha de acesso"
                  tone="accent"
                  onPress={() => router.push('/perfil/senha')}
                />
                <ListRow
                  icon="log-out-outline"
                  label="Sair da conta"
                  description={session.user.email ?? 'Encerrar esta sessão'}
                  onPress={handleSignOut}
                  showChevron={false}
                />
              </>
            ) : null}
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
        </DossierSection>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },
  section: { gap: Spacing.md },
  sectionHeader: {
    minHeight: 32,
    justifyContent: 'flex-end',
  },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.25,
  },
  feedbackCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
  },
  feedbackIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  feedbackCopy: { flex: 1, gap: 3 },
  feedbackEyebrow: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  feedbackTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  feedbackDescription: { fontSize: FontSize.small, lineHeight: 18 },
  identityCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  identityContent: { padding: Spacing.lg, gap: Spacing.lg },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  identityTitle: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  identityPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  identityPlanText: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  identityUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityAvatar: {
    borderWidth: 2,
    borderRadius: Radius.pill,
    padding: 2,
  },
  identityCopy: { flex: 1, gap: 3 },
  userName: {
    fontSize: FontSize.title + 2,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.55,
  },
  userHandle: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  identityStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: 3,
  },
  identityStatusDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    marginTop: 5,
  },
  userDetail: { flex: 1, fontSize: FontSize.small, lineHeight: 18 },
  identityStorageNote: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  identityStorageText: { flex: 1, fontSize: FontSize.tiny, lineHeight: 16 },
  primaryAction: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  primaryActionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  primaryActionCopy: { flex: 1, gap: 2 },
  primaryActionLabel: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  primaryActionDescription: {
    color: 'rgba(252,250,255,0.80)',
    fontSize: FontSize.small,
    lineHeight: 18,
  },
  preparationPanel: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  targetRow: {
    minHeight: 74,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  targetIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCopy: { flex: 1, gap: 3 },
  targetValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold, lineHeight: 20 },
  metricsRow: { flexDirection: 'row' },
  metric: {
    flex: 1,
    minWidth: 0,
    minHeight: 122,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  metricDivider: { borderRightWidth: StyleSheet.hairlineWidth },
  metricTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  metricLabel: {
    flexShrink: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  metricValue: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.7,
  },
  metricDescription: { fontSize: FontSize.small, lineHeight: 18 },
  planCard: { borderWidth: 1, gap: Spacing.md },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  planHeaderText: { flex: 1, gap: 3 },
  planName: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  planDescription: { fontSize: FontSize.small, lineHeight: 19 },
  appearanceCard: { borderWidth: 1, gap: Spacing.md },
  appearanceHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearanceText: { flex: 1, gap: 2 },
  appearanceTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  appearanceHint: { fontSize: FontSize.small, lineHeight: 18 },
  settingsCard: { overflow: 'hidden' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.58 },
});
