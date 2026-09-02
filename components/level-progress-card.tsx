import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LEVEL_MILESTONES, LEVEL_RULES, levelColor } from '@/contracts/levels';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLevels } from '@/providers/levels-provider';
import { ProgressBar } from '@/components/ui/progress-bar';
import Ionicons from '@/components/ui/app-icon';

const SEGMENTS = Array.from({ length: 32 }, (_, index) => index);

function LevelRing({ level }: { level: number }) {
  const { colors } = useTheme();
  const color = levelColor(level);
  const filled = level === 0 ? 0 : Math.max(1, Math.round((level / 100) * SEGMENTS.length));
  const milestone = LEVEL_MILESTONES.includes(level as (typeof LEVEL_MILESTONES)[number]);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`Nível ${level} de 100`} style={[styles.ring, { borderColor: color }]}>
      {SEGMENTS.map(index => {
        const angle = (index / SEGMENTS.length) * Math.PI * 2 - Math.PI / 2;
        return <View key={index} style={[styles.segment, {
          left: 30 + Math.cos(angle) * 27,
          top: 30 + Math.sin(angle) * 27,
          backgroundColor: index < filled ? color : colors.surfaceSunken,
          transform: [{ rotate: `${(angle * 180) / Math.PI + 90}deg` }],
        }]} />;
      })}
      {milestone ? <View style={[styles.milestone, { backgroundColor: colors.energyStrong }]} /> : null}
      <Text style={[styles.ringNumber, { color: colors.text }]}>{level}</Text>
    </View>
  );
}

export function LevelProgressCard() {
  const { colors } = useTheme();
  const { state, retry } = useLevels();
  const [rulesOpen, setRulesOpen] = useState(false);
  const progress = state.progress;
  const unavailable = state.status === 'unavailable' && !progress;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {state.status === 'loading' && !progress ? (
        <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Carregando nível">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textMuted }]}>Carregando seu nível…</Text>
        </View>
      ) : unavailable ? (
        <View style={styles.loading} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={22} color={colors.textMuted} />
          <View style={styles.unavailableCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Nível indisponível</Text>
            <Text style={[styles.muted, { color: colors.textMuted }]}>Seu progresso não foi substituído por zero. Tente sincronizar novamente.</Text>
          </View>
          <Pressable onPress={retry} accessibilityRole="button" style={[styles.retry, { borderColor: colors.borderStrong }]}><Text style={[styles.link, { color: colors.text }]}>Tentar de novo</Text></Pressable>
        </View>
      ) : progress ? (
        <>
          <View style={styles.heading}>
            <LevelRing level={progress.level} />
            <View style={styles.copy}>
              <Text style={[styles.eyebrow, { color: colors.textMuted }]}>SEU ESTUDO, ACUMULADO</Text>
              <Text style={[styles.title, { color: colors.text }]}>{`Nível ${progress.level} de 100`}</Text>
              <Text style={[styles.muted, { color: colors.textMuted }]}>Prática e constância. No seu ritmo.</Text>
            </View>
          </View>
          <View style={styles.xp}>
            <Text style={[styles.xpLabel, { color: colors.text }]}>{progress.max ? `${progress.totalXp.toLocaleString('pt-BR')} XP acumulados` : `${progress.currentXp.toLocaleString('pt-BR')} / ${progress.nextCost.toLocaleString('pt-BR')} XP`}</Text>
            <ProgressBar value={progress.ratio * 100} color={colors.text} height={8} label={progress.max ? 'Nível máximo alcançado' : `Progresso para o nível ${progress.level + 1}`} />
            <Text style={[styles.muted, { color: colors.textMuted }]}>{progress.max ? 'Nível máximo. Seu XP continua sendo acumulado.' : `Faltam ${progress.remainingXp.toLocaleString('pt-BR')} XP para o nível ${progress.level + 1}.`}</Text>
            {state.pending ? <Text accessibilityRole="alert" style={[styles.pending, { color: colors.warning }]}>{`${state.pending} ${state.pending === 1 ? 'atividade aguardando' : 'atividades aguardando'} confirmação.`}</Text> : null}
          </View>
          <Text style={[styles.muted, { color: colors.textMuted }]}>Questões, revisões e estudo válido geram XP.</Text>
          <Pressable onPress={() => setRulesOpen(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: rulesOpen }} style={styles.rulesButton}>
            <Text style={[styles.link, { color: colors.text }]}>Como ganhar XP</Text>
            <Ionicons name={rulesOpen ? 'chevron-up' : 'arrow-forward'} size={17} color={colors.text} />
          </Pressable>
          {rulesOpen ? <View style={[styles.rules, { borderTopColor: colors.border }]}>{LEVEL_RULES.map(([label, description]) => <View key={label} style={styles.rule}><Text style={[styles.ruleTitle, { color: colors.text }]}>{label}</Text><Text style={[styles.muted, { color: colors.textMuted }]}>{description}</Text></View>)}</View> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  copy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: FontWeight.medium, letterSpacing: .2 },
  title: { fontSize: FontSize.heading, lineHeight: 24, fontWeight: FontWeight.bold },
  muted: { fontSize: 14, lineHeight: 22 },
  xp: { gap: Spacing.sm },
  xpLabel: { fontSize: 14, lineHeight: 20, fontWeight: FontWeight.semibold },
  ring: { width: 64, height: 64, borderWidth: StyleSheet.hairlineWidth, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  ringNumber: { fontSize: 24, lineHeight: 29, fontWeight: FontWeight.bold },
  segment: { position: 'absolute', width: 4, height: 7, borderRadius: 2 },
  milestone: { position: 'absolute', width: 16, height: 4, borderRadius: 2, top: -2 },
  pending: { fontSize: 13, lineHeight: 18, fontWeight: FontWeight.semibold },
  rulesButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start', paddingHorizontal: Spacing.md },
  link: { fontSize: 14, lineHeight: 20, fontWeight: FontWeight.semibold },
  rules: { paddingTop: Spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.lg },
  rule: { gap: 3 },
  ruleTitle: { fontSize: 14, lineHeight: 20, fontWeight: FontWeight.semibold },
  loading: { minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  unavailableCopy: { flex: 1, gap: 3 },
  retry: { minHeight: 44, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
});
