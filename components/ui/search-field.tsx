import Ionicons from '@/components/ui/app-icon';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
};

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar',
  accessibilityLabel,
}: SearchFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: focused ? colors.surfaceRaised : colors.surfaceAlt,
          borderColor: focused ? colors.focusRing : colors.border,
        },
      ]}>
      <Ionicons name="search" size={18} color={colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        style={[styles.input, { color: colors.text }]}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: FontSize.body,
    paddingVertical: 0,
  },
});
