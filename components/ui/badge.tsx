import Ionicons from '@/components/ui/app-icon';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { toneColors, type Tone } from './tone';

type BadgeProps = {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ label, tone = 'neutral', icon, style }: BadgeProps) {
  const { colors } = useTheme();
  const { background, foreground } = toneColors(colors, tone);

  return (
    <View style={[styles.container, { backgroundColor: background }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={foreground} /> : null}
      <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
});
