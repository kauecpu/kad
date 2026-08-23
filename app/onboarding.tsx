import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KadMascot, type KadMascotVariant } from '@/components/kad-mascot';
import { Button } from '@/components/ui/button';
import { getOnboardingSlideAccessibilityLabel } from '@/constants/mascots';
import { FontSize, FontWeight, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ONBOARDING_START_OPTIONS,
  type OnboardingStartDestination,
  type OnboardingStartOption,
} from '@/lib/onboarding-destinations';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

type OnboardingSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  mascot: KadMascotVariant;
};

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'BOAS-VINDAS',
    title: 'Tudo para sua preparação',
    description: 'Pratique, simule e acompanhe concursos sem se perder entre materiais.',
    detail: 'Seu estudo organizado em um só lugar.',
    icon: 'compass-outline',
    mascot: 'welcome',
  },
  {
    id: 'questions',
    eyebrow: 'PRÁTICA',
    title: 'Resolva e evolua',
    description: 'Pratique por disciplina e assunto. Seu histórico mostra onde insistir.',
    detail: 'Cada sessão ajuda a medir seu progresso.',
    icon: 'reader-outline',
    mascot: 'practice',
  },
  {
    id: 'simulations',
    eyebrow: 'PREPARAÇÃO',
    title: 'Treine como na prova',
    description: 'Monte simulados, controle o tempo e revise suas respostas.',
    detail: 'Ganhe ritmo antes do dia da prova.',
    icon: 'stopwatch-outline',
    mascot: 'simulation',
  },
  {
    id: 'start',
    eyebrow: 'SEU PRIMEIRO PASSO',
    title: 'Por onde você quer começar?',
    description: 'Escolha sua primeira atividade. As outras continuam disponíveis no menu.',
    icon: 'flag-outline',
    mascot: 'goal',
  },
];

const LAST_SLIDE_INDEX = SLIDES.length - 1;
const MAX_CONTENT_WIDTH = 520;

type StartOptionProps = {
  option: OnboardingStartOption;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
};

