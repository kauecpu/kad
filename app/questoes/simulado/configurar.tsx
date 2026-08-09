import Ionicons from '@/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { DISCIPLINES } from '@/data/disciplines';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { QUESTIONS } from '@/data/questions';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_SIMULATION_CONFIG,
  questionsForPack,
  simulationCandidates,
} from '@/lib/simulations';
import { topicsForDisciplines } from '@/lib/search';
import { useApp } from '@/providers/app-provider';
import { useSimulation } from '@/providers/simulation-provider';
import type { Difficulty, SimulationConfig } from '@/types';

type SheetKey = 'pack' | 'disciplines' | 'topics' | 'boards' | 'years' | 'difficulties';

const DURATION_OPTIONS = [10, 20, 30, 45, 60];

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export default function ConfigureSimulationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { packId } = useLocalSearchParams<{ packId?: string }>();
  const { canUseSimulations } = useApp();
  const { session, startSimulation } = useSimulation();

  const initialPack = CONCURSO_PACKS.some((item) => item.id === packId) ? packId : undefined;
  const initialPackData = CONCURSO_PACKS.find((item) => item.id === initialPack);
  const initialQuestionTotal = initialPackData ? questionsForPack(initialPackData).length : 0;
  const [config, setConfig] = useState<SimulationConfig>({
    ...DEFAULT_SIMULATION_CONFIG,
    packId: initialPack,
    durationMinutes:
      initialPackData && initialQuestionTotal <= 5
        ? 10
        : DEFAULT_SIMULATION_CONFIG.durationMinutes,
  });
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  const candidates = useMemo(() => simulationCandidates(config), [config]);
  const availableTopics = useMemo(
    () => topicsForDisciplines(config.disciplines),
    [config.disciplines]
  );
  const pack = CONCURSO_PACKS.find((item) => item.id === config.packId);
  const questionCountOptions = useMemo(() => {
    if (candidates.length === 0) return [];
    return Array.from(
      new Set([5, 10, 20, 30, candidates.length].filter((value) => value <= candidates.length))
    ).sort((a, b) => a - b);
  }, [candidates.length]);

  const update = (patch: Partial<SimulationConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const selectedCount = Math.min(config.questionCount, candidates.length);
  const estimatedMinutes = Math.max(1, Math.round(config.durationMinutes / Math.max(1, selectedCount)));

  const start = () => {
    if (!canUseSimulations) {
      router.push('/perfil/planos');
      return;
    }
    if (candidates.length === 0) return;

    const create = () => {
      const next = startSimulation({
        ...config,
        questionCount: selectedCount,
      });
      if (next) router.replace('/questoes/simulado');
    };

    if (session && session.status !== 'completed') {
      Alert.alert(
        'Substituir simulado salvo?',
        'Você já possui um simulado em andamento. Ao iniciar outro, o progresso atual será perdido.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Iniciar novo', style: 'destructive', onPress: create },
        ]
      );
      return;
    }

    create();
  };

  const sheetConfig = sheet
    ? {
        pack: {
          title: 'Concurso ou área',
          options: ['Todos os concursos e áreas', ...CONCURSO_PACKS.map((item) => item.name)],
          selected: [pack?.name ?? 'Todos os concursos e áreas'],
          onChange: (selected: string[]) => {
            const selectedPack = CONCURSO_PACKS.find((item) => item.name === selected[0]);
            update({ packId: selectedPack?.id });
          },
          single: true,
        },
        disciplines: {
          title: 'Disciplina',
          options: DISCIPLINES.map((item) => item.name),
          selected: config.disciplines,
          onChange: (selected: string[]) => {
            const allowedTopics = topicsForDisciplines(selected);
            update({
              disciplines: selected,
              topics: config.topics.filter((topic) => allowedTopics.includes(topic)),
            });
          },
          single: false,
        },
        topics: {
          title: 'Assunto',
          options: availableTopics,
          selected: config.topics,
          onChange: (selected: string[]) => update({ topics: selected }),
          single: false,
        },
        boards: {
          title: 'Banca',
          options: unique(QUESTIONS.map((item) => item.board)),
          selected: config.boards,
          onChange: (selected: string[]) => update({ boards: selected }),
          single: false,
        },
        years: {
          title: 'Ano',
          options: Array.from(new Set(QUESTIONS.map((item) => item.year)))
            .sort((a, b) => b - a)
            .map(String),
          selected: config.years.map(String),
          onChange: (selected: string[]) => update({ years: selected.map(Number) }),
          single: false,
        },
        difficulties: {
          title: 'Dificuldade',
          options: ['Fácil', 'Média', 'Difícil'],
          selected: config.difficulties,
          onChange: (selected: string[]) =>
            update({ difficulties: selected as Difficulty[] }),
          single: false,
        },
      }[sheet]
    : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Montar simulado" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="options-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={[styles.introTitle, { color: colors.text }]}>
              Crie uma prova do seu jeito
            </Text>
            <Text style={[styles.introDescription, { color: colors.textMuted }]}>
              Combine concurso ou área, banca, ano, disciplina, assunto e dificuldade.
            </Text>
          </View>
        </View>

        <FilterSection title="Conteúdo da prova">
          <Card padded={false} style={styles.filterCard}>
            <FilterRow
              icon="briefcase-outline"
              label="Concurso ou área"
              value={pack?.name ?? 'Todos os concursos e áreas'}
              onPress={() => setSheet('pack')}
            />
            <FilterRow
              icon="library-outline"
              label="Disciplina"
              value={summary(config.disciplines)}
              onPress={() => setSheet('disciplines')}
            />
            <FilterRow
              icon="bookmark-outline"
              label="Assunto"
              value={summary(config.topics)}
              onPress={() => setSheet('topics')}
            />
            <FilterRow
              icon="business-outline"
              label="Banca"
              value={summary(config.boards)}
              onPress={() => setSheet('boards')}
            />
            <FilterRow
              icon="calendar-outline"
              label="Ano"
              value={summary(config.years.map(String))}
              onPress={() => setSheet('years')}
            />
            <FilterRow
              icon="speedometer-outline"
              label="Dificuldade"
              value={summary(config.difficulties)}
              onPress={() => setSheet('difficulties')}
              isLast
            />
          </Card>
        </FilterSection>

        <FilterSection title="Número de questões">
          {questionCountOptions.length > 0 ? (
            <View style={styles.chips}>
              {questionCountOptions.map((count) => (
                <Chip
                  key={count}
                  label={count === candidates.length ? `${count} · Todas` : String(count)}
                  selected={selectedCount === count}
                  onPress={() => update({ questionCount: count })}
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.noResults, { color: colors.danger }]}>
              Nenhuma questão corresponde aos filtros selecionados.
            </Text>
          )}
        </FilterSection>

        <FilterSection title="Tempo de prova">
          <View style={styles.chips}>
            {DURATION_OPTIONS.map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes} min`}
                selected={config.durationMinutes === minutes}
                onPress={() => update({ durationMinutes: minutes })}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection title="Randomização">
          <Card padded={false}>
            <SwitchRow
              label="Embaralhar questões"
              description="Altera a ordem das questões a cada novo simulado."
              value={config.shuffleQuestions}
              onChange={(shuffleQuestions) => update({ shuffleQuestions })}
            />
            <SwitchRow
              label="Embaralhar alternativas"
              description="Exibe as alternativas em uma nova ordem."
              value={config.shuffleAlternatives}
              onChange={(shuffleAlternatives) => update({ shuffleAlternatives })}
              isLast
            />
          </Card>
        </FilterSection>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="document-text-outline" size={21} color={colors.primary} />
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Resumo do simulado</Text>
          </View>
          <View style={styles.summaryStats}>
            <SummaryItem label="Questões" value={String(selectedCount)} />
            <SummaryItem label="Tempo" value={`${config.durationMinutes} min`} />
            <SummaryItem label="Ritmo" value={`${estimatedMinutes} min/q.`} />
          </View>
          <Text style={[styles.available, { color: colors.textSubtle }]}>
            {`${candidates.length} ${candidates.length === 1 ? 'questão disponível' : 'questões disponíveis'} com os filtros atuais`}
          </Text>
        </Card>

        <Button
          label={
            canUseSimulations
              ? `Iniciar simulado · ${selectedCount} questões`
              : 'Disponível nos planos KAD'
          }
          icon={canUseSimulations ? 'play' : 'lock-closed-outline'}
          size="lg"
          onPress={start}
          disabled={candidates.length === 0}
          fullWidth
        />
        {!canUseSimulations ? (
          <Text style={[styles.planHint, { color: colors.textSubtle }]}>
            Toque para conhecer os planos e liberar simulados.
          </Text>
        ) : null}
      </ScrollView>

      <MultiSelectSheet
        visible={sheet !== null}
        title={sheetConfig?.title ?? ''}
        options={sheetConfig?.options ?? []}
        selected={sheetConfig?.selected ?? []}
        onChange={(selected) => sheetConfig?.onChange(selected)}
        onClose={() => setSheet(null)}
        selectionMode={sheetConfig?.single ? 'single' : 'multiple'}
      />
    </View>
  );
}

function summary(values: string[]): string {
  if (values.length === 0) return 'Todos';
  if (values.length === 1) return values[0];
  return `${values.length} selecionados`;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <View style={[styles.sectionMarker, { backgroundColor: colors.primary }]} />
      </View>
      {children}
    </View>
  );
}

function FilterRow({
  icon,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.filterRow,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { opacity: 0.65 },
      ]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function SwitchRow({
  label,
  description,
  value,
  onChange,
  isLast,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.switchRow,
        !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.switchText}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.switchDescription, { color: colors.textMuted }]}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.summaryItem}>
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
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  introIcon: {
    width: 24,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1, gap: 3 },
  introTitle: {
    fontSize: FontSize.heading + 1,
    fontWeight: FontWeight.bold,
  },
  introDescription: { fontSize: FontSize.small, lineHeight: 19 },
  section: { gap: Spacing.sm },
  sectionHeading: { gap: 4 },
  sectionMarker: { width: 28, height: 2, borderRadius: Radius.pill },
  sectionTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.semibold,
  },
  filterCard: { overflow: 'hidden' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  rowIcon: {
    width: 22,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  rowValue: { fontSize: FontSize.small },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  noResults: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  switchText: { flex: 1, gap: 3 },
  switchLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  switchDescription: { fontSize: FontSize.small, lineHeight: 18 },
  summaryCard: { gap: Spacing.md },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryTitle: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  summaryStats: { flexDirection: 'row', gap: Spacing.sm },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  summaryLabel: { fontSize: FontSize.tiny },
  available: { fontSize: FontSize.tiny, textAlign: 'center' },
  planHint: {
    marginTop: -Spacing.lg,
    fontSize: FontSize.tiny,
    textAlign: 'center',
  },
});
