import Ionicons from '@/components/ui/app-icon';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DrawerMenuButtonProps = {
  onPress: () => void;
};

export function DrawerMenuButton({ onPress }: DrawerMenuButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir menu"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt },
      ]}>
      <Ionicons name="menu-outline" size={20} color={colors.text} filled={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
});
