import Ionicons from '@/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import { questionsForPack } from '@/lib/simulations';
import { normalizeSearchText } from '@/lib/text';
import { useApp } from '@/providers/app-provider';
import { useQuestions } from '@/providers/questions-provider';

export default function ConcursoStudyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { answers, canViewStatistics } = useApp();
  const { questions: availableQuestions, packs } = useQuestions();
  const [query, setQuery] = useState('');

  const pack = packs.find((item) => item.id === id);
  const questions = useMemo(
    () => (pack ? questionsForPack(pack, availableQuestions) : []),
    [availableQuestions, pack],
  );
  const disciplines = useMemo(
    () =>
      (pack?.disciplines ?? []).map((name) => {
        const definition = DISCIPLINES.find((item) => item.name === name);
        const disciplineQuestions = questions.filter((question) => question.discipline === name);
        const answered = disciplineQuestions.filter((question) => answers[question.id]);
        const correct = answered.filter((question) => answers[question.id]?.isCorrect).length;

        return {
          name,
          icon: (definition?.icon ?? 'book-outline') as keyof typeof Ionicons.glyphMap,
          total: disciplineQuestions.length,
          answered: answered.length,
          accuracy: answered.length > 0 ? (correct / answered.length) * 100 : 0,
        };
      }),
    [answers, pack?.disciplines, questions]
  );
  const topics = useMemo(() => {
    const grouped = new Map<string, { discipline: string; topic: string; total: number }>();
    for (const question of questions) {
      const key = `${question.discipline}:${question.topic}`;
      const current = grouped.get(key);
      grouped.set(key, {
        discipline: question.discipline,
        topic: question.topic,
        total: (current?.total ?? 0) + 1,
      });
    }
    return Array.from(grouped.values()).sort(
      (a, b) =>
        a.discipline.localeCompare(b.discipline, 'pt-BR') ||
        a.topic.localeCompare(b.topic, 'pt-BR')
    );
  }, [questions]);
  const normalizedQuery = normalizeSearchText(query);
  const matchingTopics = normalizedQuery
    ? topics.filter((item) =>
        normalizeSearchText(`${item.discipline} ${item.topic}`).includes(normalizedQuery)
      )
    : [];

  if (!pack || questions.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Questões por concurso" onBack={() => router.back()} />
        <EmptyState
          icon="briefcase-outline"
          title={pack ? 'Questões em breve' : 'Concurso não encontrado'}
          description="Ainda não há questões disponíveis para este concurso."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const start = (discipline?: string, topic?: string) => {
    if (discipline && topic) {
      router.push({
        pathname: '/questoes/concurso/estudar',
        params: { id: pack.id, discipline, topic },
      });
      return;
    }
    router.push({ pathname: '/questoes/concurso/estudar', params: { id: pack.id } });
  };

  const openDiscipline = (discipline: string) => {
    router.push({
      pathname: '/questoes/concurso/materia',
      params: { id: pack.id, discipline },
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader
        title={pack.name}
        subtitle={`${questions.length} ${questions.length === 1 ? 'questão' : 'questões'} · ${disciplines.length} ${disciplines.length === 1 ? 'matéria' : 'matérias'}${pack.metadataMissing ? ' · metadados pendentes' : ''}`}
        leadingIcon={pack.icon as keyof typeof Ionicons.glyphMap}
        leadingIconColor={pack.color}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        {pack.metadataMissing ? (
          <View style={[styles.metadataNotice, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
            <Ionicons name="information-circle-outline" size={19} color={colors.warning} />
            <Text style={[styles.metadataNoticeText, { color: colors.textMuted }]}>
              Questões disponíveis. Edital, vagas e demais dados do concurso ainda não foram cadastrados.
            </Text>
          </View>
        ) : null}
        <Card
          onPress={() => start()}
          accessibilityLabel={`Resolver todas as questões de ${pack.name}`}
          style={[styles.generalCard, { borderColor: colors.borderStrong }]}>
          <View style={styles.generalHeader}>
            <Ionicons name="layers-outline" size={23} color={colors.primary} />
            <View style={styles.generalText}>
              <Text style={[styles.generalTitle, { color: colors.text }]}>Questões no geral</Text>
              <Text style={[styles.generalDescription, { color: colors.textMuted }]}>Misture todas as matérias deste concurso.</Text>
            </View>
            <Ionicons name="arrow-forward" size={19} color={colors.primary} />
          </View>
          <View style={[styles.generalMeta, { borderTopColor: colors.border }]}>
            <Text style={[styles.generalCount, { color: colors.primary }]}>{questions.length}</Text>
            <Text style={[styles.generalLabel, { color: colors.textMuted }]}>questões disponíveis</Text>
          </View>
        </Card>

        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar matéria ou assunto"
          accessibilityLabel={`Buscar matéria ou assunto de ${pack.name}`}
        />

        {normalizedQuery ? (
          <Section title="Resultados">
            {matchingTopics.length > 0 ? (
              <View style={styles.disciplineList}>
                {matchingTopics.map((item) => (
                  <Card
                    key={`${item.discipline}:${item.topic}`}
                    onPress={() => start(item.discipline, item.topic)}
                    accessibilityLabel={`Estudar ${item.topic}, matéria ${item.discipline}`}
                    style={styles.searchResultCard}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    <View style={styles.disciplineText}>
                      <Text style={[styles.disciplineName, { color: colors.text }]}>
                        {item.topic}
                      </Text>
                      <Text style={[styles.disciplineMeta, { color: colors.textMuted }]}>
                        {`${item.discipline} · ${item.total} ${item.total === 1 ? 'questão' : 'questões'}`}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                  </Card>
                ))}
              </View>
            ) : (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={20} color={colors.textSubtle} />
                <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
                  Nenhum assunto encontrado neste concurso.
                </Text>
              </View>
            )}
          </Section>
        ) : (
        <Section title="Estudar por matéria">
          <View style={styles.disciplineList}>
            {disciplines.map((discipline) => {
              const disabled = discipline.total === 0;
              return (
                <Card
                  key={discipline.name}
                  onPress={disabled ? undefined : () => openDiscipline(discipline.name)}
                  accessibilityLabel={`Ver assuntos de ${discipline.name} em ${pack.name}`}
                  style={[styles.disciplineCard, disabled && styles.disabled]}>
                  <View style={styles.disciplineIcon}>
                    <Ionicons name={discipline.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.disciplineText}>
                    <Text style={[styles.disciplineName, { color: colors.text }]}>
                      {discipline.name}
                    </Text>
                    <Text style={[styles.disciplineMeta, { color: colors.textMuted }]}>
                      {disabled
                        ? 'Questões em breve'
                        : `${discipline.total} ${discipline.total === 1 ? 'questão' : 'questões'}` +
                          (canViewStatistics && discipline.answered > 0
                            ? ` · ${formatPercent(discipline.accuracy)} de acerto`
                            : '')}
                    </Text>
                  </View>
                  <Badge
                    label={String(discipline.total)}
                    tone={disabled ? 'neutral' : 'accent'}
                  />
                  {!disabled ? (
                    <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                  ) : null}
                </Card>
              );
            })}
          </View>
        </Section>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  metadataNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
  },
  metadataNoticeText: { flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  generalCard: { gap: Spacing.md },
  generalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  generalText: { flex: 1, gap: 2 },
  generalTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  generalDescription: { fontSize: FontSize.small, lineHeight: 18 },
  generalMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  generalCount: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  generalLabel: { fontSize: FontSize.small },
  disciplineList: { gap: Spacing.sm },
  searchResultCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  disciplineCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  disciplineIcon: { width: 22, alignItems: 'center' },
  disciplineText: { flex: 1, gap: 3 },
  disciplineName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  disciplineMeta: { fontSize: FontSize.small },
  noResults: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  noResultsText: { fontSize: FontSize.small, textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
