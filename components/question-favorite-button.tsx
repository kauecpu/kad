import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/providers/app-provider';

type QuestionFavoriteButtonProps = {
  questionId: string;
};

export function QuestionFavoriteButton({ questionId }: QuestionFavoriteButtonProps) {
  const { colors } = useTheme();
  const { favoriteQuestionIds, toggleFavoriteQuestion } = useApp();
  const isFavorite = favoriteQuestionIds.includes(questionId);

  return (
    <Pressable
      onPress={() => toggleFavoriteQuestion(questionId)}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? 'Remover questão dos favoritos' : 'Favoritar questão'}
      accessibilityState={{ selected: isFavorite }}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons
        name={isFavorite ? 'bookmark' : 'bookmark-outline'}
        size={21}
        color={isFavorite ? colors.primary : colors.textSubtle}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.55 },
});
