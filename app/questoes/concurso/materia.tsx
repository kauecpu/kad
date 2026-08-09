import Ionicons from '@/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { questionsForPack } from '@/lib/simulations';
import { useApp } from '@/providers/app-provider';

export default function ConcursoDisciplineScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, discipline } = useLocalSearchParams<{ id: string; discipline: string }>();
  const { answers, canViewStatistics } = useApp();

  const pack = CONCURSO_PACKS.find((item) => item.id === id);
  const definition = DISCIPLINES.find((item) => item.name === discipline);
  const questions = useMemo(
    () =>
      pack
        ? questionsForPack(pack).filter((question) => question.discipline === discipline)
        : [],
    [discipline, pack]
  );
  const topics = useMemo(() => {
    const names = Array.from(new Set(questions.map((question) => question.topic)));
    return names
      .map((topic) => {
        const topicQuestions = questions.filter((question) => question.topic === topic);
        const answered = topicQuestions.filter((question) => answers[question.id]);
        const correct = answered.filter((question) => answers[question.id]?.isCorrect).length;
        return {
          topic,
          total: topicQuestions.length,
          answered: answered.length,
          accuracy: answered.length > 0 ? (correct / answered.length) * 100 : 0,
        };
      })
      .sort((a, b) => a.topic.localeCompare(b.topic, 'pt-BR'));
  }, [answers, questions]);

  if (!pack || !discipline || questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title={discipline ?? 'Matéria'} onBack={() => router.back()} />
        <EmptyState
          icon="book-outline"
          title="Assuntos em breve"
          description="Ainda não há questões disponíveis para esta matéria neste concurso."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const start = (topic?: string) => {
    router.push({
      pathname: '/questoes/concurso/estudar',
      params: topic
        ? { id: pack.id, discipline, topic }
        : { id: pack.id, discipline },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={discipline}
        subtitle={`${pack.name} · ${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}`}
        leadingIcon={(definition?.icon ?? 'book-outline') as keyof typeof Ionicons.glyphMap}
        leadingIconColor={definition?.color ?? colors.primary}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Card
          onPress={() => start()}
          accessibilityLabel={`Resolver todas as questões de ${discipline} em ${pack.name}`}
          style={[styles.allCard, { borderColor: colors.borderStrong }]}>
          <Ionicons name="layers-outline" size={22} color={colors.primary} />
          <View style={styles.allText}>
            <Text style={[styles.allTitle, { color: colors.text }]}>Todas de {discipline}</Text>
            <Text style={[styles.allDescription, { color: colors.textMuted }]}>
              Misture os assuntos desta matéria.
            </Text>
          </View>
          <Text style={[styles.allCount, { color: colors.primary }]}>{questions.length}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </Card>

        <Section title="Escolha um assunto">
          <View style={styles.topicList}>
            {topics.map((item) => (
              <Card
                key={item.topic}
                onPress={() => start(item.topic)}
                accessibilityLabel={`Estudar ${item.topic}`}
                style={styles.topicCard}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <View style={styles.topicText}>
                  <Text style={[styles.topicName, { color: colors.text }]}>{item.topic}</Text>
                  <Text style={[styles.topicMeta, { color: colors.textMuted }]}>
                    {`${item.total} ${item.total === 1 ? 'questão' : 'questões'}` +
                      (canViewStatistics && item.answered > 0
                        ? ` · ${formatPercent(item.accuracy)} de acerto`
                        : '')}
                  </Text>
                </View>
                <Badge label={String(item.total)} tone="accent" />
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Card>
            ))}
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  allCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  allText: { flex: 1, gap: 2 },
  allTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  allDescription: { fontSize: FontSize.small },
  allCount: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  topicList: { gap: Spacing.sm },
  topicCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  topicText: { flex: 1, gap: 3 },
  topicName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  topicMeta: { fontSize: FontSize.small },
});
