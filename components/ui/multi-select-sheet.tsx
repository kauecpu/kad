import Ionicons from '@/components/ui/app-icon';
import { useEffect, useMemo, useReducer } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useModalTransition } from '@/hooks/use-modal-transition';
import { toggleValue } from '@/lib/questions';
import { normalizeSearchText } from '@/lib/text';
import {
  INITIAL_SELECTION_SHEET_SEARCH,
  selectionSheetSearchReducer,
} from '@/lib/selection-sheet';

type MultiSelectSheetProps = {
  visible: boolean;
  title: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose: () => void;
  selectionMode?: 'multiple' | 'single';
};

/** Modal pesquisável para selecionar qualquer dimensão textual da busca. */
export function MultiSelectSheet({
  visible,
  title,
  options,
  selected,
  onChange,
  onClose,
  selectionMode = 'multiple',
}: MultiSelectSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, interactive, backdropStyle, surfaceStyle } = useModalTransition(visible);
  const [search, dispatchSearch] = useReducer(
    selectionSheetSearchReducer,
    INITIAL_SELECTION_SHEET_SEARCH
  );

  useEffect(() => {
    dispatchSearch({ type: 'sync', context: title, visible });
  }, [title, visible]);

  const handleClose = () => {
    dispatchSearch({ type: 'close' });
    onClose();
  };

  const filtered = useMemo(() => {
    const q = normalizeSearchText(search.query);
    if (!q) return options;
    return options.filter((option) => normalizeSearchText(option).includes(q));
  }, [options, search.query]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}>
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
          onPress={handleClose}
          accessibilityLabel="Fechar"
        />

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
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            {selected.length > 0 ? (
              <Pressable onPress={() => onChange([])} hitSlop={8} accessibilityLabel="Limpar seleção">
                <Text style={[styles.clear, { color: colors.primary }]}>Limpar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="close" size={17} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.searchWrapper}>
            <SearchField
              value={search.query}
              onChangeText={(query) => dispatchSearch({ type: 'query', query })}
              placeholder={`Buscar ${title.toLowerCase()}`}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item);
              return (
                <Pressable
                  onPress={() =>
                    onChange(
                      selectionMode === 'single'
                        ? isSelected
                          ? []
                          : [item]
                        : toggleValue(selected, item)
                    )
                  }
                  accessibilityRole={selectionMode === 'single' ? 'radio' : 'checkbox'}
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={item}
                  style={({ pressed }) => [
                    styles.option,
                    { borderBottomColor: colors.border },
                    pressed && { backgroundColor: colors.surfaceAlt },
                  ]}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: isSelected ? colors.text : colors.textMuted },
                      isSelected && { fontWeight: FontWeight.semibold },
                    ]}
                    numberOfLines={2}>
                    {item}
                  </Text>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.borderStrong}
                  />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textSubtle }]}>Nenhuma opção encontrada.</Text>
            }
          />

          <Button
            label={
              selectionMode === 'single'
                ? selected.length > 0
                  ? `Confirmar ${title.toLowerCase()}`
                  : `Selecionar ${title.toLowerCase()}`
                : selected.length > 0
                  ? `Aplicar (${selected.length})`
                  : 'Aplicar'
            }
            size="lg"
            onPress={handleClose}
            fullWidth
          />
        </Animated.View>
      </Animated.View>
    </Modal>
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
    maxHeight: '82%',
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
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    flex: 1,
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
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
  searchWrapper: {
    marginBottom: Spacing.xs,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    flex: 1,
    fontSize: FontSize.body,
  },
  empty: {
    fontSize: FontSize.body,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
});
