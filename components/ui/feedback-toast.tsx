import Ionicons from '@/components/ui/app-icon';
import { StyleSheet, Text, View } from 'react-native';

import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeedbackToastProps = {
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function FeedbackToast({ message, icon = 'checkmark-circle' }: FeedbackToastProps) {
  const { colors } = useTheme();
  if (!message) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: colors.text,
          borderColor: colors.borderStrong,
        },
      ]}>
      <Ionicons name={icon} size={19} color={colors.background} />
      <Text style={[styles.message, { color: colors.background }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    zIndex: 20,
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xl,
    maxWidth: CONTENT_MAX_WIDTH - Spacing.xl * 2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  message: {
    flexShrink: 1,
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
});
