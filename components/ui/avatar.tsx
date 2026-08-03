import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontWeight, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/format';

type AvatarProps = {
  name: string;
  uri?: string;
  size?: number;
  /** Exibe o selo de câmera e torna o avatar tocável. */
  onEdit?: () => void;
};

export function Avatar({ name, uri, size = 64, onEdit }: AvatarProps) {
  const { colors } = useTheme();

  const content = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={150}
      accessibilityIgnoresInvertColors
    />
  ) : (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primarySoft,
        },
      ]}>
      <Text style={[styles.initials, { color: colors.primary, fontSize: size * 0.34 }]}>
        {initials(name)}
      </Text>
    </View>
  );

  if (!onEdit) {
    return (
      <View accessibilityLabel={`Foto de ${name}`} accessible>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Alterar foto do perfil"
      style={({ pressed }) => [styles.wrapper, pressed && { opacity: 0.8 }]}>
      {content}
      <View
        style={[
          styles.editBadge,
          { backgroundColor: colors.primary, borderColor: colors.surface },
        ]}>
        <Ionicons name="camera" size={13} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: FontWeight.bold,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
