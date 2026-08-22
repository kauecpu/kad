import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type KadProgressSignatureProps = {
  style?: StyleProp<ViewStyle>;
};

/** Traço angular da marca. É decorativo e não representa progresso numérico. */
export function KadProgressSignature({ style }: KadProgressSignatureProps) {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.frame, style]}>
      <View
        style={[styles.rail, styles.railWide, { backgroundColor: colors.brandTrace }]}
      />
      <View
        style={[styles.rail, styles.railThin, { backgroundColor: colors.brandTrace }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  rail: {
    position: 'absolute',
    height: 290,
    transform: [{ rotate: '-28deg' }],
  },
  railWide: {
    width: 58,
    right: 42,
    top: -76,
    opacity: 0.72,
  },
  railThin: {
    width: 14,
    right: 24,
    top: -68,
    opacity: 0.96,
  },
});
