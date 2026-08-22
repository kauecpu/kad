import Ionicons from '@/components/ui/app-icon';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useModalTransition } from '@/hooks/use-modal-transition';
import { countActiveFilters, EMPTY_FILTERS, toggleValue } from '@/lib/questions';
import type { QuestionFilters } from '@/types';

export type FilterOptions = {
  subjects?: string[];
  boards: string[];
  years: number[];
  roles: string[];
};

type QuestionFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filters: QuestionFilters;
  onChange: (filters: QuestionFilters) => void;
  options: FilterOptions;
  resultCount: number;
};

export function QuestionFilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  options,
  resultCount,
}: QuestionFilterSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, interactive, backdropStyle, surfaceStyle } = useModalTransition(visible);
  const activeCount = countActiveFilters(filters);

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
        <Pressable
          style={styles.backdropTouchable}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar filtros"
        />

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + Spacing.lg,
              borderColor: colors.border,
            },
            surfaceStyle,
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                Filtros
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {activeCount === 0
                  ? 'Nenhum filtro aplicado'
                  : `${activeCount} ${activeCount === 1 ? 'filtro aplicado' : 'filtros aplicados'}`}
              </Text>
            </View>

            {activeCount > 0 ? (
              <Pressable
                onPress={() => onChange(EMPTY_FILTERS)}
                accessibilityRole="button"
                accessibilityLabel="Limpar todos os filtros"
                hitSlop={8}>
                <Text style={[styles.clear, { color: colors.primary }]}>Limpar</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              hitSlop={8}
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="close" size={17} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {options.subjects && options.subjects.length > 1 ? (
              <FilterGroup label="Matéria">
                {options.subjects.map((subject) => (
                  <Chip
                    key={subject}
                    label={subject}
                    selected={filters.subjects.includes(subject)}
                    onPress={() =>
                      onChange({ ...filters, subjects: toggleValue(filters.subjects, subject) })
                    }
                  />
                ))}
              </FilterGroup>
            ) : null}

            <FilterGroup label="Banca">
              {options.boards.map((board) => (
                <Chip
                  key={board}
                  label={board}
                  selected={filters.boards.includes(board)}
                  onPress={() => onChange({ ...filters, boards: toggleValue(filters.boards, board) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Ano">
              {options.years.map((year) => (
                <Chip
                  key={year}
                  label={String(year)}
                  selected={filters.years.includes(year)}
                  onPress={() => onChange({ ...filters, years: toggleValue(filters.years, year) })}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Cargo">
              {options.roles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  selected={filters.roles.includes(role)}
                  onPress={() => onChange({ ...filters, roles: toggleValue(filters.roles, role) })}
                />
              ))}
            </FilterGroup>
          </ScrollView>

          <Button
            label={
              resultCount === 0
                ? 'Nenhuma questão encontrada'
                : `Ver ${resultCount} ${resultCount === 1 ? 'questão' : 'questões'}`
            }
            size="lg"
            onPress={onClose}
            fullWidth
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.small,
  },
  clear: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  group: {
    gap: Spacing.sm + 2,
  },
  groupLabel: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
