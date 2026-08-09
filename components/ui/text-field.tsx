import Ionicons from '@/components/ui/app-icon';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showPasswordToggle?: boolean;
};

export function TextField({
  label,
  helper,
  error,
  icon,
  style,
  secureTextEntry,
  onFocus,
  onBlur,
  showPasswordToggle = false,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : 'transparent';
  const hasPasswordToggle = showPasswordToggle && secureTextEntry;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View>
        {icon ? (
          <Ionicons
            name={icon}
            size={19}
            color={error ? colors.danger : colors.textSubtle}
            style={styles.leadingIcon}
            accessible={false}
          />
        ) : null}
        <TextInput
          {...inputProps}
          secureTextEntry={secureTextEntry && !passwordVisible}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSubtle}
          style={[
            styles.input,
            icon && styles.inputWithIcon,
            hasPasswordToggle && styles.inputWithAction,
            { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor },
            style,
          ]}
        />
        {hasPasswordToggle ? (
          <Pressable
            onPress={() => setPasswordVisible((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            hitSlop={8}
            style={({ pressed }) => [styles.passwordAction, pressed && styles.pressed]}>
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={21}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.message, { color: colors.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[styles.message, { color: colors.textSubtle }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.semibold,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.body,
    minHeight: 52,
  },
  inputWithAction: {
    paddingRight: 52,
  },
  inputWithIcon: {
    paddingLeft: 44,
  },
  leadingIcon: {
    position: 'absolute',
    left: Spacing.md,
    top: 16,
    zIndex: 1,
  },
  passwordAction: {
    position: 'absolute',
    right: Spacing.sm,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  message: {
    fontSize: FontSize.tiny,
  },
});
