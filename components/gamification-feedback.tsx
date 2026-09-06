import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import Ionicons from '@/components/ui/app-icon';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import type { LevelNotice } from '@/contracts/level-tracker';
import { useTheme } from '@/hooks/use-theme';
import { useLevels } from '@/providers/levels-provider';

export function GamificationFeedback() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { state, consumeNotice } = useLevels();
  const [active, setActive] = useState<LevelNotice | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (active || !state.notices.length) return;
    const next = state.notices[0];
    if (seen.current.has(next.id)) return;
    seen.current.add(next.id);
    setActive(next);
    consumeNotice(next.id);
    const message = next.achievements.length
      ? `Conquista desbloqueada: ${next.achievements.map(item => item.title).join(', ')}`
      : next.level
        ? `Você alcançou o nível ${next.level}`
        : `Mais ${next.xp} XP`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [active, consumeNotice, state.notices]);

  useEffect(() => {
    if (!active || active.achievements.length || active.level) return;
    const timer = setTimeout(() => setActive(null), reduceMotion ? 900 : 1800);
    return () => clearTimeout(timer);
  }, [active, reduceMotion]);

  if (!active) return null;
  if (!active.achievements.length && !active.level) {
    return (
      <View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.xpToast, { backgroundColor: colors.text }]}>
        <Ionicons name="sparkles" size={17} color={colors.background} />
        <Text style={[styles.xpToastText, { color: colors.background }]}>+{active.xp} XP</Text>
      </View>
    );
  }

  const primary = active.achievements[0];
  const title = primary ? 'Conquista desbloqueada' : `Nível ${active.level}`;
  const description = primary
    ? primary.description
    : 'Seu estudo acumulado levou você a um novo nível.';

  return (
    <Modal
      transparent
      visible
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={() => setActive(null)}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View accessibilityRole="alert" style={[styles.modal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name={(primary?.icon ?? 'star') as keyof typeof Ionicons.glyphMap} size={30} color={colors.warning} />
          </View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{title.toLocaleUpperCase('pt-BR')}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{primary?.title ?? 'Você subiu de nível'}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
          {active.achievements.length > 1 ? (
            <Text style={[styles.more, { color: colors.textMuted }]}>+{active.achievements.length - 1} conquista(s) desbloqueada(s)</Text>
          ) : null}
          {active.xp > 0 ? <Text style={[styles.xp, { color: colors.success }]}>+{active.xp} XP confirmados</Text> : null}
          <Pressable
            onPress={() => setActive(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso de conquista"
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Continuar estudando</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modal: { width: '100%', maxWidth: 420, alignItems: 'center', borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.sm },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  eyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, textAlign: 'center' },
  description: { fontSize: FontSize.body, lineHeight: 22, textAlign: 'center' },
  more: { fontSize: FontSize.small, textAlign: 'center' },
  xp: { fontSize: FontSize.small, fontWeight: FontWeight.bold, marginTop: Spacing.xs },
  button: { minHeight: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
  buttonText: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  xpToast: { position: 'absolute', zIndex: 40, bottom: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  xpToastText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
});
