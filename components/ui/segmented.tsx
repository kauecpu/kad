import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  animated?: boolean;
  haptic?: boolean;
};

/** Controle segmentado. O item selecionado é destacado com o roxo da marca. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  animated = false,
  haptic = false,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0
  );
  const position = useRef(new Animated.Value(selectedIndex)).current;
  const itemWidth =
    options.length > 0
      ? (containerWidth - CONTAINER_PADDING * 2 - ITEM_GAP * (options.length - 1)) /
        options.length
      : 0;

  useEffect(() => {
    if (!animated) {
      position.setValue(selectedIndex);
      return;
    }

    const selectionAnimation = Animated.timing(position, {
      toValue: selectedIndex,
      duration: 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    selectionAnimation.start();
    return () => selectionAnimation.stop();
  }, [animated, position, selectedIndex]);

  function handleChange(nextValue: T) {
    if (nextValue === value) return;

    onChange(nextValue);

    if (haptic) {
      const feedback =
        Platform.OS === 'android'
          ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
          : Haptics.selectionAsync();
      void feedback.catch(() => undefined);
    }
  }

  return (
    <View
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      style={[
        styles.container,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
      ]}>
      {animated && itemWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: itemWidth,
              backgroundColor: colors.primary,
              borderColor: colors.primaryStrong,
              shadowColor: colors.shadow,
              transform: [
                {
                  translateX: Animated.multiply(position, itemWidth + ITEM_GAP),
                },
              ],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <SegmentedItem
            key={option.value}
            label={option.label}
            selected={selected}
            animated={animated}
            selectedColor={animated ? colors.onPrimary : colors.primary}
            unselectedColor={colors.textMuted}
            selectedBackground={colors.primarySoft}
            onPress={() => handleChange(option.value)}
          />
        );
      })}
    </View>
  );
}

type SegmentedItemProps = {
  label: string;
  selected: boolean;
  animated: boolean;
  selectedColor: string;
  unselectedColor: string;
  selectedBackground: string;
  onPress: () => void;
};

function SegmentedItem({
  label,
  selected,
  animated,
  selectedColor,
  unselectedColor,
  selectedBackground,
  onPress,
}: SegmentedItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateScale(toValue: number) {
    scale.stopAnimation();
    Animated.timing(scale, {
      toValue,
      duration: toValue < 1 ? 55 : 85,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animated && animateScale(0.95)}
      onPressOut={() => animated && animateScale(1)}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.item,
        selected && !animated && { backgroundColor: selectedBackground },
      ]}>
      <Animated.View style={[styles.itemContent, animated && { transform: [{ scale }] }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: selected ? selectedColor : unselectedColor },
            selected && styles.labelSelected,
          ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const CONTAINER_PADDING = 3;
const ITEM_GAP = 4;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: CONTAINER_PADDING,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: ITEM_GAP,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    left: CONTAINER_PADDING,
    top: CONTAINER_PADDING,
    bottom: CONTAINER_PADDING,
    borderRadius: Radius.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  item: {
    flex: 1,
    borderRadius: Radius.sm + 2,
  },
  itemContent: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  label: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
  },
  labelSelected: {
    fontWeight: FontWeight.bold,
  },
});
