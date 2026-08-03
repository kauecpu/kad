import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { SearchField } from '@/components/ui/search-field';
import { Section } from '@/components/ui/section';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { ESSAY_TOPICS, type EssayTopic } from '@/data/essay-topics';
import { useTheme } from '@/hooks/use-theme';
import { recommendPackForGoal } from '@/lib/simulations';
import { normalizeSearchText } from '@/lib/text';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';

type EssayStage = 'topics' | 'editor' | 'submitted';

const DRAFT_PREFIX = '@kad/essay-draft/';

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function EssayScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useApp();
  const { user } = useAuth();
  const draftOwnerId = user?.id ?? 'guest';
  const editorRef = useRef<TextInput>(null);
  const [stage, setStage] = useState<EssayStage>('topics');
  const [selectedTopic, setSelectedTopic] = useState<EssayTopic | null>(null);
  const [selectedPackId, setSelectedPackId] = useState('all');
  const [query, setQuery] = useState('');
  const [essay, setEssay] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const recommendedPack = useMemo(
    () => recommendPackForGoal(CONCURSO_PACKS, profile.targetRole),
    [profile.targetRole]
  );
  const recommendedTopic = ESSAY_TOPICS.find((topic) => topic.packId === recommendedPack?.id);

  const visibleTopics = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    return ESSAY_TOPICS.filter((topic) => {
      if (selectedPackId !== 'all' && topic.packId !== selectedPackId) return false;
      if (!normalizedQuery) return true;
      const pack = CONCURSO_PACKS.find((item) => item.id === topic.packId);
      return normalizeSearchText(
        `${topic.title} ${topic.category} ${pack?.name ?? ''}`
      ).includes(normalizedQuery);
    });
  }, [query, selectedPackId]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (!selectedTopic) return;
    let active = true;
    setDraftLoaded(false);
    const draftKey = `${DRAFT_PREFIX}${draftOwnerId}/${selectedTopic.id}`;
    Promise.all([
      AsyncStorage.getItem(draftKey),
      draftOwnerId === 'guest'
        ? AsyncStorage.getItem(`${DRAFT_PREFIX}${selectedTopic.id}`)
        : Promise.resolve(null),
    ])
      .then(([draft, legacyDraft]) => {
        if (active) setEssay(draft ?? '');
        if (active && !draft && legacyDraft) setEssay(legacyDraft);
      })
      .catch(() => {
        if (active) setEssay('');
      })
      .finally(() => {
        if (active) setDraftLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [draftOwnerId, selectedTopic]);

  useEffect(() => {
    if (!selectedTopic || !draftLoaded) return;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(
        `${DRAFT_PREFIX}${draftOwnerId}/${selectedTopic.id}`,
        essay
      ).catch(() => {});
    }, 350);
    return () => clearTimeout(timeout);
  }, [draftLoaded, draftOwnerId, essay, selectedTopic]);

  const selectTopic = (topic: EssayTopic) => {
    setSelectedTopic(topic);
    setEssay('');
    setElapsedSeconds(0);
    setTimerRunning(false);
    setStage('editor');
  };

  const goBack = () => {
    if (stage === 'submitted') {
      setStage('editor');
      return;
    }
    if (stage === 'editor') {
      setStage('topics');
      setTimerRunning(false);
      return;
    }
    router.back();
  };

  const submit = () => {
    if (countWords(essay) < 20) return;
    setTimerRunning(false);
    setStage('submitted');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader
        title="Redação"
        subtitle={stage === 'topics' ? 'Pratique no formato dos concursos' : selectedTopic?.title}
        onBack={goBack}
      />

      {stage === 'topics' ? (
        <TopicSelection
          query={query}
          onChangeQuery={setQuery}
          selectedPackId={selectedPackId}
          onChangePack={setSelectedPackId}
          topics={visibleTopics}
          recommendedTopic={recommendedTopic}
          onSelectTopic={selectTopic}
          bottomInset={insets.bottom}
        />
      ) : null}

      {stage === 'editor' && selectedTopic ? (
        <EssayEditor
          topic={selectedTopic}
          essay={essay}
          onChangeEssay={setEssay}
          elapsedSeconds={elapsedSeconds}
          timerRunning={timerRunning}
          onToggleTimer={() => setTimerRunning((current) => !current)}
          onResetTimer={() => {
            setElapsedSeconds(0);
            setTimerRunning(false);
          }}
          editorRef={editorRef}
          onSubmit={submit}
          bottomInset={insets.bottom}
        />
      ) : null}

      {stage === 'submitted' && selectedTopic ? (
        <SubmittedState
          topic={selectedTopic}
          wordCount={countWords(essay)}
          elapsedSeconds={elapsedSeconds}
          onEdit={() => setStage('editor')}
          onChooseAnother={() => {
            setStage('topics');
            setSelectedTopic(null);
          }}
          bottomInset={insets.bottom}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function TopicSelection({
  query,
  onChangeQuery,
  selectedPackId,
  onChangePack,
  topics,
  recommendedTopic,
  onSelectTopic,
  bottomInset,
}: {
  query: string;
  onChangeQuery: (value: string) => void;
  selectedPackId: string;
  onChangePack: (value: string) => void;
  topics: EssayTopic[];
  recommendedTopic?: EssayTopic;
  onSelectTopic: (topic: EssayTopic) => void;
  bottomInset: number;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.xxxl }]}
      showsVerticalScrollIndicator={false}>
      <EssaySteps active={1} />

      {recommendedTopic && selectedPackId === 'all' && !query ? (
        <Section title="Para sua meta">
          <TopicCard topic={recommendedTopic} featured onPress={() => onSelectTopic(recommendedTopic)} />
        </Section>
      ) : null}

      <Section title="Escolha uma proposta">
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder="Buscar tema ou concurso"
          accessibilityLabel="Buscar tema de redação ou concurso"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}>
          <Chip label="Todos" selected={selectedPackId === 'all'} onPress={() => onChangePack('all')} />
          {CONCURSO_PACKS.map((pack) => (
            <Chip
              key={pack.id}
              label={pack.name}
              selected={selectedPackId === pack.id}
              onPress={() => onChangePack(pack.id)}
            />
          ))}
        </ScrollView>
      </Section>

      <View style={styles.topicList}>
        {topics
          .filter((topic) => topic.id !== recommendedTopic?.id || selectedPackId !== 'all' || query)
          .map((topic) => (
            <TopicCard key={topic.id} topic={topic} onPress={() => onSelectTopic(topic)} />
          ))}
      </View>

      {topics.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={28} color={colors.textSubtle} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma proposta encontrada</Text>
          <Text style={[styles.emptyDescription, { color: colors.textMuted }]}>Tente outro concurso ou termo de busca.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function TopicCard({
  topic,
  featured,
  onPress,
}: {
  topic: EssayTopic;
  featured?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const pack = CONCURSO_PACKS.find((item) => item.id === topic.packId);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Selecionar tema: ${topic.title}`}
      style={[styles.topicCard, featured && { borderColor: colors.borderStrong }]}>
      <View style={styles.topicHeader}>
        <View style={styles.topicIcon}>
          <Ionicons
            name={(pack?.icon as keyof typeof Ionicons.glyphMap) ?? 'document-text-outline'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.topicHeaderText}>
          <Text style={[styles.topicPack, { color: colors.textMuted }]}>{pack?.name ?? 'Concurso'}</Text>
          <Text style={[styles.topicCategory, { color: colors.textMuted }]}>{topic.category}</Text>
        </View>
        {featured ? <Badge label="Recomendado" tone="accent" /> : null}
      </View>
      <Text style={[styles.topicTitle, { color: colors.text }]}>{topic.title}</Text>
      <View style={styles.topicMeta}>
        <Meta icon="speedometer-outline" label={topic.difficulty} />
        <Meta icon="timer-outline" label={`${topic.suggestedMinutes} min`} />
        <Meta icon="reorder-three-outline" label={topic.lineRange} />
      </View>
      <View style={styles.topicAction}>
        <Text style={[styles.topicActionText, { color: colors.primary }]}>Abrir proposta</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.primary} />
      </View>
    </Card>
  );
}

function EssayEditor({
  topic,
  essay,
  onChangeEssay,
  elapsedSeconds,
  timerRunning,
  onToggleTimer,
  onResetTimer,
  editorRef,
  onSubmit,
  bottomInset,
}: {
  topic: EssayTopic;
  essay: string;
  onChangeEssay: (value: string) => void;
  elapsedSeconds: number;
  timerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  editorRef: React.RefObject<TextInput | null>;
  onSubmit: () => void;
  bottomInset: number;
}) {
  const { colors } = useTheme();
  const pack = CONCURSO_PACKS.find((item) => item.id === topic.packId);
  const wordCount = countWords(essay);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.xxxl }]}
      showsVerticalScrollIndicator={false}>
      <EssaySteps active={2} />

      <Card style={styles.proposalCard}>
        <View style={styles.proposalTop}>
          <Badge label={pack?.name ?? 'Concurso'} tone="neutral" />
          <Badge label={topic.difficulty} tone="accent" />
        </View>
        <Text style={[styles.proposalTitle, { color: colors.text }]}>{topic.title}</Text>
        <Text style={[styles.proposalContext, { color: colors.textMuted }]}>{topic.context}</Text>
        <View style={[styles.commandBox, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.commandLabel, { color: colors.primary }]}>Proposta</Text>
          <Text style={[styles.commandText, { color: colors.text }]}>{topic.command}</Text>
        </View>
      </Card>

      <Card style={styles.timerCard}>
        <View style={styles.timerInfo}>
          <Ionicons name="timer-outline" size={21} color={colors.primary} />
          <View>
            <Text style={[styles.timerLabel, { color: colors.textMuted }]}>Cronômetro</Text>
            <Text style={[styles.timerValue, { color: colors.text }]}>{formatTimer(elapsedSeconds)}</Text>
          </View>
        </View>
        <View style={styles.timerActions}>
          <Pressable
            onPress={onToggleTimer}
            accessibilityRole="button"
            accessibilityLabel={timerRunning ? 'Pausar cronômetro' : 'Iniciar cronômetro'}
            style={[styles.timerButton, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name={timerRunning ? 'pause' : 'play'} size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={onResetTimer}
            accessibilityRole="button"
            accessibilityLabel="Zerar cronômetro"
            style={[styles.timerButton, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </Card>

      <Section title="Sua redação">
        <View style={[styles.editorContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            ref={editorRef}
            value={essay}
            onChangeText={onChangeEssay}
            placeholder="Comece a escrever sua redação aqui..."
            placeholderTextColor={colors.textSubtle}
            multiline
            textAlignVertical="top"
            autoCapitalize="sentences"
            accessibilityLabel="Texto da redação"
            style={[styles.editor, { color: colors.text }]}
          />
          <View style={[styles.editorFooter, { borderTopColor: colors.border }]}>
            <View style={styles.savedRow}>
              <Ionicons name="cloud-done-outline" size={15} color={colors.success} />
              <Text style={[styles.savedText, { color: colors.textSubtle }]}>Rascunho salvo neste aparelho</Text>
            </View>
            <Text style={[styles.wordCount, { color: wordCount >= 20 ? colors.primary : colors.textSubtle }]}>
              {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
            </Text>
          </View>
        </View>
        <Text style={[styles.editorHint, { color: colors.textSubtle }]}>Referência da proposta: {topic.lineRange}. Para concluir a prática, escreva ao menos 20 palavras.</Text>
      </Section>

      <Button
        label="Concluir prática"
        icon="checkmark-done-outline"
        size="lg"
        onPress={onSubmit}
        disabled={wordCount < 20}
        fullWidth
      />
    </ScrollView>
  );
}

function SubmittedState({
  topic,
  wordCount,
  elapsedSeconds,
  onEdit,
  onChooseAnother,
  bottomInset,
}: {
  topic: EssayTopic;
  wordCount: number;
  elapsedSeconds: number;
  onEdit: () => void;
  onChooseAnother: () => void;
  bottomInset: number;
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + Spacing.xxxl }]}
      showsVerticalScrollIndicator={false}>
      <EssaySteps active={3} />

      <View style={styles.submittedHero}>
        <View style={styles.submittedIcon}>
          <Ionicons name="checkmark-circle" size={34} color={colors.success} />
        </View>
        <Text style={[styles.submittedTitle, { color: colors.text }]}>Prática concluída</Text>
        <Text style={[styles.submittedDescription, { color: colors.textMuted }]}>Seu texto continua salvo neste aparelho.</Text>
      </View>

      <Card style={styles.submissionSummary}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>{topic.title}</Text>
        <View style={styles.summaryStats}>
          <SummaryStat value={String(wordCount)} label="Palavras" />
          <SummaryStat value={formatTimer(elapsedSeconds)} label="Tempo" />
          <SummaryStat value={topic.difficulty} label="Nível" />
        </View>
      </Card>

      <Card
        style={[
          styles.integrationNotice,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <Ionicons name="time-outline" size={22} color={colors.textMuted} />
        <View style={styles.integrationText}>
          <Text style={[styles.integrationTitle, { color: colors.text }]}>Correção automática ainda não disponível</Text>
          <Text style={[styles.integrationDescription, { color: colors.textMuted }]}>Use os critérios abaixo como roteiro para revisar seu próprio texto.</Text>
        </View>
      </Card>

      <Section title="Roteiro de revisão">
        <Card padded={false} style={styles.criteriaCard}>
          {topic.criteria.map((criterion, index) => (
            <View
              key={criterion}
              style={[
                styles.criterionRow,
                index < topic.criteria.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <View style={styles.criterionIcon}>
                <Ionicons name="checkmark-circle-outline" size={17} color={colors.textSubtle} />
              </View>
              <Text style={[styles.criterionName, { color: colors.text }]}>{criterion}</Text>
              <Text style={[styles.criterionStatus, { color: colors.textSubtle }]}>Revise</Text>
            </View>
          ))}
        </Card>
      </Section>

      <Button label="Voltar ao texto" variant="secondary" icon="create-outline" onPress={onEdit} fullWidth />
      <Button label="Escolher outro tema" variant="ghost" icon="documents-outline" onPress={onChooseAnother} fullWidth />
    </ScrollView>
  );
}

function EssaySteps({ active }: { active: 1 | 2 | 3 }) {
  const { colors } = useTheme();
  const steps = ['Tema', 'Redação', 'Revisão'];
  return (
    <View style={styles.steps} accessibilityLabel={`Etapa ${active} de 3: ${steps[active - 1]}`}>
      {steps.map((label, index) => {
        const number = index + 1;
        const reached = number <= active;
        return (
          <View key={label} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                { backgroundColor: reached ? colors.primary : colors.surfaceAlt },
              ]}>
              {number < active ? (
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              ) : (
                <Text style={[styles.stepNumber, { color: reached ? colors.onPrimary : colors.textSubtle }]}>{number}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, { color: reached ? colors.primary : colors.textSubtle }]}>{label}</Text>
            {number < steps.length ? <View style={[styles.stepLine, { backgroundColor: number < active ? colors.primary : colors.border }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={colors.textSubtle} />
      <Text style={[styles.metaText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textSubtle }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold },
  stepLabel: { marginLeft: 5, fontSize: FontSize.tiny, fontWeight: FontWeight.semibold },
  stepLine: { width: 28, height: 1, marginHorizontal: Spacing.sm },
  filterChips: { gap: Spacing.sm, paddingRight: Spacing.md },
  topicList: { gap: Spacing.md },
  topicCard: { gap: Spacing.sm },
  topicHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  topicIcon: {
    width: 22,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicHeaderText: { flex: 1, gap: 1 },
  topicPack: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  topicCategory: { fontSize: FontSize.tiny },
  topicTitle: {
    fontSize: FontSize.heading + 1,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
  },
  topicMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.tiny },
  topicAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  topicActionText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  emptyState: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xxl },
  emptyTitle: { marginTop: Spacing.xs, fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  emptyDescription: { fontSize: FontSize.small, textAlign: 'center' },
  proposalCard: { gap: Spacing.md },
  proposalTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  proposalTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: 27,
  },
  proposalContext: { fontSize: FontSize.body, lineHeight: 21 },
  commandBox: { gap: Spacing.xs, paddingVertical: Spacing.xs, paddingLeft: Spacing.md, borderLeftWidth: 2 },
  commandLabel: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  commandText: { fontSize: FontSize.body, lineHeight: 21, fontWeight: FontWeight.medium },
  timerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timerLabel: { fontSize: FontSize.tiny },
  timerValue: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  timerActions: { flexDirection: 'row', gap: Spacing.sm },
  timerButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorContainer: { overflow: 'hidden', borderWidth: 1, borderRadius: Radius.lg },
  editor: { minHeight: 310, padding: Spacing.lg, fontSize: FontSize.body, lineHeight: 24 },
  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  savedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  savedText: { fontSize: FontSize.tiny },
  wordCount: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold },
  editorHint: { fontSize: FontSize.tiny, lineHeight: 17 },
  submittedHero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  submittedIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submittedTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  submittedDescription: { maxWidth: 480, fontSize: FontSize.body, lineHeight: 21, textAlign: 'center' },
  submissionSummary: { gap: Spacing.md },
  summaryTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  summaryStats: { flexDirection: 'row', gap: Spacing.sm },
  summaryStat: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  summaryLabel: { fontSize: FontSize.tiny },
  integrationNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  integrationText: { flex: 1, gap: 3 },
  integrationTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  integrationDescription: { fontSize: FontSize.small, lineHeight: 19 },
  criteriaCard: { overflow: 'hidden' },
  criterionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  criterionIcon: {
    width: 20,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  criterionName: { flex: 1, fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  criterionStatus: { fontSize: FontSize.tiny },
});
