import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@/components/ui/app-icon';
import { Chip } from '@/components/ui/chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ACHIEVEMENT_CATEGORIES, type AchievementCategory } from '@/contracts/achievements';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLevels } from '@/providers/levels-provider';

type Filter = AchievementCategory | 'all';

export function AchievementGallery() {
  const { colors } = useTheme();
  const { state } = useLevels();
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(
    () => state.achievements.filter(item => filter === 'all' || item.category === filter),
    [filter, state.achievements],
  );
  const unlocked = state.achievements.filter(item => item.unlockedAt).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>CONQUISTAS</Text>
          <Text style={[styles.title, { color: colors.text }]}>{unlocked} de {state.achievements.length} desbloqueadas</Text>
        </View>
        <View style={[styles.counter, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
          <Text style={[styles.counterText, { color: colors.warning }]}>{unlocked}</Text>
        </View>
      </View>

      {state.owner === null ? (
        <Text style={[styles.guest, { color: colors.textMuted }]}>Conquistas de visitante ficam somente neste aparelho.</Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {ACHIEVEMENT_CATEGORIES.map(category => (
          <Chip key={category.value} label={category.label} selected={filter === category.value} onPress={() => setFilter(category.value)} />
        ))}
      </ScrollView>

      <View style={styles.list}>
        {items.map(item => {
          const complete = Boolean(item.unlockedAt);
          return (
            <View
              key={item.key}
              accessible
              accessibilityLabel={`${item.title}. ${item.description}. ${complete ? 'Desbloqueada' : `${item.value} de ${item.threshold}`}`}
              style={[styles.item, { backgroundColor: complete ? colors.warningSoft : colors.surfaceAlt, borderColor: complete ? colors.warning : colors.border }]}>
              <View style={[styles.icon, { backgroundColor: complete ? colors.surface : colors.surfaceSunken }]}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={complete ? colors.warning : colors.textSubtle} />
              </View>
              <View style={styles.copy}>
                <View style={styles.titleLine}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                  {complete ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                </View>
                <Text style={[styles.description, { color: colors.textMuted }]}>{item.description}</Text>
                {complete ? (
                  <Text style={[styles.unlockedAt, { color: colors.success }]}>Desbloqueada em {new Date(item.unlockedAt!).toLocaleDateString('pt-BR')}</Text>
                ) : (
                  <View style={styles.progress}>
                    <Text style={[styles.progressText, { color: colors.textSubtle }]}>{item.value.toLocaleString('pt-BR')} de {item.threshold.toLocaleString('pt-BR')}</Text>
                    <ProgressBar value={item.progress * 100} height={5} label={`Progresso de ${item.title}`} />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  title: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  counter: { minWidth: 48, minHeight: 40, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: Spacing.md },
  counterText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  guest: { fontSize: FontSize.small, lineHeight: 19 },
  filters: { gap: Spacing.sm, paddingRight: Spacing.lg },
  list: { gap: Spacing.md },
  item: { flexDirection: 'row', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { minWidth: 0, flex: 1, gap: 4 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  itemTitle: { flex: 1, fontSize: FontSize.body, fontWeight: FontWeight.bold },
  description: { fontSize: FontSize.small, lineHeight: 19 },
  unlockedAt: { fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  progress: { gap: 5, marginTop: 2 },
  progressText: { fontSize: FontSize.tiny, fontVariant: ['tabular-nums'] },
});
