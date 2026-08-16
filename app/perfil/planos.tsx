import Ionicons from '@/components/ui/app-icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StackHeader } from '@/components/ui/stack-header';
import {
  cardShadow,
  CONTENT_MAX_WIDTH,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from '@/constants/theme';
import {
  BASIC_PLAN_ACCESS,
  DIAMOND_BENEFITS,
  DIAMOND_BILLING_OPTIONS,
} from '@/data/user';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency, formatDate } from '@/lib/format';
import { isValidPaymentCheckoutReturnId } from '@/lib/payment-security';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import type { BillingCycle, SubscriptionPlan } from '@/types';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Plano Básico',
  diamond: 'KAD Diamante',
  circle: 'KAD Círculo',
};

const PLAN_GRADIENTS = {
  light: ['#27104F', '#5520A7', '#7C3AED'],
  dark: ['#160B2C', '#34146B', '#5B21B6'],
} as const;

export default function PlansScreen() {
  const { colors, scheme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { session } = useAuth();
  const {
    subscription,
    isPremium,
    subscribe,
    cancelSubscription,
    refreshSubscription,
    subscriptionLoading,
  } = useApp();
  const [diamondCycle, setDiamondCycle] = useState<BillingCycle>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [checkoutReturned, setCheckoutReturned] = useState(false);
  const isDesktop = width >= 760;

  useEffect(() => {
    if (!isValidPaymentCheckoutReturnId(checkout) || !session) return;
    setCheckoutReturned(true);
    let stopped = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const confirmSubscription = async () => {
      attempts += 1;
      try {
        await refreshSubscription();
      } catch {
        // Uma tentativa seguinte cobre atrasos temporários de rede ou do webhook.
      } finally {
        if (!stopped && attempts < 5) {
          timer = setTimeout(() => void confirmSubscription(), 3_000);
        }
      }
    };

    void confirmSubscription();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkout, refreshSubscription, session]);

  const notify = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const subscribeTo = async (
    plan: Exclude<SubscriptionPlan, 'basic'>,
    cycle: BillingCycle
  ) => {
    if (!session) {
      notify('Conta necessária', 'Entre ou crie uma conta para assinar o KAD.');
      router.push('/auth/login');
      return;
    }
    if (Platform.OS !== 'web') {
      notify(
        'Pagamento móvel em preparação',
        'As compras pelo aplicativo serão liberadas após a configuração da loja.'
      );
      return;
    }

    setCheckoutLoading(true);
    try {
      const result = await subscribe(plan, cycle);
      if (!result.ok || !result.checkoutUrl) {
        notify('Não foi possível abrir o pagamento', result.message ?? 'Tente novamente.');
        return;
      }
      globalThis.location.assign(result.checkoutUrl);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const performCancel = async () => {
    setCancelLoading(true);
    try {
      const result = await cancelSubscription();
      notify(
        result.ok ? 'Renovação cancelada' : 'Não foi possível cancelar',
        result.ok
          ? 'Seu acesso continuará disponível até o fim do período já pago.'
          : result.message ?? 'Tente novamente em instantes.'
      );
    } finally {
      setCancelLoading(false);
    }
  };

  const cancel = () => {
    const title = 'Cancelar renovação';
    const message = 'Você continuará com acesso até o fim do período atual. Deseja continuar?';
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${title}\n\n${message}`)) void performCancel();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar renovação',
        style: 'destructive',
        onPress: () => void performCancel(),
      },
    ]);
  };

  const currentPlanDescription = isPremium
    ? subscription.status === 'past_due'
      ? `Acesso disponível até ${formatDate(subscription.renewsAt)} enquanto a renovação é regularizada.`
      : subscription.autoRenew
        ? `Acesso ativo até ${formatDate(subscription.renewsAt)}, com renovação automática.`
        : `Acesso ativo até ${formatDate(subscription.renewsAt)}, sem renovação automática.`
    : 'Questões ilimitadas, sem cobrança e sem prazo para terminar.';
  const currentBadge = subscriptionLoading
    ? 'Atualizando'
    : subscription.status === 'past_due'
      ? 'Pendente'
      : isPremium && !subscription.autoRenew
        ? 'Renovação cancelada'
        : isPremium
          ? 'Ativo'
          : 'Grátis';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Planos e assinatura" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={PLAN_GRADIENTS[scheme]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View pointerEvents="none" style={styles.heroGlow} />
          <View pointerEvents="none" style={styles.heroFacetOne} />
          <View pointerEvents="none" style={styles.heroFacetTwo} />
          <View style={styles.heroEyebrowRow}>
            <View style={styles.heroDot} />
            <Text style={styles.heroEyebrow}>PLANOS KAD</Text>
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">
            Pratique sem travas. Evolua com direção.
          </Text>
          <Text style={styles.heroDescription}>
            Questões ilimitadas para todos. No Diamante, cada resposta vira visão clara da sua evolução.
          </Text>
          <View style={styles.heroPromises}>
            <HeroPromise icon="infinite-outline" label="Questões ilimitadas" />
            <HeroPromise icon="diamond-outline" label="Desempenho e simulados" />
          </View>
        </LinearGradient>

        {checkoutReturned ? (
          <View style={[styles.checkoutNotice, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <View style={styles.checkoutNoticeText}>
              <Text style={[styles.checkoutNoticeTitle, { color: colors.text }]}>
                Confirmando pagamento
              </Text>
              <Text style={[styles.currentDescription, { color: colors.textMuted }]}>
                O acesso será liberado assim que o Mercado Pago confirmar a cobrança. Use
                “Atualizar assinatura” se a confirmação levar alguns instantes.
              </Text>
            </View>
          </View>
        ) : null}

        <Card style={[styles.currentCard, { borderColor: colors.borderStrong }]}>
          <View style={styles.currentHeader}>
            <View style={[styles.currentIcon, { backgroundColor: isPremium ? colors.primarySoft : colors.successSoft }]}>
              <Ionicons
                name={isPremium ? 'diamond-outline' : 'infinite-outline'}
                size={22}
                color={isPremium ? colors.primary : colors.success}
              />
            </View>
            <View style={styles.currentText}>
              <Text style={[styles.eyebrow, { color: colors.textSubtle }]}>Seu plano atual</Text>
              <Text style={[styles.currentTitle, { color: colors.text }]}>
                {PLAN_LABEL[subscription.plan]}
              </Text>
              <Text style={[styles.currentDescription, { color: colors.textMuted }]}>
                {currentPlanDescription}
              </Text>
            </View>
            <Badge
              label={currentBadge}
              tone={subscription.status === 'past_due' ? 'warning' : isPremium ? 'accent' : 'neutral'}
            />
          </View>
          {isPremium && subscription.autoRenew ? (
            <Button
              label={cancelLoading ? 'Cancelando renovação...' : 'Cancelar renovação'}
              variant="danger"
              icon="close-circle-outline"
              onPress={cancel}
              disabled={cancelLoading}
              fullWidth
            />
          ) : null}
          {session ? (
            <Button
              label={subscriptionLoading ? 'Atualizando...' : 'Atualizar assinatura'}
              variant="secondary"
              icon="refresh"
              onPress={() => void refreshSubscription()}
              disabled={subscriptionLoading}
              fullWidth
            />
          ) : null}
        </Card>

        <View style={styles.planIntro}>
          <Text style={[styles.planIntroEyebrow, { color: colors.primary }]}>ESCOLHA SEU NÍVEL</Text>
          <Text style={[styles.planIntroTitle, { color: colors.text }]}>O Básico libera a prática. O Diamante revela o caminho.</Text>
          <Text style={[styles.planIntroDescription, { color: colors.textMuted }]}>Comece gratuitamente ou desbloqueie simulados e uma leitura completa do seu desempenho.</Text>
        </View>

        <View style={[styles.planGrid, isDesktop && styles.planGridDesktop]}>
          <BasicPlanSection active={!isPremium} />
          <DiamondPlanSection
            options={DIAMOND_BILLING_OPTIONS}
            selectedCycle={diamondCycle}
            onSelectCycle={setDiamondCycle}
            active={subscription.plan === 'diamond' && isPremium}
            onSubscribe={() => subscribeTo('diamond', diamondCycle)}
            checkoutLoading={checkoutLoading}
          />
        </View>

      </ScrollView>
    </View>
  );
}

function HeroPromise({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroPromise}>
      <Ionicons name={icon} size={16} color="#F8CE62" />
      <Text style={styles.heroPromiseText}>{label}</Text>
    </View>
  );
}

function BasicPlanSection({ active }: { active: boolean }) {
  const { colors } = useTheme();
  return (
    <Card style={[styles.basicCard, { borderColor: active ? colors.success : colors.borderStrong }]}>
      <View style={styles.planHeader}>
        <View style={[styles.basicIcon, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="infinite-outline" size={24} color={colors.success} />
        </View>
        <View style={styles.planHeading}>
          <Text style={[styles.planTitle, { color: colors.text }]}>Plano Básico</Text>
          <Text style={[styles.planSubtitle, { color: colors.textMuted }]}>Prática livre, simples e gratuita.</Text>
        </View>
        <Badge label={active ? 'Seu plano' : 'Grátis'} tone={active ? 'success' : 'neutral'} />
      </View>

      <View style={[styles.basicSpotlight, { backgroundColor: colors.successSoft }]}>
        <Text style={[styles.basicSpotlightEyebrow, { color: colors.success }]}>SEM LIMITE DIÁRIO</Text>
        <Text style={[styles.basicSpotlightTitle, { color: colors.text }]}>Questões ilimitadas</Text>
        <Text style={[styles.basicSpotlightDescription, { color: colors.textMuted }]}>Responda quantas quiser e confira a correção logo após cada questão.</Text>
      </View>

      <View style={styles.benefits}>
        {BASIC_PLAN_ACCESS.slice(1).map((feature) => (
          <Benefit key={feature.label} label={feature.label} color={colors.success} textColor={colors.text} />
        ))}
      </View>
    </Card>
  );
}

function Benefit({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={styles.benefit}>
      <Ionicons name="checkmark-circle" size={18} color={color} />
      <Text style={[styles.benefitText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

type BillingOption = {
  id: BillingCycle;
  name: string;
  price: number;
  period: string;
  description: string;
  badge?: string;
};

function DiamondPlanSection({
  benefits,
  options,
  selectedCycle,
  onSelectCycle,
  active,
  onSubscribe,
  checkoutLoading = false,
}: {
  benefits?: string[];
  options: readonly BillingOption[];
  selectedCycle: BillingCycle;
  onSelectCycle: (cycle: BillingCycle) => void;
  active: boolean;
  onSubscribe: () => void | Promise<void>;
  checkoutLoading?: boolean;
}) {
  const selected = options.find((option) => option.id === selectedCycle) ?? options[0];
  const features = benefits ?? DIAMOND_BENEFITS;
  const ctaLabel = active
    ? 'Seu KAD Diamante está ativo'
    : checkoutLoading
      ? 'Preparando pagamento...'
      : Platform.OS === 'web'
        ? `Assinar Diamante · ${formatCurrency(selected.price)}`
        : 'Pagamento móvel em breve';

  return (
    <LinearGradient
      colors={['#1C0C36', '#3D176F', '#6326B8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.diamondCard}>
      <View pointerEvents="none" style={styles.diamondGlow} />
      <View pointerEvents="none" style={styles.diamondFacet} />

      <View style={styles.diamondHeader}>
        <View style={styles.diamondIcon}>
          <Image
            source={require('@/assets/images/kad-icon-v4.png')}
            resizeMode="contain"
            style={styles.diamondBrandMark}
          />
        </View>
        <View style={styles.planHeading}>
          <Text style={styles.diamondTitle}>KAD Diamante</Text>
          <Text style={styles.diamondSubtitle}>Para transformar prática em estratégia.</Text>
        </View>
        <View style={styles.diamondBadge}>
          <Text style={styles.diamondBadgeText}>{active ? 'ATIVO' : 'MAIS COMPLETO'}</Text>
        </View>
      </View>

      <View style={styles.diamondPromise}>
        <Text style={styles.diamondPromiseEyebrow}>ENXERGUE ALÉM DO GABARITO</Text>
        <Text style={styles.diamondPromiseTitle}>Saiba onde você evolui e onde precisa insistir.</Text>
      </View>

      <View style={styles.diamondBenefits}>
        {features.map((benefit) => (
          <View key={benefit} style={styles.diamondBenefit}>
            <View style={styles.diamondCheck}>
              <Ionicons name="checkmark" size={13} color="#25103F" />
            </View>
            <Text style={styles.diamondBenefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.diamondCycleLabel}>ESCOLHA O CICLO</Text>
      <View style={styles.billingOptions}>
        {options.map((option) => {
          const checked = option.id === selectedCycle;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSelectCycle(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={`${option.name}: ${formatCurrency(option.price)} ${option.period}`}
              style={({ pressed }) => [
                styles.billingOption,
                checked && styles.billingOptionSelected,
                pressed && styles.pressed,
              ]}>
              <View style={styles.billingTop}>
                <Text style={styles.billingName}>{option.name}</Text>
                {option.badge ? (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>{option.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.billingPrice}>
                {formatCurrency(option.price)}
                <Text style={styles.billingPeriod}>{` ${option.period}`}</Text>
              </Text>
              <Text style={styles.billingDescription}>{option.description}</Text>
              <Ionicons
                name={checked ? 'radio-button-on' : 'radio-button-off'}
                size={21}
                color={checked ? '#F8CE62' : '#C4B5D8'}
                style={styles.radio}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onSubscribe}
        disabled={active || checkoutLoading || Platform.OS !== 'web'}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: active || checkoutLoading || Platform.OS !== 'web' }}
        style={({ pressed }) => [
          styles.diamondCta,
          (pressed || active || checkoutLoading || Platform.OS !== 'web') && styles.diamondCtaMuted,
        ]}>
        <Ionicons
          name={active ? 'checkmark-circle' : checkoutLoading ? 'time-outline' : 'arrow-forward'}
          size={20}
          color="#3D176F"
        />
        <Text style={styles.diamondCtaText}>{ctaLabel}</Text>
      </Pressable>

      <View style={styles.paymentNotice}>
        <Ionicons
          name={Platform.OS === 'web' ? 'shield-checkmark-outline' : 'phone-portrait-outline'}
          size={18}
          color="#D8CCE8"
        />
        <Text style={styles.paymentNoticeText}>
          {Platform.OS === 'web'
            ? 'Pagamento processado no ambiente seguro do Mercado Pago.'
            : 'A compra pelo aplicativo será liberada após a configuração das lojas.'}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 270,
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
  },
  heroGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    right: -80,
    top: -110,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroFacetOne: {
    position: 'absolute',
    width: 76,
    height: 390,
    right: 80,
    top: -60,
    backgroundColor: 'rgba(255,255,255,0.055)',
    transform: [{ rotate: '27deg' }],
  },
  heroFacetTwo: {
    position: 'absolute',
    width: 34,
    height: 360,
    right: 5,
    top: -35,
    backgroundColor: 'rgba(248,206,98,0.10)',
    transform: [{ rotate: '27deg' }],
  },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  heroDot: { width: 7, height: 7, borderRadius: Radius.pill, backgroundColor: '#F8CE62' },
  heroEyebrow: { color: '#F8CE62', fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 1.1 },
  heroTitle: { maxWidth: 620, color: '#FFFFFF', fontSize: 34, lineHeight: 39, fontWeight: FontWeight.bold, letterSpacing: -0.8 },
  heroDescription: { maxWidth: 600, color: '#E7DDF5', fontSize: FontSize.body, lineHeight: 22 },
  heroPromises: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  heroPromise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroPromiseText: { color: '#FFFFFF', fontSize: FontSize.small, fontWeight: FontWeight.semibold },
  currentCard: { gap: Spacing.md, borderWidth: 1 },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  currentIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  currentText: { flex: 1, gap: 3 },
  eyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.7 },
  currentTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  currentDescription: { fontSize: FontSize.small, lineHeight: 19 },
  planIntro: { maxWidth: 680, gap: Spacing.xs, paddingTop: Spacing.sm },
  planIntroEyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 1 },
  planIntroTitle: { fontSize: FontSize.title, lineHeight: 29, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  planIntroDescription: { fontSize: FontSize.body, lineHeight: 22 },
  planGrid: { gap: Spacing.lg },
  planGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  basicCard: { flex: 1, minWidth: 0, gap: Spacing.lg, borderWidth: 1 },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  planHeading: { flex: 1, gap: 2 },
  planTitle: { fontSize: FontSize.heading + 1, fontWeight: FontWeight.bold },
  planSubtitle: { fontSize: FontSize.small, lineHeight: 18 },
  basicIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md },
  basicSpotlight: { gap: 3, padding: Spacing.lg, borderRadius: Radius.lg },
  basicSpotlightEyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.9 },
  basicSpotlightTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  basicSpotlightDescription: { fontSize: FontSize.small, lineHeight: 19 },
  benefits: { gap: Spacing.md },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  benefitText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  checkoutNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  checkoutNoticeText: { flex: 1, gap: 3 },
  checkoutNoticeTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  diamondCard: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    ...cardShadow('#160B2C', 3),
  },
  diamondGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    right: -90,
    top: -80,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(248,206,98,0.08)',
  },
  diamondFacet: {
    position: 'absolute',
    width: 42,
    height: 420,
    right: 42,
    top: -80,
    backgroundColor: 'rgba(255,255,255,0.045)',
    transform: [{ rotate: '24deg' }],
  },
  diamondHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  diamondIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondBrandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  diamondTitle: { color: '#FFFFFF', fontSize: FontSize.heading + 1, fontWeight: FontWeight.bold },
  diamondSubtitle: { color: '#D8CCE8', fontSize: FontSize.small, lineHeight: 18 },
  diamondBadge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: Radius.pill, backgroundColor: '#F8CE62' },
  diamondBadgeText: { color: '#321657', fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  diamondPromise: { gap: 4 },
  diamondPromiseEyebrow: { color: '#F8CE62', fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  diamondPromiseTitle: { color: '#FFFFFF', fontSize: FontSize.title, lineHeight: 29, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  diamondBenefits: { gap: Spacing.sm + 2 },
  diamondBenefit: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  diamondCheck: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill, backgroundColor: '#F8CE62' },
  diamondBenefitText: { flex: 1, color: '#F4EDF9', fontSize: FontSize.small, lineHeight: 20 },
  diamondCycleLabel: { color: '#C9B9DB', fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.9 },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(10,4,20,0.20)',
  },
  paymentNoticeText: { flex: 1, color: '#D8CCE8', fontSize: FontSize.small, lineHeight: 19 },
  billingOptions: { gap: Spacing.sm },
  billingOption: {
    position: 'relative',
    gap: 3,
    padding: Spacing.md,
    paddingRight: Spacing.xxxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  billingOptionSelected: { borderColor: '#F8CE62', backgroundColor: 'rgba(248,206,98,0.12)' },
  billingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  billingName: { color: '#FFFFFF', fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  billingPrice: { color: '#FFFFFF', fontSize: FontSize.title, fontWeight: FontWeight.bold },
  billingPeriod: { color: '#D8CCE8', fontSize: FontSize.small, fontWeight: FontWeight.regular },
  billingDescription: { color: '#C9B9DB', fontSize: FontSize.small },
  savingsBadge: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: Radius.pill, backgroundColor: 'rgba(248,206,98,0.16)' },
  savingsBadgeText: { color: '#F8CE62', fontSize: 9, fontWeight: FontWeight.bold },
  radio: { position: 'absolute', right: Spacing.md, top: '50%', marginTop: -10 },
  diamondCta: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
  },
  diamondCtaMuted: { opacity: 0.58, transform: [{ scale: 0.99 }] },
  diamondCtaText: { color: '#3D176F', fontSize: FontSize.body, fontWeight: FontWeight.bold },
  pressed: { opacity: 0.75 },
});
