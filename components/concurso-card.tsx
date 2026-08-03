import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineInfo } from '@/lib/concursos';
import { formatRelativeDay, formatSalaryShort } from '@/lib/format';
import type { Concurso } from '@/types';

type ConcursoCardProps = {
  concurso: Concurso;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
};

function ConcursoCardComponent({ concurso, saved = false, onPress, onToggleSave }: ConcursoCardProps) {
  const { colors } = useTheme();
  const deadline = deadlineInfo(concurso);
  const iconName = (concurso.icon ?? 'business') as keyof typeof Ionicons.glyphMap;
  const salary =
    concurso.salaryMin === concurso.salaryMax
      ? `Até ${formatSalaryShort(concurso.salaryMax)}`
      : `${formatSalaryShort(concurso.salaryMin)} – ${formatSalaryShort(concurso.salaryMax)}`;
  const location =
    concurso.state === 'Nacional'
      ? 'Âmbito nacional'
      : `${concurso.city ? `${concurso.city} · ` : ''}${concurso.state}`;

  return (
    <Card padded={false} style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${concurso.organ}: ${concurso.title}`}
        style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}>
        <View style={styles.headerRow}>
          <View style={styles.logo}>
            <Ionicons name={iconName} size={20} color={colors.primary} />
          </View>
          <View style={[styles.headerText, onToggleSave && styles.headerTextWithSave]}>
            <Text style={[styles.organ, { color: colors.textMuted }]} numberOfLines={1}>
              {concurso.organ}
            </Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {concurso.title}
            </Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSubtle} />
          <Text style={[styles.location, { color: colors.textSubtle }]} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
          <Text style={[styles.trustText, { color: colors.textMuted }]}>
            {concurso.contentSource === 'published'
              ? `Fonte oficial verificada · Atualizado ${formatRelativeDay(concurso.updatedAt)}`
              : `Dados demonstrativos · Atualizado ${formatRelativeDay(concurso.updatedAt)}`}
          </Text>
        </View>

        <View style={[styles.quickFacts, { borderTopColor: colors.border }]}>
          <View style={styles.quickFact}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={[styles.quickFactValue, { color: colors.text }]} numberOfLines={1}>
              {salary}
            </Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: colors.border }]} />
          <View style={styles.quickFact}>
            <Ionicons name="people-outline" size={16} color={colors.primary} />
            <Text style={[styles.quickFactValue, { color: colors.text }]} numberOfLines={1}>
              {`${concurso.vacancies.toLocaleString('pt-BR')} vagas`}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Badge label={deadline.label} tone={deadline.tone} icon={deadline.icon} />
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
      </Pressable>

      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar concurso'}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.surfaceAlt },
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? colors.primary : colors.textSubtle}
          />
        </Pressable>
      ) : null}
    </Card>
  );
}

export const ConcursoCard = memo(ConcursoCardComponent);

const styles = StyleSheet.create({
  card: { position: 'relative' },
  cardMain: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg },
  cardPressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  logo: {
    width: 24,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  headerTextWithSave: { paddingRight: 32 },
  organ: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
    lineHeight: 17,
  },
  title: { fontSize: FontSize.body + 1, fontWeight: FontWeight.bold, lineHeight: 20 },
  saveButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -Spacing.xs },
  location: { flex: 1, fontSize: FontSize.tiny },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText: { fontSize: FontSize.tiny, fontWeight: FontWeight.medium },
  quickFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quickFact: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  quickFactValue: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  factDivider: { width: StyleSheet.hairlineWidth, height: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pressed: { opacity: 0.6 },
});
