import Ionicons from '@/components/ui/app-icon';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KadMascot, type KadMascotVariant } from '@/components/kad-mascot';
import { Button } from '@/components/ui/button';
import { getOnboardingSlideAccessibilityLabel } from '@/constants/mascots';
import { FontSize, FontWeight, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasCompletedOnboarding, markOnboardingComplete } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

type OnboardingSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  mascot: KadMascotVariant;
};

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    eyebrow: 'BOAS-VINDAS',
    title: 'Seu estudo, com direção',
    description:
      'O KAD reúne o que você precisa para estudar sem se perder entre materiais e oportunidades.',
    detail: 'Questões, concursos e simulados em um só lugar.',
    icon: 'compass-outline',
    mascot: 'welcome',
  },
  {
    id: 'questions',
    eyebrow: 'PRÁTICA',
    title: 'Aprenda resolvendo',
    description:
      'Escolha uma disciplina, pratique por assunto e acompanhe sua evolução a cada sessão.',
    detail: 'Seu histórico ajuda a mostrar onde vale insistir.',
    icon: 'reader-outline',
    mascot: 'practice',
  },
  {
    id: 'simulations',
    eyebrow: 'PREPARAÇÃO',
    title: 'Simule o dia da prova',
    description:
      'Monte simulados, controle o tempo e revise cada resposta quando terminar.',
    detail: 'Treine ritmo, foco e tomada de decisão.',
    icon: 'stopwatch-outline',
    mascot: 'simulation',
  },
  {
    id: 'goal',
    eyebrow: 'SEU CAMINHO',
    title: 'Sua meta guia o KAD',
    description:
      'Salve concursos e escolha seu objetivo para receber recomendações mais úteis para você.',
    detail: 'Você pode ajustar sua meta quando quiser.',
    icon: 'flag-outline',
    mascot: 'goal',
  },
];

const LAST_SLIDE_INDEX = SLIDES.length - 1;
const MAX_CONTENT_WIDTH = 520;

type OnboardingContentProps = {
  previewMode?: boolean;
};

export function OnboardingContent({ previewMode = false }: OnboardingContentProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { isGuest, session } = useAuth();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(Math.min(windowWidth, MAX_CONTENT_WIDTH));
  const [checking, setChecking] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const isPreview = previewMode;
  const isLastSlide = currentIndex === LAST_SLIDE_INDEX;
  const mascotSize = Math.max(150, Math.min(pageWidth * 0.53, windowHeight * 0.29, 230));

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

  const finishOnboarding = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    if (!isPreview && session) await markOnboardingComplete(session.user.id);
    router.replace('/inicio');
  }, [finishing, isPreview, router, session]);

  const goForward = () => {
    if (isLastSlide) {
      void finishOnboarding();
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    listRef.current?.scrollToOffset({ offset: nextIndex * pageWidth, animated: true });
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
      <View
        style={[styles.backgroundOrbTop, { backgroundColor: colors.primarySoft }]}
      />
      <View
        style={[styles.backgroundOrbBottom, { backgroundColor: colors.surfaceAlt }]}
      />

      <View
        style={[
          styles.shell,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && Math.abs(nextWidth - pageWidth) > 1) setPageWidth(nextWidth);
        }}>
        <View style={styles.topBar}>
          <Image
            source={require('../assets/images/kad-logo-v4.png')}
            resizeMode="contain"
            accessibilityLabel="KAD Concursos"
            style={styles.logo}
          />
          {!isLastSlide ? (
            <Pressable
              onPress={() => void finishOnboarding()}
              disabled={finishing}
              accessibilityRole="button"
              accessibilityLabel="Pular apresentação"
              hitSlop={10}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}>
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
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          renderItem={({ item, index }) => (
            <View
              accessible
              aria-hidden={currentIndex !== index}
              accessibilityElementsHidden={currentIndex !== index}
              importantForAccessibility={currentIndex === index ? 'yes' : 'no-hide-descendants'}
              accessibilityLabel={getOnboardingSlideAccessibilityLabel({
                index,
                total: SLIDES.length,
                title: item.title,
                description: item.description,
                mascot: item.mascot,
              })}
              style={[styles.slide, { width: pageWidth }]}>
              <View style={styles.visualArea}>
                <View
                  style={[styles.mascotGlow, { backgroundColor: colors.primarySoft }]}
                />
                <KadMascot
                  size={mascotSize}
                  active={currentIndex === index}
                  motion={index === LAST_SLIDE_INDEX ? 'celebrate' : 'float'}
                  variant={item.mascot}
                />
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                  <Ionicons name={item.icon} size={21} color={colors.primary} />
                </View>
              </View>

              <View style={styles.copy}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>{item.eyebrow}</Text>
                <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.description, { color: colors.textMuted }]}>
                  {item.description}
                </Text>
                <View style={[styles.detail, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.detailText, { color: colors.textMuted }]}>{item.detail}</Text>
                </View>
              </View>
            </View>
          )}
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
          <Button
            label={isLastSlide ? (finishing ? 'Abrindo o KAD...' : 'Começar a estudar') : 'Continuar'}
            icon={isLastSlide ? 'sparkles-outline' : 'arrow-forward'}
            size="lg"
            fullWidth
            disabled={finishing}
            onPress={goForward}
          />
          <Text style={[styles.gestureHint, { color: colors.textSubtle }]}>
            {isLastSlide ? 'Tudo pronto. Vamos começar?' : 'Arraste para o lado ou toque em Continuar'}
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
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 116,
    height: 40,
  },
  skipButton: {
    minWidth: 56,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipPlaceholder: {
    width: 56,
  },
  skipText: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  visualArea: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotGlow: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 208,
    height: 208,
    borderRadius: 104,
    opacity: 0.78,
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
    minHeight: 46,
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
});
