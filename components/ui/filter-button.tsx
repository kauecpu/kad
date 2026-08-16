import Ionicons from '@/components/ui/app-icon';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FilterButtonProps = {
  onPress: () => void;
  /** Quantidade de filtros ativos; exibe um selo quando maior que zero. */
  activeCount?: number;
  /** Exibe o texto “Filtros” quando há espaço no cabeçalho. */
  showLabel?: boolean;
};

/** Botão de filtro (ícone) com selo de contagem, usado nos players de questões. */
export function FilterButton({ onPress, activeCount = 0, showLabel = false }: FilterButtonProps) {
  const { colors } = useTheme();
  const active = activeCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Filtrar questões"
      accessibilityHint="Abre opções de banca, ano e cargo"
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        showLabel && styles.buttonWithLabel,
        {
          backgroundColor: active ? colors.primary : colors.surfaceAlt,
          borderColor: 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Ionicons name="options-outline" size={20} color={active ? colors.onPrimary : colors.text} />
      {showLabel ? (
        <Text style={[styles.buttonLabel, { color: active ? colors.onPrimary : colors.text }]}>Filtros</Text>
      ) : null}
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
  buttonWithLabel: {
    width: 'auto',
    minWidth: 88,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
  },
  buttonLabel: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
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
