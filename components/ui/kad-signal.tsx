import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type KadSignalProps = {
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Assinatura visual discreta do KAD: direção roxa com um ponto de energia amarelo.
 * É sempre decorativa e não representa progresso numérico.
 */
export function KadSignal({ compact = false, style }: KadSignalProps) {
  const { colors } = useTheme();

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.track,
        compact ? styles.compact : styles.regular,
        { backgroundColor: colors.primary },
        style,
      ]}>
      <View
        style={[
          styles.energy,
          compact ? styles.energyCompact : styles.energyRegular,
          { backgroundColor: colors.energyStrong },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    pointerEvents: 'none',
    borderRadius: Radius.pill,
  },
  regular: {
    width: 72,
    height: 3,
  },
  compact: {
    width: 28,
    height: 3,
  },
  energy: {
    height: '100%',
  },
  energyRegular: {
    width: 18,
  },
  energyCompact: {
    width: 8,
  },
});
