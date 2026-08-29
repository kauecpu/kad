import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Assinatura visual opcional para um destaque de marca.
 * A arte é decorativa: não recebe eventos nem entra na leitura assistiva.
 */
export function KadCardArtwork() {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}>
      <LinearGradient
        colors={[colors.primary, colors.brandSurfaceDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.fold,
          { borderColor: colors.brandTrace, backgroundColor: colors.primary },
        ]}
      />
      <View
        style={[
          styles.foldHighlight,
          { borderColor: colors.brandTrace, backgroundColor: colors.onBrand },
        ]}
      />
      <View style={[styles.orbit, { borderColor: colors.brandTrace }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 112,
    overflow: 'visible',
    borderRadius: Radius.md,
  },
  fold: {
    position: 'absolute',
    width: 138,
    height: 88,
    right: 2,
    top: 24,
    borderWidth: 18,
    borderRadius: Radius.lg,
    transform: [{ rotate: '-28deg' }],
    opacity: 0.9,
    zIndex: 2,
  },
  foldHighlight: {
    position: 'absolute',
    width: 112,
    height: 70,
    right: 28,
    top: 6,
    borderWidth: 8,
    borderRadius: Radius.lg,
    transform: [{ rotate: '-28deg' }],
    opacity: 0.72,
    zIndex: 3,
  },
  orbit: {
    position: 'absolute',
    width: 128,
    height: 128,
    right: -30,
    bottom: -62,
    borderWidth: 18,
    borderRadius: 100,
    opacity: 0.38,
    zIndex: 2,
  },
});
