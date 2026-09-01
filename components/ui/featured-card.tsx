import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import Ionicons from '@/components/ui/app-icon';
import { PressFeedback } from '@/components/ui/press-feedback';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LinearGradient } from 'expo-linear-gradient';

type FeaturedCardTone = 'brand' | 'achievement';
type FeaturedCardVisual = 'plain' | 'faceted';

type FeaturedCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  accessory?: ReactNode;
  children?: ReactNode;
  actionLabel?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  tone?: FeaturedCardTone;
  visual?: FeaturedCardVisual;
  intensity?: 'standard' | 'strong';
  artwork?: ReactNode;
  compact?: boolean;
  motionFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Destaque editorial do KAD com superfície sólida e hierarquia direta. */
export function FeaturedCard({
  icon,
  title,
  description,
  accessory,
  children,
  actionLabel,
  onPress,
  accessibilityLabel,
  disabled = false,
  tone = 'brand',
  visual = 'plain',
  intensity = 'standard',
  artwork,
  compact = false,
  motionFeedback = false,
  style,
}: FeaturedCardProps) {
  const { colors } = useTheme();
  const { fontScale, width } = useWindowDimensions();
  const achievement = tone === 'achievement';
  const strong = intensity === 'strong';
  const accent = achievement ? colors.warning : colors.primary;
  const soft = achievement ? colors.warningSoft : colors.primarySoft;
  const foreground = strong ? colors.onBrand : colors.text;
  const mutedForeground = strong ? colors.onBrandMuted : colors.textMuted;
  const artworkWidth = fontScale >= 1.5 ? 92 : width < 768 ? 148 : 180;
  const showArtwork = Boolean(artwork) && width >= 420 && fontScale < 1.75;

  const cardContent = (
    <>
      <View style={styles.header}>
        <View
          style={[
            styles.icon,
            { backgroundColor: strong ? colors.brandTrace : soft },
          ]}>
          <Ionicons
            name={icon}
            size={compact ? 19 : 21}
            color={strong ? colors.onBrand : accent}
          />
        </View>

        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                compact && styles.titleCompact,
                { color: foreground },
              ]}>
              {title}
            </Text>
            {accessory}
          </View>
          {description ? (
            <Text style={[styles.description, { color: mutedForeground }]}>{description}</Text>
          ) : null}
        </View>
      </View>

      {children ? <View style={styles.content}>{children}</View> : null}

      {actionLabel ? (
        <View style={styles.action}>
          <Text
            style={[
              styles.actionText,
              { color: strong ? colors.onBrand : accent },
            ]}>
            {actionLabel}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={17}
            color={strong ? colors.onBrand : accent}
          />
        </View>
      ) : null}
    </>
  );

  const standardSurface = (
    <View
      style={[
        styles.surface,
        compact && styles.surfaceCompact,
        { backgroundColor: colors.surfaceAlt },
      ]}>
      {cardContent}
    </View>
  );

  const strongContent = (
    <>
      {showArtwork ? (
        <View style={styles.strongLayout}>
          <View style={styles.strongContent}>{cardContent}</View>
          <View style={[styles.artwork, { width: artworkWidth }]}>{artwork}</View>
        </View>
      ) : (
        cardContent
      )}
    </>
  );

  const strongSurface = visual === 'faceted' ? (
    <LinearGradient
      colors={[colors.brandSurfaceStrong, colors.brandSurfaceDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.surface, styles.surfaceStrong, compact && styles.surfaceCompact]}>
      {strongContent}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.surface,
        styles.surfaceStrong,
        compact && styles.surfaceCompact,
        { backgroundColor: colors.brandSurfaceStrong },
      ]}>
      {strongContent}
    </View>
  );

  const surface = strong ? strongSurface : standardSurface;

  const frameStyle: StyleProp<ViewStyle> = [
    styles.frame,
    strong && styles.frameStrong,
    { borderColor: strong ? 'transparent' : colors.borderStrong },
    disabled && styles.disabled,
    style,
  ];

  if (!onPress) {
    return <View style={frameStyle}>{surface}</View>;
  }

  if (motionFeedback) {
    return (
      <PressFeedback
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={frameStyle}>
        {surface}
      </PressFeedback>
    );
  }

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [frameStyle, pressed && !disabled && styles.pressed]}>
      {surface}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  frameStrong: {
    borderWidth: 0,
  },
  surface: {
    minHeight: 148,
    position: 'relative',
    overflow: 'hidden',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  surfaceCompact: {
    minHeight: 0,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  surfaceStrong: {
    minHeight: 164,
    padding: Spacing.xl,
  },
  strongLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  strongContent: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.lg,
  },
  artwork: {
    flexShrink: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontSize: FontSize.title,
    lineHeight: 29,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.45,
  },
  titleCompact: {
    fontSize: FontSize.heading,
    lineHeight: 23,
  },
  description: {
    maxWidth: 600,
    fontSize: FontSize.small,
    lineHeight: 19,
  },
  content: {
    gap: Spacing.md,
  },
  action: {
    minHeight: 44,
    maxWidth: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  actionText: {
    flexShrink: 1,
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
  disabled: {
    opacity: 0.72,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },
});

