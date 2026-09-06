import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@/components/ui/app-icon';
import { FeaturedCard } from '@/components/ui/featured-card';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { ScreenHeader } from '@/components/ui/screen-header';
import { cardShadow, CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { RANKING_PERIOD_LABELS, type RankingPeriod } from '@/data/ranking';
import { useTheme } from '@/hooks/use-theme';
import { useOpenAppDrawer } from '@/hooks/use-open-app-drawer';
import { loadRanking } from '@/lib/remote-gamification';
import { rankingInitials, type RankingEntry, type RankingSnapshot } from '@/lib/ranking';
import { useAuth } from '@/providers/auth-provider';

const PERIOD_OPTIONS: SegmentedOption<RankingPeriod>[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Geral' },
];

export default function RankingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const openMenu = useOpenAppDrawer();
  const router = useRouter();
  const { session } = useAuth();
  const [period, setPeriod] = useState<RankingPeriod>('today');
  const [snapshot, setSnapshot] = useState<RankingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) { setSnapshot(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try { setSnapshot(await loadRanking(period)); }
    catch { setError('Não foi possível carregar o ranking agora.'); }
    finally { setLoading(false); }
  }, [period, session]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Ranking" subtitle="XP confirmado pelo estudo" onMenu={openMenu} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.period}>
          <Text style={[styles.label, { color: colors.textSubtle }]}>PERÍODO</Text>
          <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} animated />
        </View>

        {!session ? <Empty icon="person-outline" title="Entre para participar" description="O ranking usa apenas XP confirmado na sua conta." />
          : loading && !snapshot ? <View accessibilityRole="progressbar" accessibilityLabel="Carregando ranking" style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.muted, { color: colors.textMuted }]}>Carregando classificação…</Text></View>
          : error && !snapshot ? <View style={[styles.error, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]} accessibilityRole="alert"><Text style={[styles.muted, { color: colors.text }]}>{error}</Text><Pressable onPress={() => void refresh()} accessibilityRole="button" style={[styles.retry, { borderColor: colors.borderStrong }]}><Text style={[styles.retryText, { color: colors.text }]}>Tentar novamente</Text></Pressable></View>
          : snapshot ? <>
            <Pressable
              onPress={() => router.push('/configuracoes')}
              accessibilityRole="button"
              accessibilityLabel="Gerenciar privacidade do ranking nas configurações"
              style={({ pressed }) => [styles.privacy, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.78 }]}>
              <View style={styles.privacyCopy}><Text style={[styles.privacyTitle, { color: colors.text }]}>Privacidade do ranking</Text><Text style={[styles.muted, { color: colors.textMuted }]}>Sua participação é controlada nas Configurações.</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Pressable>
            {error ? <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.danger }]}>{error}</Text> : null}
            {snapshot.currentUser ? <YourPosition entry={snapshot.currentUser} period={period} /> : null}
            <View style={styles.heading}><View><Text style={[styles.label, { color: colors.primary }]}>CLASSIFICAÇÃO</Text><Text style={[styles.title, { color: colors.text }]}>Destaques {RANKING_PERIOD_LABELS[period]}</Text></View><Text style={[styles.count, { color: colors.textSubtle }]}>{snapshot.totalParticipants} participantes</Text></View>
            {snapshot.entries.length ? <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }, cardShadow(colors.shadow, 1)]}>{snapshot.entries.map((entry, index) => <RankingRow key={`${entry.username ?? entry.name}:${entry.rank}`} entry={entry} divider={index < snapshot.entries.length - 1} />)}</View>
              : <Empty icon="trophy-outline" title="Ranking começando" description="Ainda não há participantes públicos neste período." />}
          </> : null}
      </ScrollView>
    </View>
  );
}

function Empty({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  const { colors } = useTheme();
  return <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name={icon} size={30} color={colors.textSubtle} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.muted, { color: colors.textMuted }]}>{description}</Text></View>;
}

function YourPosition({ entry, period }: { entry: RankingEntry & { isPublic: boolean }; period: RankingPeriod }) {
  const { colors } = useTheme();
  return (
    <FeaturedCard
      icon="trophy-outline"
      title={`#${entry.rank} · ${entry.name}`}
      description={`Sua posição ${entry.isPublic ? 'pública' : 'estimada'} ${RANKING_PERIOD_LABELS[period]}`}
      tone="achievement"
      compact
      accessibilityLabel={`Sua posição ${RANKING_PERIOD_LABELS[period]}: ${entry.rank}, com ${entry.points} XP`}>
      <View style={styles.yoursSummary}>
        <Text style={[styles.muted, { color: colors.textMuted }]}>Nível {entry.level} · {entry.activityCount} atividades válidas</Text>
        <View style={styles.score}>
          <Text style={[styles.scoreValue, { color: colors.energy }]}>{entry.points.toLocaleString('pt-BR')}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textSubtle }]}>XP</Text>
        </View>
      </View>
    </FeaturedCard>
  );
}

function RankingRow({ entry, divider }: { entry: RankingEntry; divider: boolean }) {
  const { colors } = useTheme();
  const identity = entry.username ? `@${entry.username} · nível ${entry.level}` : `Nível ${entry.level}`;
  return <View accessible accessibilityLabel={`${entry.rank}º lugar, ${entry.name}, ${entry.points} XP, nível ${entry.level}`} style={[styles.row, divider && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.rowRank, { color: colors.textSubtle }]}>#{entry.rank}</Text><View style={[styles.avatar, { backgroundColor: entry.rank <= 3 ? colors.warningSoft : colors.surfaceAlt }]}><Text style={[styles.avatarText, { color: entry.rank <= 3 ? colors.warning : colors.textMuted }]}>{rankingInitials(entry.name)}</Text></View><View style={styles.identity}><Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{entry.name}</Text><Text style={[styles.muted, { color: colors.textSubtle }]} numberOfLines={1}>{identity}</Text></View><View style={styles.score}><Text style={[styles.rowScore, { color: colors.text }]}>{entry.points.toLocaleString('pt-BR')}</Text><Text style={[styles.scoreLabel, { color: colors.textSubtle }]}>XP</Text></View></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.lg }, period: { gap: Spacing.xs }, label: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 }, loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }, muted: { fontSize: FontSize.small, lineHeight: 19 }, error: { minHeight: 80, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.md }, retry: { minHeight: 44, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md }, retryText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold }, inlineError: { fontSize: FontSize.small, fontWeight: FontWeight.semibold }, privacy: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md }, privacyCopy: { flex: 1, gap: 3 }, privacyTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold }, yoursSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md }, heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md }, title: { marginTop: 3, fontSize: FontSize.title, fontWeight: FontWeight.bold }, count: { fontSize: FontSize.tiny }, list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md }, rowRank: { width: 34, fontSize: FontSize.small, fontWeight: FontWeight.bold, textAlign: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: FontSize.small, fontWeight: FontWeight.bold }, identity: { minWidth: 0, flex: 1, gap: 3 }, rowName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold }, score: { alignItems: 'flex-end' }, scoreValue: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] }, rowScore: { fontSize: FontSize.body, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] }, scoreLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium }, empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.xl }, emptyTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
});
