import Ionicons from '@/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { useApp } from '@/providers/app-provider';
import { useQuestions } from '@/providers/questions-provider';

type TopicStat = {
  topic: string;
  total: number;
  answered: number;
  correct: number;
};

export default function TopicListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { discipline } = useLocalSearchParams<{ discipline: string }>();
  const { answers, canViewStatistics } = useApp();
  const { questions: availableQuestions } = useQuestions();

  const definition = DISCIPLINES.find((d) => d.name === discipline);
  const disciplineQuestions = useMemo(
    () => availableQuestions.filter((question) => question.discipline === discipline),
    [availableQuestions, discipline],
  );

  const topics = useMemo<TopicStat[]>(() => {
    const topicNames = Array.from(new Set(disciplineQuestions.map((question) => question.topic)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return topicNames.map((topic) => {
      const questions = disciplineQuestions.filter((q) => q.topic === topic);
      const answered = questions.filter((q) => answers[q.id]);
      const correct = answered.filter((q) => answers[q.id]?.isCorrect).length;
      return { topic, total: questions.length, answered: answered.length, correct };
    });
  }, [answers, disciplineQuestions]);

  if (!discipline || disciplineQuestions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Assuntos" onBack={() => router.back()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Disciplina não encontrada"
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const totalQuestions = topics.reduce((sum, t) => sum + t.total, 0);

  const renderItem = ({ item }: { item: TopicStat }) => {
    const disabled = item.total === 0;
    const accuracy = item.answered > 0 ? (item.correct / item.answered) * 100 : 0;

    return (
      <Card
        onPress={
          disabled
            ? undefined
            : () =>
                router.push({
                  pathname: '/questoes/[discipline]/[topic]',
                  params: { discipline, topic: item.topic },
                })
        }
        accessibilityLabel={`Estudar ${item.topic}`}
        style={[styles.card, disabled && { opacity: 0.55 }]}>
        <View style={styles.body}>
          <Text style={[styles.topicName, { color: colors.text }]}>{item.topic}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {disabled
              ? 'Nenhuma questão ainda'
              : `${item.total} ${item.total === 1 ? 'questão' : 'questões'}` +
                (canViewStatistics && item.answered > 0
                  ? ` · ${item.answered} respondida${item.answered === 1 ? '' : 's'} · ${formatPercent(accuracy)}`
                  : '')}
          </Text>
        </View>

        <View
          style={[
            styles.countPill,
            { backgroundColor: disabled ? colors.surfaceAlt : colors.primarySoft },
          ]}>
          <Text style={[styles.countText, { color: disabled ? colors.textSubtle : colors.primary }]}>
            {item.total}
          </Text>
        </View>

        {!disabled ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        ) : null}
      </Card>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={discipline}
        subtitle={`${topics.length} assuntos · ${totalQuestions} ${totalQuestions === 1 ? 'questão' : 'questões'}`}
        leadingIcon={(definition?.icon ?? 'book-outline') as keyof typeof Ionicons.glyphMap}
        leadingIconColor={definition?.color ?? colors.primary}
        onBack={() => router.back()}
      />

      <FlatList
        data={topics}
        keyExtractor={(item) => item.topic}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Card
              onPress={
                totalQuestions > 0
                  ? () =>
                      router.push({
                        pathname: '/questoes/[discipline]/[topic]',
                        params: { discipline, topic: 'geral' },
                      })
                  : undefined
              }
              accessibilityLabel={`Resolver todas as questões de ${discipline}`}
              style={[
                styles.generalCard,
                { borderColor: colors.borderStrong },
                totalQuestions === 0 && styles.disabled,
              ]}>
              <Ionicons name="layers-outline" size={21} color={colors.primary} />
              <View style={styles.generalText}>
                <Text style={[styles.generalTitle, { color: colors.text }]}>Todas de {discipline}</Text>
                <Text style={[styles.generalDescription, { color: colors.textMuted }]}>Misture todos os assuntos desta disciplina.</Text>
              </View>
              <Text style={[styles.generalCount, { color: colors.primary }]}>{totalQuestions}</Text>
              {totalQuestions > 0 ? (
                <Ionicons name="arrow-forward" size={18} color={colors.primary} />
              ) : null}
            </Card>

            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Escolha um assunto</Text>
              <View style={[styles.sectionMarker, { backgroundColor: colors.primary }]} />
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  listHeader: { gap: Spacing.xl, marginBottom: Spacing.md },
  sectionHeading: { gap: 4 },
  sectionMarker: { width: 28, height: 2, borderRadius: Radius.pill },
  generalCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  generalText: { flex: 1, gap: 2 },
  generalTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  generalDescription: { fontSize: FontSize.small, lineHeight: 18 },
  generalCount: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  disabled: { opacity: 0.55 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  topicName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  meta: {
    fontSize: FontSize.small,
    lineHeight: 17,
  },
  countPill: {
    minWidth: 30,
    height: 26,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.bold,
  },
});
