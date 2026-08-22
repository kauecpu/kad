import Ionicons from '@/components/ui/app-icon';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { FontSize, FontWeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useModalTransition } from '@/hooks/use-modal-transition';
import type { ConcursoFilterKey, ConcursoFilters } from '@/lib/concursos';
import { normalizeSearchText } from '@/lib/text';

export type ConcursoFilterSection = {
  key: ConcursoFilterKey;
  title: string;
  options: string[];
};

type ConcursoFilterSheetProps = {
  visible: boolean;
  filters: ConcursoFilters;
  sections: ConcursoFilterSection[];
  onChange: (filters: ConcursoFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

export function ConcursoFilterSheet({
  visible,
  filters,
  sections,
  onChange,
  onClear,
  onClose,
}: ConcursoFilterSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, interactive, backdropStyle, surfaceStyle } = useModalTransition(visible);
  const [query, setQuery] = useState('');
  const activeCount = Object.values(filters).reduce((total, selected) => total + selected.length, 0);

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const visibleSections = useMemo(() => {
    const term = normalizeSearchText(query);
    if (!term) return sections;
    return sections
      .map((section) => ({
        ...section,
        options: section.options.filter((option) => normalizeSearchText(option).includes(term)),
      }))
      .filter((section) => section.options.length > 0);
  }, [query, sections]);

  const toggle = (key: ConcursoFilterKey, value: string) => {
    const selected = filters[key];
    onChange({
      ...filters,
      [key]: selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    });
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <Animated.View
        accessibilityElementsHidden={!interactive}
        importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
        style={[
          styles.backdrop,
          { backgroundColor: colors.overlay, pointerEvents: interactive ? 'auto' : 'none' },
          backdropStyle,
        ]}>
        <Pressable style={styles.backdropTouchable} onPress={onClose} accessibilityLabel="Fechar" />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: insets.bottom + Spacing.md,
            },
            surfaceStyle,
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.identityRow}>
                <View style={[styles.identityRail, { backgroundColor: colors.primary }]} />
                <Text style={[styles.identityLabel, { color: colors.primary }]}>AJUSTAR RADAR</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Filtros</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Escolha o que entra na sua busca
              </Text>
            </View>
            {activeCount > 0 ? (
              <Pressable onPress={onClear} hitSlop={8} accessibilityLabel="Limpar filtros">
                <Text style={[styles.clear, { color: colors.primary }]}>Limpar ({activeCount})</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar filtros"
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar dentro dos filtros"
          />

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {visibleSections.map((section, sectionIndex) => (
              <View key={section.key} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSubtle }]}>
                  {`K/${String(sectionIndex + 1).padStart(2, '0')} · ${section.title.toUpperCase()}`}
                </Text>
                <View style={styles.options}>
                  {section.options.map((option) => {
                    const selected = filters[section.key].includes(option);
                    return (
                      <Pressable
                        key={option}
                        onPress={() => toggle(section.key, option)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={`${section.title}: ${option}`}
                        style={({ pressed }) => [
                          styles.option,
                          {
                            backgroundColor: selected ? colors.primarySoft : colors.surface,
                            borderColor: selected ? colors.borderStrong : colors.border,
                          },
                          pressed && styles.pressed,
                        ]}>
                        <Text
                          style={[
                            styles.optionText,
                            { color: selected ? colors.primary : colors.textMuted },
                          ]}>
                          {option}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {visibleSections.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSubtle }]}>Nenhum filtro encontrado.</Text>
            ) : null}
          </ScrollView>

          <Button
            label={activeCount > 0 ? `Aplicar filtros (${activeCount})` : 'Ver concursos'}
            size="lg"
            onPress={onClose}
            fullWidth
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  backdropTouchable: { flex: 1 },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  grabber: { width: 40, height: 4, borderRadius: Radius.pill, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: 2 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  identityRail: { width: 18, height: 3, transform: [{ skewX: '-24deg' }] },
  identityLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.small },
  clear: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { gap: Spacing.lg, paddingBottom: Spacing.sm },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.55,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  optionText: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  empty: { textAlign: 'center', paddingVertical: Spacing.xl, fontSize: FontSize.body },
  pressed: { opacity: 0.7 },
});
