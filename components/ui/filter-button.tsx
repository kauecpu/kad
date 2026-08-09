import Ionicons from '@/components/ui/app-icon';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FilterButtonProps = {
  onPress: () => void;
  /** Quantidade de filtros ativos; exibe um selo quando maior que zero. */
  activeCount?: number;
};

/** Botão de filtro (ícone) com selo de contagem, usado nos players de questões. */
export function FilterButton({ onPress, activeCount = 0 }: FilterButtonProps) {
  const { colors } = useTheme();
  const active = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Filtrar questões"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: active ? colors.primary : colors.surfaceAlt,
          borderColor: 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Ionicons name="options-outline" size={20} color={active ? colors.onPrimary : colors.text} />
      {active ? (
        <View style={[styles.badge, { backgroundColor: colors.onPrimary }]}>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{activeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
  },
});
