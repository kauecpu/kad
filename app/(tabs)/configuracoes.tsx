import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Ionicons from '@/components/ui/app-icon';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { formatDate } from '@/lib/format';
import { loadRanking, updateRankingOptIn } from '@/lib/remote-gamification';
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

const WEB_CONTENT_WIDTH = `calc(100% - ${Spacing.xxl}px)` as ViewStyle['width'];

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">{title}</Text>
        {description ? <Text style={[styles.sectionDescription, { color: colors.textMuted }]}>{description}</Text> : null}
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
  const committer = useMemo(() => createDeferredThemeCommitter(
    (preference) => commitRef.current(preference),
    { request: requestAnimationFrame, cancel: cancelAnimationFrame }
  ), []);

  useEffect(() => setVisualPreference(themePreference), [themePreference]);
  useEffect(() => () => committer.dispose(), [committer]);

  return <Segmented options={THEME_OPTIONS} value={visualPreference} onChange={(preference) => {
    setVisualPreference(preference);
    committer.select(preference);
  }} animated />;
}

function RankingPrivacyControl({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (enabled: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.switchRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="trophy-outline" size={17} color={colors.primary} /></View>
      <View style={styles.switchCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>Participar do ranking</Text>
        <Text style={[styles.rowDescription, { color: colors.textMuted }]}>Exibe somente nome, usuário, XP, nível e posição.</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel="Participar do ranking público"
        trackColor={{ false: colors.surfaceSunken, true: colors.primarySoft }}
        thumbColor={enabled ? colors.primary : colors.textSubtle}
      />
    </View>
  );
}

export default function ConfiguracoesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openMenu = useOpenAppDrawer();
  const { profile, subscription, isPremium, canViewStatistics, resetProgress, deleteAccount } = useApp();
  const { session, isGuest, signOut } = useAuth();
  const { clearSimulationData } = useSimulation();
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(Boolean(session));
  const [rankingSaving, setRankingSaving] = useState(false);
  const [rankingError, setRankingError] = useState<string>();

  const refreshRankingPreference = useCallback(async () => {
    if (!session) {
      setRankingEnabled(false);
      setRankingLoading(false);
      return;
    }
    setRankingLoading(true);
    setRankingError(undefined);
    try {
      const snapshot = await loadRanking('all');
      setRankingEnabled(snapshot.currentUser?.isPublic ?? false);
    } catch {
      setRankingError('Não foi possível carregar esta preferência agora.');
    } finally {
      setRankingLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => { void refreshRankingPreference(); }, [refreshRankingPreference]));

  const changeRankingPreference = async (enabled: boolean) => {
    if (!session || rankingSaving) return;
    const previous = rankingEnabled;
    setRankingEnabled(enabled);
    setRankingSaving(true);
    setRankingError(undefined);
    try { setRankingEnabled(await updateRankingOptIn(enabled)); }
    catch {
      setRankingEnabled(previous);
      setRankingError('Não foi possível salvar sua participação. Tente novamente.');
    } finally { setRankingSaving(false); }
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
    const message = session ? 'Deseja encerrar esta sessão?' : 'Deseja sair do modo visitante?';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Sair\n\n${message}`)) void performSignOut();
      return;
    }
    Alert.alert('Sair', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: performSignOut },
    ]);
  };

  const handleResetProgress = () => {
    const perform = () => resetProgress();
    const message = 'Isso apagará todas as respostas registradas. Não é possível desfazer.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Zerar desempenho\n\n${message}`)) perform();
      return;
    }
    Alert.alert('Zerar desempenho', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Zerar', style: 'destructive', onPress: perform },
    ]);
  };

  const handleDeleteAccount = () => {
    if (session) {
      router.push('/perfil/excluir-conta');
      return;
    }
    const perform = async () => {
      await Promise.all([clearSimulationData(), deleteAccount()]);
      router.replace('/');
    };
    const message = 'Respostas, concursos salvos, preferências e outros dados locais serão removidos. Esta ação não pode ser desfeita.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Apagar dados deste aparelho\n\n${message}`)) void perform();
      return;
    }
    Alert.alert('Apagar dados deste aparelho', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar dados', style: 'destructive', onPress: perform },
    ]);
  };

  const planDescription = isPremium
    ? subscription.status === 'past_due'
      ? `Acesso até ${formatDate(subscription.renewsAt)} · renovação pendente`
      : `Acesso até ${formatDate(subscription.renewsAt)}${subscription.autoRenew ? ' · renovação automática' : ' · renovação cancelada'}`
    : 'Questões ilimitadas, sem cobrança e sem prazo';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Configurações" subtitle="Conta, privacidade e aplicativo" onMenu={openMenu} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <SettingsSection title="Conta" description="Dados privados e segurança do acesso">
          <Card padded={false} style={styles.groupCard}>
            <ListRow icon="person-outline" label="Dados pessoais" description={session ? profile.email : 'Perfil salvo somente neste aparelho'} onPress={() => router.push('/perfil/editar')} />
            {profile.phone ? <ListRow icon="call-outline" label="Telefone" value={profile.phone} showChevron={false} /> : null}
            {session ? <ListRow icon="lock-closed-outline" label="Alterar senha" description="Atualize sua senha de acesso" onPress={() => router.push('/perfil/senha')} isLast /> : null}
          </Card>
        </SettingsSection>

        <SettingsSection title="Aparência e acessibilidade">
          <Card style={[styles.appearanceCard, { borderColor: colors.border }]}>
            <View style={styles.appearanceHeading}>
              <View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="contrast-outline" size={18} color={colors.primary} /></View>
              <View style={styles.switchCopy}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Tema do app</Text>
                <Text style={[styles.rowDescription, { color: colors.textMuted }]}>Claro, escuro ou igual ao sistema</Text>
              </View>
            </View>
            <ThemePreferenceControl />
            <View style={[styles.systemPreference, { borderTopColor: colors.border }]}>
              <Ionicons name="accessibility-outline" size={17} color={colors.textMuted} />
              <Text style={[styles.rowDescription, { color: colors.textMuted }]}>Animações respeitam a preferência de movimento reduzido do aparelho.</Text>
            </View>
          </Card>
        </SettingsSection>

        <SettingsSection title="Notificações">
          <View style={[styles.infoCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="notifications-off-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>O KAD ainda não envia notificações. Quando esse recurso existir, os controles aparecerão aqui.</Text>
          </View>
        </SettingsSection>

        <SettingsSection title="Privacidade" description="Visibilidade e controle dos seus dados">
          <Card padded={false} style={styles.groupCard}>
            {session ? <RankingPrivacyControl enabled={rankingEnabled} disabled={rankingLoading || rankingSaving} onChange={(enabled) => void changeRankingPreference(enabled)} /> : (
              <ListRow icon="trophy-outline" label="Participação no ranking" description="Entre na sua conta para controlar sua visibilidade" onPress={() => router.push('/auth/login')} />
            )}
            {rankingError ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.danger }]}>{rankingError}</Text> : null}
            <ListRow icon="document-text-outline" label="Termos de Uso" description="Regras para utilização do KAD" onPress={() => router.push('/legal/termos')} />
            <ListRow icon="shield-checkmark-outline" label="Política de Privacidade" description="Como seus dados são tratados" onPress={() => router.push('/legal/privacidade')} />
            {canViewStatistics ? <ListRow icon="refresh-outline" label="Zerar desempenho" description="Apaga todas as respostas registradas" tone="warning" onPress={handleResetProgress} showChevron={false} /> : null}
            <ListRow
              icon="trash-outline"
              label={session ? 'Excluir conta' : 'Apagar dados deste aparelho'}
              description={session ? 'Remove a conta e todos os seus dados' : 'Remove respostas, salvos e preferências locais'}
              destructive
              onPress={handleDeleteAccount}
              showChevron={false}
              isLast
            />
          </Card>
        </SettingsSection>

        <SettingsSection title="Plano e assinatura">
          <Card style={[styles.planCard, { borderColor: colors.border }]}>
            <View style={styles.planHeading}>
              <View style={styles.switchCopy}>
                <Text style={[styles.planName, { color: colors.text }]}>{PLAN_LABEL[subscription.plan]}</Text>
                <Text style={[styles.rowDescription, { color: colors.textMuted }]}>{planDescription}</Text>
              </View>
              <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
            </View>
            <Button label="Gerenciar plano" variant="secondary" icon="card-outline" onPress={() => router.push('/perfil/planos')} fullWidth />
          </Card>
        </SettingsSection>

        <SettingsSection title="Ajuda">
          <Card padded={false} style={styles.groupCard}>
            <ListRow icon="chatbubble-ellipses-outline" label="Fale com o KAD" description="Envie uma sugestão, dúvida ou problema" tone="accent" onPress={() => router.push('/perfil/feedback')} isLast />
          </Card>
        </SettingsSection>

        <SettingsSection title="Sessão">
          <Card padded={false} style={styles.groupCard}>
            <ListRow icon="log-out-outline" label={isGuest ? 'Sair do modo visitante' : 'Sair da conta'} description={session?.user.email ?? 'Encerrar esta sessão'} onPress={handleSignOut} showChevron={false} isLast />
          </Card>
        </SettingsSection>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { width: '100%' },
  content: {
    maxWidth: CONTENT_MAX_WIDTH,
    gap: Spacing.xl,
    ...Platform.select({
      web: { width: WEB_CONTENT_WIDTH, alignSelf: 'center' },
      default: { alignSelf: 'stretch', marginHorizontal: Spacing.lg },
    }),
  },
  section: { gap: Spacing.md },
  sectionHeading: { gap: 3 },
  sectionTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, letterSpacing: -0.25 },
  sectionDescription: { fontSize: FontSize.small, lineHeight: 18 },
  groupCard: { overflow: 'hidden' },
  appearanceCard: { borderWidth: 1, gap: Spacing.md },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  switchCopy: { minWidth: 0, flex: 1, gap: 3 },
  rowTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowDescription: { fontSize: FontSize.small, lineHeight: 18 },
  systemPreference: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  infoCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg },
  infoText: { minWidth: 0, flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  switchRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  inlineError: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: FontSize.small, lineHeight: 18, fontWeight: FontWeight.semibold },
  planCard: { borderWidth: 1, gap: Spacing.md },
  planHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  planName: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
});
