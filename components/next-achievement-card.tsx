import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Ionicons from '@/components/ui/app-icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { nextLockedAchievement } from '@/contracts/achievements';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLevels } from '@/providers/levels-provider';

export function NextAchievementCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { state } = useLevels();
  const next = nextLockedAchievement(state.achievements);
  if (!next) return null;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/perfil')}
      accessibilityRole="button"
      accessibilityLabel={`Próxima conquista: ${next.title}. ${next.value} de ${next.threshold}. Abrir perfil`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: colors.warningSoft }]}>
        <Ionicons name={next.icon as keyof typeof Ionicons.glyphMap} size={22} color={colors.warning} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.textSubtle }]}>PRÓXIMA CONQUISTA</Text>
        <Text style={[styles.title, { color: colors.text }]}>{next.title}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>{next.value.toLocaleString('pt-BR')} de {next.threshold.toLocaleString('pt-BR')}</Text>
        <ProgressBar value={next.progress * 100} height={5} label={`Progresso de ${next.title}`} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  icon: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  copy: { minWidth: 0, flex: 1, gap: 4 },
  eyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.7 },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  meta: { fontSize: FontSize.tiny, fontVariant: ['tabular-nums'] },
});
