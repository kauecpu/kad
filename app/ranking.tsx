import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@/components/ui/app-icon';
import { Chip } from '@/components/ui/chip';
import { FeaturedCard } from '@/components/ui/featured-card';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { StackHeader } from '@/components/ui/stack-header';
import { cardShadow, CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { RANKING_PARTICIPANTS, type RankingPeriod } from '@/data/ranking';
import { useTheme } from '@/hooks/use-theme';
import { buildRanking, localRankingScore, type RankingEntry } from '@/lib/ranking';
import { useApp } from '@/providers/app-provider';
import { useQuestions } from '@/providers/questions-provider';

const PERIOD_OPTIONS: SegmentedOption<RankingPeriod>[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Geral' },
];

const PODIUM_ORDER = [2, 1, 3];

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-BR') ?? '')
    .join('');
  return initials || 'VC';
}

export default function RankingScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { answers, profile } = useApp();
  const { questions, packs } = useQuestions();
  const [period, setPeriod] = useState<RankingPeriod>('today');
  const [packId, setPackId] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const isDesktop = width >= 760;
  const selectedPack = packs.find((pack) => pack.id === packId);

  const localScore = useMemo(
    () => localRankingScore({
      answers,
      questions,
      packs,
      period,
      packId,
    }),
    [answers, packId, packs, period, questions],
  );

  const ranking = useMemo(() => buildRanking({
    participants: RANKING_PARTICIPANTS,
    period,
    packId,
    currentUser: {
      id: 'current-user',
      name: profile.name || 'Você',
      username: profile.username ? `@${profile.username}` : '@voce',
      initials: initialsFor(profile.name || 'Você'),
      points: localScore.points,
      correct: localScore.correct,
      accuracy: Math.round(localScore.accuracy),
      streak: 0,
    },
  }), [localScore, packId, period, profile.name, profile.username]);

  const podium = ranking.slice(0, 3);
  const remaining = ranking.slice(3);
  const currentUser = ranking.find((entry) => entry.isCurrentUser);
  const periodLabel = period === 'today' ? 'hoje' : period === 'month' ? 'neste mês' : 'no geral';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title="Ranking"
        subtitle="Sua constância também merece destaque"
        onBack={() => router.back()}
        right={(
          <Pressable
            onPress={() => setRulesExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={rulesExpanded ? 'Ocultar regras do ranking' : 'Mostrar regras do ranking'}
            accessibilityState={{ expanded: rulesExpanded }}
            style={({ pressed }) => [
              styles.headerAction,
              { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.65 : 1 },
            ]}>
            <Ionicons name="information-circle-outline" size={21} color={colors.text} />
          </Pressable>
        )}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <FeaturedCard
          icon="trophy"
          title="Suba no ranking"
          description={`Acerte questões, some pontos e acompanhe sua posição ${periodLabel}.`}
          tone="achievement"
        />

        {rulesExpanded ? (
          <View style={[styles.rulesPanel, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Ionicons name="shield-checkmark-outline" size={21} color={colors.warning} />
            <View style={styles.rulesCopy}>
              <Text style={[styles.rulesTitle, { color: colors.text }]}>Como esta prévia funciona</Text>
              <Text style={[styles.rulesText, { color: colors.textMuted }]}>
                Seus pontos usam as respostas salvas neste aparelho. Os outros participantes são dados demonstrativos até o ranking ganhar backend próprio.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.controls, isDesktop && styles.controlsDesktop]}>
          <View style={styles.periodControl}>
            <Text style={[styles.controlLabel, { color: colors.textSubtle }]}>PERÍODO</Text>
            <Segmented
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
              animated
            />
          </View>
          <View style={styles.filterControl}>
            <Text style={[styles.controlLabel, { color: colors.textSubtle }]}>RECORTE</Text>
            <Pressable
              onPress={() => setFiltersExpanded((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={filtersExpanded ? 'Ocultar concursos' : 'Filtrar ranking por concurso'}
              accessibilityState={{ expanded: filtersExpanded }}
              style={({ pressed }) => [
                styles.filterButton,
                {
                  backgroundColor: selectedPack ? colors.primarySoft : colors.surfaceAlt,
                  borderColor: selectedPack ? colors.borderStrong : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="funnel-outline" size={17} color={selectedPack ? colors.primary : colors.textMuted} />
              <Text style={[styles.filterButtonText, { color: selectedPack ? colors.primary : colors.text }]} numberOfLines={1}>
                {selectedPack?.name ?? 'Todos os concursos'}
              </Text>
              <Ionicons name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSubtle} />
            </Pressable>
          </View>
        </View>

        {filtersExpanded ? (
          <View style={[styles.filterPanel, { backgroundColor: colors.surfaceAlt }]}>
            <View style={styles.filterPanelHeader}>
              <View>
                <Text style={[styles.filterPanelTitle, { color: colors.text }]}>Escolha o concurso</Text>
                <Text style={[styles.filterPanelDescription, { color: colors.textMuted }]}>O pódio e a lista mudam imediatamente.</Text>
              </View>
              {selectedPack ? (
                <Pressable
                  onPress={() => setPackId('all')}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar filtro de concurso"
                  hitSlop={8}>
                  <Text style={[styles.clearFilter, { color: colors.primary }]}>Limpar</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.filterOptions}>
              <Chip label="Todos" selected={packId === 'all'} onPress={() => setPackId('all')} />
              {packs.map((pack) => (
                <Chip
                  key={pack.id}
                  label={pack.name}
                  icon={pack.icon as keyof typeof Ionicons.glyphMap}
                  selected={packId === pack.id}
                  onPress={() => setPackId(pack.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>TOP 3</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pódio {selectedPack ? `· ${selectedPack.name}` : 'geral'}</Text>
          </View>
          <View style={[styles.updatedPill, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="phone-portrait-outline" size={13} color={colors.success} />
            <Text style={[styles.updatedText, { color: colors.success }]}>Prévia local</Text>
          </View>
        </View>

        <View style={styles.podium}>
          {PODIUM_ORDER.map((place) => {
            const entry = podium[place - 1];
            return entry ? <PodiumPlace key={entry.id} entry={entry} place={place} /> : null;
          })}
        </View>

        {currentUser ? <YourPosition entry={currentUser} /> : null}

        <View style={styles.listHeading}>
          <Text style={[styles.listTitle, { color: colors.text }]}>Classificação</Text>
          <Text style={[styles.listCount, { color: colors.textSubtle }]}>{ranking.length} participantes</Text>
        </View>

        <View style={[styles.rankingList, { borderColor: colors.border }]}>
          {remaining.map((entry, index) => (
            <RankingRow key={entry.id} entry={entry} showDivider={index < remaining.length - 1} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PodiumPlace({ entry, place }: { entry: RankingEntry; place: number }) {
  const { colors } = useTheme();
  const first = place === 1;
  const placeColor = first ? '#F8CE62' : place === 2 ? '#C6CFDB' : '#D69562';
  const trophyColor = first ? '#B77900' : place === 2 ? '#7A8797' : '#A95D2C';

  return (
    <View
      accessibilityLabel={`${place}º lugar, ${entry.name}, ${entry.points} pontos`}
      style={[
        styles.podiumPlace,
        first && styles.podiumPlaceFirst,
        { backgroundColor: colors.surface, borderColor: first ? colors.warning : colors.border },
        cardShadow(colors.shadow, first ? 2 : 1),
      ]}>
      <View style={[styles.placeBadge, { backgroundColor: placeColor }]}>
        <Text style={styles.placeBadgeText}>{place}</Text>
      </View>
      <Ionicons name="trophy" size={20} color={trophyColor} accessible={false} />
      <View style={[styles.podiumAvatar, { backgroundColor: first ? colors.warningSoft : colors.primarySoft }]}>
        <Text style={[styles.podiumInitials, { color: first ? colors.warning : colors.primary }]}>{entry.initials}</Text>
      </View>
      <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>{entry.name.split(' ')[0]}</Text>
      <Text style={[styles.podiumPoints, { color: colors.text }]}>{entry.points}</Text>
      <Text style={[styles.podiumPointsLabel, { color: colors.textSubtle }]}>pontos</Text>
    </View>
  );
}

function YourPosition({ entry }: { entry: RankingEntry }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.yourPosition, { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong }]}>
      <View style={[styles.yourRank, { backgroundColor: colors.primary }]}>
        <Text style={[styles.yourRankValue, { color: colors.onPrimary }]}>#{entry.rank}</Text>
      </View>
      <View style={styles.yourPositionCopy}>
        <Text style={[styles.yourPositionLabel, { color: colors.primary }]}>SUA POSIÇÃO</Text>
        <Text style={[styles.yourPositionName, { color: colors.text }]} numberOfLines={1}>{entry.name}</Text>
        <Text style={[styles.yourPositionMeta, { color: colors.textMuted }]}>
          {entry.correct} acertos · {entry.accuracy}% de aproveitamento
        </Text>
      </View>
      <View style={styles.yourPositionScore}>
        <Text style={[styles.yourScoreValue, { color: colors.primary }]}>{entry.points}</Text>
        <Text style={[styles.yourScoreLabel, { color: colors.textSubtle }]}>pontos</Text>
      </View>
    </View>
  );
}

function RankingRow({ entry, showDivider }: { entry: RankingEntry; showDivider: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={`${entry.rank}º lugar, ${entry.name}, ${entry.points} pontos`}
      style={[
        styles.rankingRow,
        entry.isCurrentUser && { backgroundColor: colors.primarySoft },
        showDivider && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <Text style={[styles.rowRank, { color: entry.isCurrentUser ? colors.primary : colors.textSubtle }]}>#{entry.rank}</Text>
      <View style={[styles.rowAvatar, { backgroundColor: entry.isCurrentUser ? colors.primary : colors.surfaceAlt }]}>
        <Text style={[styles.rowInitials, { color: entry.isCurrentUser ? colors.onPrimary : colors.textMuted }]}>{entry.initials}</Text>
      </View>
      <View style={styles.rowIdentity}>
        <View style={styles.rowNameLine}>
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{entry.name}</Text>
          {entry.isCurrentUser ? (
            <View style={[styles.youPill, { backgroundColor: colors.primary }]}>
              <Text style={[styles.youPillText, { color: colors.onPrimary }]}>VOCÊ</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowMeta, { color: colors.textSubtle }]} numberOfLines={1}>
          {entry.username} · {entry.accuracy}% acerto
        </Text>
      </View>
      <View style={styles.rowScore}>
        <Text style={[styles.rowScoreValue, { color: colors.text }]}>{entry.points}</Text>
        <Text style={[styles.rowScoreLabel, { color: colors.textSubtle }]}>pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  rulesPanel: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  rulesCopy: { flex: 1, gap: 3 },
  rulesTitle: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  rulesText: { fontSize: FontSize.small, lineHeight: 19 },
  controls: { gap: Spacing.md },
  controlsDesktop: { flexDirection: 'row', alignItems: 'flex-end' },
  periodControl: { flex: 1, gap: Spacing.xs },
  filterControl: { flex: 1, gap: Spacing.xs },
  controlLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  filterButtonText: { flex: 1, fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  filterPanel: { gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  filterPanelTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  filterPanelDescription: { marginTop: 2, fontSize: FontSize.tiny },
  clearFilter: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.md },
  sectionEyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 1 },
  sectionTitle: { marginTop: 2, fontSize: FontSize.title, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  updatedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.pill },
  updatedText: { fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  podiumPlace: { flex: 1, minWidth: 0, minHeight: 152, alignItems: 'center', gap: 3, paddingHorizontal: Spacing.xs, paddingVertical: Spacing.md, borderWidth: 1, borderRadius: Radius.lg },
  podiumPlaceFirst: { minHeight: 182, paddingTop: Spacing.lg },
  placeBadge: { position: 'absolute', top: -9, minWidth: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  placeBadgeText: { color: '#17120A', fontSize: FontSize.tiny, fontWeight: FontWeight.bold },
  podiumAvatar: { width: 46, height: 46, marginTop: Spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  podiumInitials: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  podiumName: { width: '100%', fontSize: FontSize.small, fontWeight: FontWeight.bold, textAlign: 'center' },
  podiumPoints: { marginTop: 3, fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  podiumPointsLabel: { fontSize: FontSize.tiny },
  yourPosition: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  yourRank: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  yourRankValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  yourPositionCopy: { flex: 1, minWidth: 0, gap: 2 },
  yourPositionLabel: { fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  yourPositionName: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  yourPositionMeta: { fontSize: FontSize.tiny },
  yourPositionScore: { alignItems: 'flex-end' },
  yourScoreValue: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  yourScoreLabel: { fontSize: FontSize.tiny },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  listCount: { fontSize: FontSize.tiny },
  rankingList: { overflow: 'hidden', borderWidth: 1, borderRadius: Radius.lg },
  rankingRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  rowRank: { width: 28, fontSize: FontSize.small, fontWeight: FontWeight.bold },
  rowAvatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  rowInitials: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold },
  rowIdentity: { flex: 1, minWidth: 0, gap: 2 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rowName: { flexShrink: 1, fontSize: FontSize.small, fontWeight: FontWeight.bold },
  rowMeta: { fontSize: FontSize.tiny },
  youPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: Radius.pill },
  youPillText: { fontSize: 8, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  rowScore: { alignItems: 'flex-end' },
  rowScoreValue: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  rowScoreLabel: { fontSize: FontSize.tiny },
});
