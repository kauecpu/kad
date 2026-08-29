import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Assinatura visual opcional para um destaque de marca.
 * A arte é decorativa: não recebe eventos nem entra na leitura assistiva.
 */
export type KadCardArtworkVariant = 'stack' | 'ribbon' | 'diamond' | 'layers' | 'wave' | 'signal';

export function KadCardArtwork({ variant = 'stack' }: { variant?: KadCardArtworkVariant }) {
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
      {variant === 'stack' ? (
        <>
          <View style={[styles.fold, { borderColor: colors.brandTrace, backgroundColor: colors.primary }]} />
          <View style={[styles.foldHighlight, { borderColor: colors.brandTrace, backgroundColor: colors.onBrand }]} />
          <View style={[styles.orbit, { borderColor: colors.brandTrace }]} />
        </>
      ) : null}
      {variant === 'ribbon' ? (
        <>
          <View style={[styles.ribbon, { backgroundColor: colors.brandTrace }]} />
          <View style={[styles.ribbonLight, { backgroundColor: colors.onBrand }]} />
          <View style={[styles.ribbonDot, { backgroundColor: colors.brandTrace }]} />
        </>
      ) : null}
      {variant === 'diamond' ? (
        <>
          <View style={[styles.diamond, { borderColor: colors.brandTrace, backgroundColor: colors.primary }]} />
          <View style={[styles.diamondInner, { borderColor: colors.onBrand }]} />
          <View style={[styles.diamondDot, { backgroundColor: colors.brandTrace }]} />
        </>
      ) : null}
      {variant === 'layers' ? (
        <>
          <View style={[styles.layerBack, { backgroundColor: colors.brandTrace }]} />
          <View style={[styles.layerMid, { backgroundColor: colors.primary }]} />
          <View style={[styles.layerFront, { backgroundColor: colors.onBrand }]} />
        </>
      ) : null}
      {variant === 'wave' ? (
        <>
          <View style={[styles.wave, { borderColor: colors.brandTrace }]} />
          <View style={[styles.waveInner, { borderColor: colors.onBrand }]} />
          <View style={[styles.waveDot, { backgroundColor: colors.brandTrace }]} />
        </>
      ) : null}
      {variant === 'signal' ? (
        <>
          <View style={[styles.signalBar, { backgroundColor: colors.brandTrace }]} />
          <View style={[styles.signalBarLight, { backgroundColor: colors.onBrand }]} />
          <View style={[styles.signalArc, { borderColor: colors.brandTrace }]} />
        </>
      ) : null}
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
  ribbon: {
    position: 'absolute', width: 190, height: 46, right: -26, top: 38,
    borderRadius: Radius.lg, transform: [{ rotate: '-18deg' }], opacity: 0.8,
  },
  ribbonLight: {
    position: 'absolute', width: 152, height: 20, right: 0, top: 50,
    borderRadius: Radius.md, transform: [{ rotate: '-18deg' }], opacity: 0.68,
  },
  ribbonDot: {
    position: 'absolute', width: 38, height: 38, right: 32, bottom: 10,
    borderRadius: 20, opacity: 0.7,
  },
  diamond: {
    position: 'absolute', width: 118, height: 118, right: 26, top: 8,
    borderWidth: 18, borderRadius: Radius.lg, transform: [{ rotate: '45deg' }], opacity: 0.78,
  },
  diamondInner: {
    position: 'absolute', width: 72, height: 72, right: 49, top: 31,
    borderWidth: 8, borderRadius: Radius.md, transform: [{ rotate: '45deg' }], opacity: 0.7,
  },
  diamondDot: {
    position: 'absolute', width: 26, height: 26, right: 74, bottom: 11,
    borderRadius: 13, opacity: 0.85,
  },
  layerBack: {
    position: 'absolute', width: 140, height: 84, right: -4, top: 24,
    borderRadius: Radius.md, transform: [{ rotate: '-24deg' }], opacity: 0.55,
  },
  layerMid: {
    position: 'absolute', width: 140, height: 84, right: 18, top: 14,
    borderRadius: Radius.md, transform: [{ rotate: '-24deg' }], opacity: 0.72,
  },
  layerFront: {
    position: 'absolute', width: 140, height: 84, right: 40, top: 4,
    borderRadius: Radius.md, transform: [{ rotate: '-24deg' }], opacity: 0.85,
  },
  wave: {
    position: 'absolute', width: 190, height: 150, right: -56, top: -4,
    borderWidth: 20, borderRadius: 100, transform: [{ rotate: '-20deg' }], opacity: 0.5,
  },
  waveInner: {
    position: 'absolute', width: 122, height: 108, right: -16, top: 18,
    borderWidth: 9, borderRadius: 80, transform: [{ rotate: '-20deg' }], opacity: 0.78,
  },
  waveDot: {
    position: 'absolute', width: 30, height: 30, right: 42, bottom: 12,
    borderRadius: 15, opacity: 0.78,
  },
  signalBar: {
    position: 'absolute', width: 200, height: 52, right: -44, top: 18,
    borderRadius: Radius.lg, transform: [{ rotate: '28deg' }], opacity: 0.55,
  },
  signalBarLight: {
    position: 'absolute', width: 160, height: 16, right: -2, top: 57,
    borderRadius: Radius.md, transform: [{ rotate: '28deg' }], opacity: 0.78,
  },
  signalArc: {
    position: 'absolute', width: 116, height: 116, right: -20, bottom: -58,
    borderWidth: 16, borderRadius: 70, opacity: 0.42,
  },
});