function StartOption({ option, disabled, loading, onPress }: StartOptionProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityHint={option.accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        styles.startOption,
        {
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          borderColor: pressed ? colors.primary : colors.border,
          opacity: disabled && !loading ? 0.52 : 1,
        },
      ]}>
      <View
        style={[styles.startOptionIcon, { backgroundColor: colors.primarySoft }]}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Ionicons
          name={option.icon as keyof typeof Ionicons.glyphMap}
          size={21}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.startOptionLabel, { color: colors.text }]}>{option.label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

type OnboardingContentProps = {
  previewMode?: boolean;
};

export function OnboardingContent({ previewMode = false }: OnboardingContentProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const { isGuest, session } = useAuth();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const navigationLockedRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(Math.min(windowWidth, MAX_CONTENT_WIDTH));
  const [pageHeight, setPageHeight] = useState(Math.max(1, windowHeight));
  const [checking, setChecking] = useState(true);
  const [finishingDestination, setFinishingDestination] =
    useState<OnboardingStartDestination>();
  const isPreview = previewMode;
  const isLastSlide = currentIndex === LAST_SLIDE_INDEX;
  const finishing = finishingDestination !== undefined;
  const mascotSize = Math.max(146, Math.min(pageWidth * 0.48, windowHeight * 0.25, 210));
  const choiceMascotSize = Math.max(
    104,
    Math.min(pageWidth * 0.34, windowHeight * 0.18, 148)
  );

  useEffect(() => {
    let active = true;

    if (isPreview) {
      setChecking(false);
      return () => {
        active = false;
      };
    }

    if (!session) {
      setChecking(false);
      router.replace(isGuest ? '/inicio' : '/');
      return () => {
        active = false;
      };
    }

    void hasCompletedOnboarding(session.user.id).then((completed) => {
      if (!active) return;
      if (completed) {
        router.replace('/inicio');
        return;
      }
      setChecking(false);
    });

    return () => {
      active = false;
    };
  }, [isGuest, isPreview, router, session]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: currentIndex * pageWidth, animated: false });
  }, [currentIndex, pageWidth]);

  const finishOnboarding = useCallback(
    async (destination: OnboardingStartDestination) => {
      if (navigationLockedRef.current) return;

      navigationLockedRef.current = true;
      setFinishingDestination(destination);

      if (!isPreview && session) {
        await markOnboardingComplete(session.user.id);
      }

      router.replace(destination);
    },
    [isPreview, router, session]
  );

  const goForward = () => {
    if (isLastSlide || finishing) return;

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    listRef.current?.scrollToOffset({
      offset: nextIndex * pageWidth,
      animated: !reduceMotion,
    });
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setCurrentIndex(Math.max(0, Math.min(nextIndex, LAST_SLIDE_INDEX)));
  };

  if (checking) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.backgroundOrbTop, { backgroundColor: colors.primarySoft }]} />
      <View style={[styles.backgroundOrbBottom, { backgroundColor: colors.surfaceAlt }]} />

      <View
        style={[
          styles.shell,
          {
            paddingTop: insets.top + Spacing.sm,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && Math.abs(nextWidth - pageWidth) > 1) setPageWidth(nextWidth);
        }}>
        <View style={styles.topBar}>
          <View
            style={styles.logoFrame}
            accessibilityRole="image"
            accessibilityLabel="KAD Concursos">
            <Image
              source={require('../assets/images/kad-logo-v4.png')}
              resizeMode="stretch"
              accessible={false}
              style={styles.logo}
            />
            {isDark ? (
              <>
                <View
                  style={styles.darkWordmarkClip}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  <Image
                    source={require('../assets/images/kad-logo-v4.png')}
                    resizeMode="stretch"
                    tintColor={colors.text}
                    accessible={false}
                    style={styles.darkWordmark}
                  />
                </View>
                <View
                  style={styles.darkAccentClip}
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants">
                  <Image
                    source={require('../assets/images/kad-logo-v4.png')}
                    resizeMode="stretch"
                    accessible={false}
                    style={styles.darkAccent}
                  />
                </View>
              </>
            ) : null}
          </View>
          {!isLastSlide ? (
            <Pressable
              onPress={() => void finishOnboarding('/inicio')}
              disabled={finishing}
              accessibilityRole="button"
              accessibilityLabel="Pular apresentação"
              accessibilityState={{ disabled: finishing, busy: finishing }}
              hitSlop={10}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressed,
                finishing && styles.disabled,
              ]}>
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Pular</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          scrollEnabled={!finishing}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && Math.abs(nextHeight - pageHeight) > 1) {
              setPageHeight(nextHeight);
            }
          }}
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          renderItem={({ item, index }) => {
            const isChoiceSlide = index === LAST_SLIDE_INDEX;

            return (
              <ScrollView
                style={[styles.slide, { width: pageWidth, height: pageHeight }]}
                contentContainerStyle={[
                  styles.slideContent,
                  isChoiceSlide && styles.choiceSlideContent,
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
                accessible={!isChoiceSlide}
                aria-hidden={currentIndex !== index}
                accessibilityElementsHidden={currentIndex !== index}
                importantForAccessibility={currentIndex === index ? 'yes' : 'no-hide-descendants'}
                accessibilityLabel={
                  isChoiceSlide
                    ? undefined
                    : getOnboardingSlideAccessibilityLabel({
                        index,
                        total: SLIDES.length,
                        title: item.title,
                        description: item.description,
                        mascot: item.mascot,
                      })
                }>
                <View style={[styles.visualArea, isChoiceSlide && styles.choiceVisualArea]}>
                  <View
                    style={[
                      styles.mascotGlow,
                      isChoiceSlide && styles.choiceMascotGlow,
                      { backgroundColor: colors.primarySoft },
                    ]}
                  />
                  <KadMascot
                    size={isChoiceSlide ? choiceMascotSize : mascotSize}
                    active={currentIndex === index}
                    motion={isChoiceSlide ? 'celebrate' : 'float'}
                    variant={item.mascot}
                  />
                  <View
                    style={[
                      styles.iconBadge,
                      isChoiceSlide && styles.choiceIconBadge,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    accessible={false}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants">
                    <Ionicons name={item.icon} size={20} color={colors.primary} />
                  </View>
                </View>

                <View style={styles.copy}>
                  <Text style={[styles.eyebrow, { color: colors.primary }]}>{item.eyebrow}</Text>
                  <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.description, { color: colors.textMuted }]}>
                    {item.description}
                  </Text>

                  {isChoiceSlide ? (
                    <View style={styles.startOptions}>
                      {ONBOARDING_START_OPTIONS.map((option) => (
                        <StartOption
                          key={option.id}
                          option={option}
                          disabled={finishing}
                          loading={finishingDestination === option.route}
                          onPress={() => void finishOnboarding(option.route)}
                        />
                      ))}
                    </View>
                  ) : item.detail ? (
                    <View style={[styles.detail, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        accessible={false}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants">
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      </View>
                      <Text style={[styles.detailText, { color: colors.textMuted }]}>
                        {item.detail}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            );
          }}
        />

        <View style={styles.footer}>
          <View
            style={styles.dots}
            accessibilityLabel={`Etapa ${currentIndex + 1} de ${SLIDES.length}`}>
            {SLIDES.map((slide, index) => (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  {
                    width: currentIndex === index ? 24 : 7,
                    backgroundColor: currentIndex === index ? colors.primary : colors.borderStrong,
                  },
                ]}
              />
            ))}
          </View>
          {!isLastSlide ? (
            <Button
              label="Continuar"
              icon="arrow-forward"
              iconMotion="forward"
              size="lg"
              fullWidth
              disabled={finishing}
              onPress={goForward}
            />
          ) : null}
          <Text style={[styles.gestureHint, { color: colors.textSubtle }]}>
            {isLastSlide
              ? finishing
                ? 'Preparando sua primeira atividade...'
                : 'Escolha uma opção para abrir o KAD'
              : 'Arraste para o lado ou toque em Continuar'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  return <OnboardingContent />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundOrbTop: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -120,
    right: -105,
    opacity: 0.72,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 24,
    left: -170,
    opacity: 0.42,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  topBar: {
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoFrame: {
    width: 136,
    height: 48,
    position: 'relative',
  },
  logo: {
    position: 'absolute',
    left: 10,
    width: 115,
    height: 49,
  },
  darkWordmarkClip: {
    position: 'absolute',
    left: 56,
    top: 12,
    width: 65,
    height: 23,
    overflow: 'hidden',
  },
  darkWordmark: {
    position: 'absolute',
    left: -46,
    top: -12,
    width: 115,
    height: 49,
  },
  darkAccentClip: {
    position: 'absolute',
    left: 87,
    top: 27,
    width: 6,
    height: 6,
    overflow: 'hidden',
  },
  darkAccent: {
    position: 'absolute',
    left: -77,
    top: -27,
    width: 115,
    height: 49,
  },
  skipButton: {
    minWidth: 64,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipPlaceholder: {
    width: 64,
  },
  skipText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  choiceSlideContent: {
    justifyContent: 'flex-start',
    gap: Spacing.md,
  },
  visualArea: {
    minHeight: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceVisualArea: {
    minHeight: 116,
  },
  mascotGlow: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 196,
    height: 196,
    borderRadius: 98,
    opacity: 0.78,
  },
  choiceMascotGlow: {
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  iconBadge: {
    position: 'absolute',
    right: '18%',
    bottom: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceIconBadge: {
    right: '25%',
    bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  copy: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eyebrow: {
    ...Typography.overline,
    textAlign: 'center',
  },
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  description: {
    maxWidth: 410,
    fontSize: FontSize.heading,
    lineHeight: 24,
    textAlign: 'center',
  },
  detail: {
    maxWidth: 400,
    minHeight: 48,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    flexShrink: 1,
    fontSize: FontSize.small,
    lineHeight: 18,
    fontWeight: FontWeight.medium,
  },
  startOptions: {
    width: '100%',
    maxWidth: 420,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  startOption: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  startOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startOptionLabel: {
    flex: 1,
    fontSize: FontSize.body,
    lineHeight: 21,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  dots: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    height: 7,
    borderRadius: Radius.pill,
  },
  gestureHint: {
    minHeight: 17,
    fontSize: FontSize.tiny,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.52,
  },
});
