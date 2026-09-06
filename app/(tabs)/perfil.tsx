import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AchievementGallery } from '@/components/achievement-gallery';
import { LevelProgressCard } from '@/components/level-progress-card';
import Ionicons from '@/components/ui/app-icon';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { formatPercent } from '@/lib/format';
import { profileHeroAction } from '@/lib/profile-presentation';
import { loadRanking } from '@/lib/remote-gamification';
import type { RankingSnapshot } from '@/lib/ranking';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';

const WEB_CONTENT_WIDTH = `calc(100% - ${Spacing.xxl}px)` as ViewStyle['width'];

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      {children}
    </View>
  );
}

function RankingPosition({ sessionId }: { sessionId?: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<RankingSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!sessionId) {
      setSnapshot(null);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    loadRanking('all')
      .then((value) => { if (active) setSnapshot(value); })
      .catch(() => { if (active) setSnapshot(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]));

  const position = snapshot?.currentUser;
  const description = !sessionId
    ? 'Entre na sua conta para acompanhar sua posição'
    : position
      ? `${position.points.toLocaleString('pt-BR')} XP no ranking geral`
      : 'Sua posição aparecerá quando estiver disponível';

  return (
    <Pressable
      onPress={() => router.push('/ranking')}
      accessibilityRole="button"
      accessibilityLabel={position ? `Posição no ranking: ${position.rank}` : 'Ver ranking'}
      style={({ pressed }) => [styles.rankingRow, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.targetIcon, { backgroundColor: colors.warningSoft }]}>
        {loading ? <ActivityIndicator size="small" color={colors.warning} /> : <Ionicons name="trophy-outline" size={19} color={colors.warning} />}
      </View>
      <View style={styles.targetCopy}>
        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Posição no ranking</Text>
        <Text style={[styles.targetValue, { color: colors.text }]}>{position ? `#${position.rank}` : loading ? 'Carregando…' : 'Ainda não disponível'}</Text>
        <Text style={[styles.metricDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export default function PerfilScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const openMenu = useOpenAppDrawer();
  const { profile, performance, canViewStatistics, savedConcursos, updateProfileAvatar } = useApp();
  const { session, isConfigured } = useAuth();
  const primaryAction = profileHeroAction({ isAuthenticated: Boolean(session), isAuthConfigured: isConfigured });
  const targetRole = profile.targetRole?.trim();
  const performanceValue = canViewStatistics && performance.total > 0 ? formatPercent(performance.accuracy) : '--';
  const performanceDescription = canViewStatistics
    ? `${performance.total} ${performance.total === 1 ? 'questão respondida' : 'questões respondidas'}`
    : 'Disponível nos planos KAD';

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Autorize o acesso às suas fotos para escolher uma imagem de perfil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      try { await updateProfileAvatar(result.assets[0]); }
      catch { Alert.alert('Não foi possível salvar a foto', 'Tente novamente em instantes.'); }
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Meu perfil" subtitle="Identidade, progresso e conquistas" onMenu={openMenu} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
        <Card padded={false} style={[styles.identityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.identityContent}>
            <Text style={[styles.identityTitle, { color: colors.textMuted }]}>SEU PERFIL PÚBLICO</Text>
            <View style={styles.identityUser}>
              <View style={[styles.identityAvatar, { borderColor: colors.primary }]}>
                <Avatar name={profile.name} uri={profile.avatarUri} size={72} onEdit={handlePickAvatar} />
              </View>
              <View style={styles.identityCopy}>
                <Text style={[styles.userName, { color: colors.text }]}>{profile.name}</Text>
                {session && profile.username ? <Text style={[styles.userHandle, { color: colors.primary }]}>@{profile.username}</Text> : null}
                <Text style={[styles.userDetail, { color: colors.textMuted }]} numberOfLines={2}>{targetRole || 'Meta de concurso ainda não definida'}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => primaryAction.href && router.push(primaryAction.href)}
              disabled={!primaryAction.href}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
              accessibilityHint={primaryAction.description}
              accessibilityState={{ disabled: !primaryAction.href }}
              style={({ pressed }) => [styles.primaryAction, { backgroundColor: colors.primary }, pressed && styles.pressed, !primaryAction.href && styles.disabled]}>
              <Ionicons name={session ? 'create-outline' : 'cloud-upload-outline'} size={19} color="#FFFFFF" />
              <View style={styles.primaryActionCopy}>
                <Text style={styles.primaryActionLabel}>{primaryAction.label}</Text>
                <Text style={styles.primaryActionDescription}>{primaryAction.description}</Text>
              </View>
              {primaryAction.href ? <Ionicons name="arrow-forward" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          </View>
        </Card>

        <LevelProgressCard />
        <AchievementGallery />

        <ProfileSection title="Minha preparação">
          <View style={[styles.preparationPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => router.push('/meta')}
              accessibilityRole="button"
              accessibilityLabel={targetRole ? `Meta atual: ${targetRole}` : 'Escolher minha meta'}
              style={({ pressed }) => [styles.targetRow, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.targetIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="flag-outline" size={19} color={colors.primary} /></View>
              <View style={styles.targetCopy}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Meta de concurso</Text>
                <Text style={[styles.targetValue, { color: colors.text }]}>{targetRole || 'Escolher minha meta'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
            <View style={styles.metricsRow}>
              <Pressable
                onPress={() => router.push('/perfil/desempenho')}
                accessibilityRole="button"
                accessibilityLabel={`Desempenho geral. ${performanceDescription}`}
                style={({ pressed }) => [styles.metric, styles.metricDivider, { borderRightColor: colors.border }, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Desempenho</Text>
                <Text style={[styles.metricValue, { color: colors.primary }]}>{performanceValue}</Text>
                <Text style={[styles.metricDescription, { color: colors.textMuted }]}>{performanceDescription}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/concursos/salvos')}
                accessibilityRole="button"
                accessibilityLabel={`${savedConcursos.length} concursos salvos`}
                style={({ pressed }) => [styles.metric, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Concursos salvos</Text>
                <Text style={[styles.metricValue, { color: colors.primary }]}>{savedConcursos.length}</Text>
                <Text style={[styles.metricDescription, { color: colors.textMuted }]}>{savedConcursos.length === 1 ? 'concurso salvo' : 'concursos salvos'}</Text>
              </Pressable>
            </View>
            <RankingPosition sessionId={session?.user.id} />
          </View>
        </ProfileSection>

        <Pressable
          onPress={() => router.push('/configuracoes')}
          accessibilityRole="button"
          accessibilityLabel="Abrir configurações"
          style={({ pressed }) => [styles.settingsShortcut, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }, pressed && styles.pressed]}>
          <View style={[styles.settingsIcon, { backgroundColor: colors.surface }]}><Ionicons name="settings-outline" size={21} color={colors.primary} /></View>
          <View style={styles.settingsCopy}>
            <Text style={[styles.settingsTitle, { color: colors.text }]}>Configurações</Text>
            <Text style={[styles.metricDescription, { color: colors.textMuted }]}>Conta, aparência, privacidade e assinatura</Text>
          </View>
          <Ionicons name="arrow-forward" size={19} color={colors.primary} />
        </Pressable>
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
  sectionTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, letterSpacing: -0.25 },
  identityCard: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  identityContent: { padding: Spacing.lg, gap: Spacing.lg },
  identityTitle: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  identityUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityAvatar: { borderWidth: 2, borderRadius: Radius.pill, padding: 2 },
  identityCopy: { minWidth: 0, flex: 1, gap: 3 },
  userName: { fontSize: FontSize.title + 2, fontWeight: FontWeight.bold, letterSpacing: -0.55 },
  userHandle: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  userDetail: { fontSize: FontSize.small, lineHeight: 18 },
  primaryAction: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.md },
  primaryActionCopy: { minWidth: 0, flex: 1, gap: 2 },
  primaryActionLabel: { color: '#FFFFFF', fontSize: FontSize.body, fontWeight: FontWeight.bold },
  primaryActionDescription: { color: 'rgba(252,250,255,0.80)', fontSize: FontSize.small, lineHeight: 18 },
  preparationPanel: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  targetRow: { minHeight: 74, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  rankingRow: { minHeight: 82, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  targetIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  targetCopy: { minWidth: 0, flex: 1, gap: 3 },
  targetValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold, lineHeight: 20 },
  metricsRow: { flexDirection: 'row' },
  metric: { flex: 1, minWidth: 0, minHeight: 122, padding: Spacing.lg, gap: Spacing.xs },
  metricDivider: { borderRightWidth: StyleSheet.hairlineWidth },
  metricLabel: { flexShrink: 1, fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  metricValue: { fontSize: FontSize.display, fontWeight: FontWeight.bold, letterSpacing: -0.7 },
  metricDescription: { fontSize: FontSize.small, lineHeight: 18 },
  settingsShortcut: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderWidth: 1, borderRadius: Radius.lg },
  settingsIcon: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  settingsCopy: { minWidth: 0, flex: 1, gap: 3 },
  settingsTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.58 },
});
