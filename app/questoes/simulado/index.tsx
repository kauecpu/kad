import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SimulationQuestionCard } from '@/components/simulation-question-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { triggerHapticFeedback } from '@/lib/haptics';
import { simulationQuestionById } from '@/lib/simulations';
import { useApp } from '@/providers/app-provider';
import { useSimulation } from '@/providers/simulation-provider';
import { useQuestions } from '@/providers/questions-provider';

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export default function SimulationPlayerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canUseSimulations, subscriptionLoading } = useApp();
  const { questions } = useQuestions();
  const scrollRef = useRef<ScrollView>(null);
  const resumeHandled = useRef(false);
  const {
    session,
    answerQuestion,
    goToQuestion,
    tick,
    pauseSimulation,
    resumeSimulation,
    finishSimulation,
  } = useSimulation();

  useEffect(() => {
    if (!subscriptionLoading && !canUseSimulations) {
      router.replace('/perfil/planos');
    }
  }, [canUseSimulations, router, subscriptionLoading]);

  useEffect(() => {
    if (!canUseSimulations || !session || resumeHandled.current) return;
    resumeHandled.current = true;
    if (session.status === 'paused') resumeSimulation();
  }, [canUseSimulations, resumeSimulation, session]);

  useEffect(() => {
    if (!canUseSimulations || session?.status !== 'active') return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [canUseSimulations, session?.status, tick]);

  useEffect(() => () => pauseSimulation(), [pauseSimulation]);

  useEffect(() => {
    if (canUseSimulations && session?.status === 'completed') {
      router.replace('/questoes/simulado/resultado');
    }
  }, [canUseSimulations, router, session?.status]);

  const currentItem = session?.questions[session.currentIndex];
  const currentQuestion = currentItem
    ? simulationQuestionById(currentItem.questionId, questions)
    : undefined;
  const answeredCount = session ? Object.keys(session.answers).length : 0;
  const progress = session ? (answeredCount / session.questions.length) * 100 : 0;

  const goTo = (index: number) => {
    goToQuestion(index);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const saveAndExit = () => {
    pauseSimulation();
    router.replace('/questoes');
  };

  const requestExit = () => {
    Alert.alert(
      'Salvar simulado?',
      'Seu tempo, respostas e posição atual ficarão salvos para continuar depois.',
      [
        { text: 'Continuar prova', style: 'cancel' },
        { text: 'Salvar e sair', onPress: saveAndExit },
      ]
    );
  };

  const requestFinish = () => {
    if (!session) return;
    const blank = session.questions.length - answeredCount;
    Alert.alert(
      'Finalizar simulado',
      blank > 0
        ? `Ainda há ${blank} ${blank === 1 ? 'questão em branco' : 'questões em branco'}. Deseja finalizar mesmo assim?`
        : 'Deseja entregar a prova e ver o resultado?',
      [
        { text: 'Continuar prova', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: () => {
            finishSimulation();
            void triggerHapticFeedback('finish-simulation');
          },
        },
      ]
    );
  };

  const headerRight = (
    <Pressable
      onPress={requestExit}
      accessibilityRole="button"
      accessibilityLabel="Salvar e sair do simulado"
      hitSlop={8}
      style={({ pressed }) => [styles.saveAction, pressed && { opacity: 0.6 }]}>
      <Ionicons name="save-outline" size={17} color={colors.primary} />
      <Text style={[styles.saveActionText, { color: colors.primary }]}>Salvar</Text>
    </Pressable>
  );

  if (subscriptionLoading || !canUseSimulations) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Simulado" onBack={() => router.replace('/questoes')} />
        <EmptyState
          icon={subscriptionLoading ? 'time-outline' : 'lock-closed-outline'}
          title={subscriptionLoading ? 'Verificando seu plano' : 'Simulados são um recurso premium'}
          description={
            subscriptionLoading
              ? 'Aguarde enquanto confirmamos sua assinatura.'
              : 'Escolha um plano KAD para continuar esta prova.'
          }
        />
      </View>
    );
  }

  if (!session || !currentItem || !currentQuestion) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <StackHeader title="Simulado" onBack={() => router.replace('/questoes')} />
        <EmptyState
          icon="document-text-outline"
          title="Nenhum simulado em andamento"
          description="Monte uma prova personalizada para começar."
          actionLabel="Montar simulado"
          onAction={() => router.replace('/questoes/simulado/configurar')}
        />
      </View>
    );
  }

  const isFirst = session.currentIndex === 0;
  const isLast = session.currentIndex === session.questions.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Simulado" onBack={requestExit} right={headerRight} />

      <View style={[styles.statusArea, { borderBottomColor: colors.border }]}>
        <View style={styles.statusHeader}>
          <View style={styles.timer}>
            <Ionicons
              name="time-outline"
              size={18}
              color={session.remainingSeconds <= 300 ? colors.danger : colors.primary}
            />
            <Text
              style={[
                styles.timerText,
                { color: session.remainingSeconds <= 300 ? colors.danger : colors.text },
              ]}>
              {formatTimer(session.remainingSeconds)}
            </Text>
          </View>
          <Text style={[styles.answeredText, { color: colors.textMuted }]}>
            {`${answeredCount}/${session.questions.length} respondidas`}
          </Text>
        </View>
        <ProgressBar value={progress} label={`${answeredCount} questões respondidas`} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.questionNav}>
          {session.questions.map((item, index) => {
            const current = index === session.currentIndex;
            const answered = Boolean(session.answers[item.questionId]);
            return (
              <Pressable
                key={item.questionId}
                onPress={() => goTo(index)}
                accessibilityRole="button"
                accessibilityLabel={`Ir para questão ${index + 1}${answered ? ', respondida' : ''}`}
                style={[
                  styles.questionNumber,
                  {
                    backgroundColor: current
                      ? colors.primary
                      : answered
                        ? colors.successSoft
                        : colors.surfaceAlt,
                    borderColor: current
                      ? colors.primary
                      : answered
                        ? colors.success
                        : colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.questionNumberText,
                    {
                      color: current
                        ? colors.onPrimary
                        : answered
                          ? colors.success
                          : colors.textMuted,
                    },
                  ]}>
                  {index + 1}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.position, { color: colors.textSubtle }]}>
          {`QUESTÃO ${session.currentIndex + 1} DE ${session.questions.length}`}
        </Text>
        <SimulationQuestionCard
          question={currentQuestion}
          alternativeOrder={currentItem.alternativeOrder}
          selected={session.answers[currentQuestion.id]}
          onSelect={(alternative) => answerQuestion(currentQuestion.id, alternative)}
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}>
        <Button
          label="Anterior"
          variant="secondary"
          icon="chevron-back"
          iconMotion="backward"
          onPress={() => goTo(session.currentIndex - 1)}
          disabled={isFirst}
          style={styles.footerButton}
        />
        {isLast ? (
          <Button
            label="Finalizar"
            icon="checkmark-done"
            iconMotion="up"
            onPress={requestFinish}
            style={styles.footerButton}
          />
        ) : (
          <Button
            label="Próxima"
            icon="chevron-forward"
            iconMotion="forward"
            onPress={() => goTo(session.currentIndex + 1)}
            style={styles.footerButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  saveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  saveActionText: { fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  statusArea: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timerText: { fontSize: FontSize.heading, fontWeight: FontWeight.bold },
  answeredText: { fontSize: FontSize.small, fontWeight: FontWeight.medium },
  questionNav: { gap: Spacing.sm, paddingTop: Spacing.xs },
  questionNumber: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumberText: { fontSize: FontSize.small, fontWeight: FontWeight.bold },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  position: {
    marginBottom: Spacing.md,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  footer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { flex: 1 },
});
