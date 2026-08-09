import Ionicons from '@/components/ui/app-icon';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deadlineInfo } from '@/lib/concursos';
import { formatSalaryShort } from '@/lib/format';
import type { Concurso } from '@/types';

type ConcursoCardProps = {
  concurso: Concurso;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
};

function ConcursoCardComponent({ concurso, saved = false, onPress, onToggleSave }: ConcursoCardProps) {
  const { colors, scheme } = useTheme();
  const deadline = deadlineInfo(concurso);
  const deadlineColor =
    deadline.tone === 'danger'
      ? scheme === 'dark'
        ? '#FF6B72'
        : '#E5484D'
      : deadline.tone === 'warning'
        ? scheme === 'dark'
          ? '#FFB454'
          : '#E98613'
        : deadline.tone === 'neutral'
          ? colors.textSubtle
          : scheme === 'dark'
            ? '#72AFFF'
            : '#3478F6';
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
          <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
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

        <View style={[styles.quickFacts, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.quickFact}>
            <View
              style={[
                styles.salaryIcon,
                { backgroundColor: scheme === 'dark' ? '#143B31' : '#E7F8F1' },
              ]}>
              <Text
                style={[
                  styles.salaryIconText,
                  { color: scheme === 'dark' ? '#5BE0AE' : '#109A6B' },
                ]}>
                $
              </Text>
            </View>
            <Text style={[styles.quickFactValue, { color: colors.text }]} numberOfLines={1}>
              {salary}
            </Text>
          </View>
          <View style={[styles.factDivider, { backgroundColor: colors.border }]} />
          <View style={styles.quickFact}>
            <View style={[styles.factIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="people-outline" size={15} color={colors.primary} />
            </View>
            <Text style={[styles.quickFactValue, { color: colors.text }]} numberOfLines={1}>
              {`${concurso.vacancies.toLocaleString('pt-BR')} vagas`}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.deadline}>
            <Ionicons name={deadline.icon} size={14} color={deadlineColor} />
            <Text style={[styles.deadlineText, { color: deadlineColor }]}>{deadline.label}</Text>
          </View>
          <View style={styles.footerRight}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textSubtle} />
              <Text style={[styles.location, { color: colors.textSubtle }]} numberOfLines={1}>
                {location}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </View>
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
  cardMain: { gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  cardPressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2, justifyContent: 'center' },
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
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, flex: 1 },
  location: { flexShrink: 1, fontSize: FontSize.tiny, textAlign: 'right' },
  quickFacts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderRadius: 12,
  },
  quickFact: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  salaryIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  salaryIconText: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    lineHeight: 17,
  },
  factIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickFactValue: { flexShrink: 1, fontSize: FontSize.small, fontWeight: FontWeight.bold },
  factDivider: { width: StyleSheet.hairlineWidth, height: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  footerRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  pressed: { opacity: 0.6 },
});
