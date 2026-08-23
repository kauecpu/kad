import Ionicons from '@/components/ui/app-icon';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineInfo } from '@/lib/concursos';
import { formatSalaryRangeShort } from '@/lib/format';
import type { Concurso } from '@/types';

type ConcursoCardProps = {
  concurso: Concurso;
  index?: number;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
};

function ConcursoCardComponent({
  concurso,
  index,
  saved = false,
  onPress,
  onToggleSave,
}: ConcursoCardProps) {
  const { colors } = useTheme();
  const deadline = deadlineInfo(concurso);
  const urgent = deadline.tone === 'warning' || deadline.tone === 'danger';
  const deadlineColor = urgent ? colors.warning : colors.textMuted;
  const salary = formatSalaryRangeShort(concurso.salaryMin, concurso.salaryMax);
  const location =
    concurso.state === 'Nacional'
      ? 'Âmbito nacional'
      : `${concurso.city ? `${concurso.city} · ` : ''}${concurso.state}`;
  const marker = index ? String(index).padStart(2, '0') : concurso.shortName.toUpperCase();

  return (
    <Card
      padded={false}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: saved ? colors.borderStrong : colors.border,
        },
      ]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${concurso.title}, ${concurso.organ}. ${salary}. ${concurso.vacancies.toLocaleString('pt-BR')} vagas. ${deadline.label}. ${location}.`}
        style={({ pressed }) => [
          styles.cardMain,
          pressed && styles.cardPressed,
        ]}>
        <View style={styles.identityRow}>
          <Text style={[styles.marker, { color: colors.textSubtle }]}>
            {index ? `${marker} · ${concurso.shortName}` : concurso.shortName}
          </Text>
        </View>

        <View style={styles.heading}>
          <Text style={[styles.title, { color: colors.text }]}>{concurso.title}</Text>
          <Text style={[styles.organ, { color: colors.textMuted }]}>{concurso.organ}</Text>
        </View>

        <View
          style={[
            styles.facts,
            { borderTopColor: colors.border, borderBottomColor: colors.border },
          ]}>
          <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: colors.textSubtle }]}>REMUNERAÇÃO</Text>
            <Text style={[styles.factValue, { color: colors.text }]}>{salary}</Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: colors.border }]} />
          <View style={styles.fact}>
            <Text style={[styles.factLabel, { color: colors.textSubtle }]}>VAGAS</Text>
            <Text style={[styles.factValue, { color: colors.text }]}>
              {concurso.vacancies.toLocaleString('pt-BR')}
            </Text>
          </View>
        </View>

        <View style={[styles.footer, onToggleSave && styles.footerWithSave]}>
          <View style={styles.deadline}>
            <Ionicons name={deadline.icon} size={14} color={deadlineColor} />
            <Text style={[styles.deadlineText, { color: deadlineColor }]}>
              {deadline.label}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSubtle} />
            <Text style={[styles.location, { color: colors.textSubtle }]}>{location}</Text>
          </View>
        </View>
      </Pressable>

      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar concurso'}
          accessibilityState={{ selected: saved }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: saved ? colors.primarySoft : colors.surfaceAlt },
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? colors.primary : colors.textMuted}
          />
        </Pressable>
      ) : null}
    </Card>
  );
}

export const ConcursoCard = memo(ConcursoCardComponent);

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  cardMain: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  marker: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
  heading: { gap: 3 },
  title: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
    letterSpacing: -0.25,
  },
  organ: { fontSize: FontSize.small, lineHeight: 18 },
  facts: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fact: { flex: 1, minWidth: 0, gap: 3 },
  factLabel: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.65,
  },
  factValue: { fontSize: FontSize.small, fontWeight: FontWeight.bold, lineHeight: 18 },
  factDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: Spacing.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: Spacing.md,
    rowGap: Spacing.sm,
    minHeight: 32,
  },
  footerWithSave: { paddingRight: 44 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  deadlineText: { fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  location: { flexShrink: 1, fontSize: FontSize.tiny, lineHeight: 16 },
  saveButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.sm + 2,
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
});
