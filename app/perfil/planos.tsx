import Ionicons from '@/components/ui/app-icon';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
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
  PLATINUM_BENEFITS,
  PLATINUM_BILLING_OPTIONS,
} from '@/data/user';
import { useTheme } from '@/hooks/use-theme';
import { formatCurrency, formatDate } from '@/lib/format';
import { ANDROID_PRODUCT_IDS, endBilling, initBilling, observeStorePurchases } from '@/lib/billing';
import { isValidPaymentCheckoutReturnId } from '@/lib/payment-security';
import {
  purchaseGoogleSubscription,
  restoreGoogleSubscriptions,
  settleGooglePurchase,
} from '@/lib/subscriptions';
import { useApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import type { BillingCycle, SubscriptionPlan } from '@/types';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Plano Básico',
  platinum: 'KAD Platina',
  diamond: 'KAD Diamante',
  circle: 'KAD Círculo',
};

const PLAN_GRADIENTS = {
  light: ['#27104F', '#5520A7', '#7C3AED'],
  dark: ['#160B2C', '#34146B', '#5B21B6'],
} as const;

export default function PlansScreen() {
  const { colors, scheme } = useTheme();
  const { width, fontScale } = useWindowDimensions();
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
  const [platinumCycle, setPlatinumCycle] = useState<BillingCycle>('monthly');
  const [diamondCycle, setDiamondCycle] = useState<BillingCycle>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [checkoutReturned, setCheckoutReturned] = useState(false);
  const isDesktop = width >= 760 && fontScale < 1.3;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void initBilling();
    return () => {
      void endBilling();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !session) return;
    return observeStorePurchases((purchase) => {
      if (purchase.purchaseState !== 'purchased') return;
      void settleGooglePurchase(purchase).then((result) => {
        if (result.ok) void refreshSubscription();
      });
    });
  }, [refreshSubscription, session]);

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
    plan: Exclude<SubscriptionPlan, 'basic' | 'circle'>,
    cycle: BillingCycle
  ) => {
    if (!session) {
      notify('Conta necessária', 'Entre ou crie uma conta para assinar o KAD.');
      router.push('/auth/login');
      return;
    }
    if (Platform.OS !== 'web') {
      if (Platform.OS !== 'android') {
        notify('Compra no Android', 'A assinatura pela Google Play está disponível no Android.');
        return;
      }
      setCheckoutLoading(true);
      try {
        const result = await purchaseGoogleSubscription(ANDROID_PRODUCT_IDS[plan][cycle]);
        if (!result.ok) {
          notify('Não foi possível concluir a compra', result.message ?? 'Tente novamente.');
          return;
        }
        await refreshSubscription();
        notify('Assinatura confirmada', 'Seu acesso foi atualizado pelo servidor.');
      } finally {
        setCheckoutLoading(false);
      }
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

  const restore = async () => {
    if (!session) {
      notify('Conta necessária', 'Entre ou crie uma conta para restaurar suas compras.');
      router.push('/auth/login');
      return;
    }
    if (Platform.OS === 'web') {
      notify('Restauração no aplicativo', 'Abra o KAD no Android para restaurar compras da Google Play.');
      return;
    }
    if (Platform.OS !== 'android') {
      notify('Restauração no Android', 'A restauração pela Google Play está disponível no Android.');
      return;
    }
    setRestoreLoading(true);
    try {
      const result = await restoreGoogleSubscriptions();
      if (!result.ok) {
        notify('Não foi possível restaurar', result.message ?? 'Tente novamente.');
        return;
      }
      await refreshSubscription();
      notify('Restauração concluída', result.entitled > 0
        ? 'Sua assinatura foi restaurada.'
        : 'Nenhuma assinatura ativa foi encontrada.');
    } finally {
      setRestoreLoading(false);
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
            Questões ilimitadas para todos. Platina e Diamante transformam respostas em uma visão clara da sua evolução.
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
          {session ? (
            <Button
              label={restoreLoading ? 'Restaurando...' : 'Restaurar compras'}
              variant="ghost"
              icon="refresh-circle-outline"
              onPress={() => void restore()}
              disabled={restoreLoading || checkoutLoading}
              fullWidth
            />
          ) : null}
        </Card>

        <View style={styles.planIntro}>
          <Text style={[styles.planIntroEyebrow, { color: colors.primary }]}>ESCOLHA SEU NÍVEL</Text>
          <Text style={[styles.planIntroTitle, { color: colors.text }]}>Escolha o nível que acompanha seu momento.</Text>
          <Text style={[styles.planIntroDescription, { color: colors.textMuted }]}>Comece gratuitamente ou desbloqueie simulados e uma leitura completa do seu desempenho.</Text>
        </View>

        <View style={styles.planGrid}>
          <BasicPlanSection active={!isPremium} />
          <View style={[styles.premiumGrid, isDesktop && styles.premiumGridDesktop]}>
            <PremiumPlanSection
              tier="platinum"
              name="KAD Platina"
              subtitle="Estratégia e desempenho, sem excesso visual."
              badge={subscription.plan === 'platinum' && isPremium ? 'Seu plano' : 'Disponível'}
              benefits={PLATINUM_BENEFITS}
              options={PLATINUM_BILLING_OPTIONS}
              selectedCycle={platinumCycle}
              onSelectCycle={setPlatinumCycle}
              active={subscription.plan === 'platinum' && isPremium}
              onSubscribe={() => subscribeTo('platinum', platinumCycle)}
              checkoutLoading={checkoutLoading}
              isDesktop={isDesktop}
            />
            <PremiumPlanSection
              tier="diamond"
              name="KAD Diamante"
              subtitle="O próximo nível da preparação KAD."
              badge={subscription.plan === 'diamond' && isPremium ? 'Seu plano' : 'Disponível'}
              benefits={DIAMOND_BENEFITS}
              options={DIAMOND_BILLING_OPTIONS}
              selectedCycle={diamondCycle}
              onSelectCycle={setDiamondCycle}
              active={subscription.plan === 'diamond' && isPremium}
              onSubscribe={() => subscribeTo('diamond', diamondCycle)}
              checkoutLoading={checkoutLoading}
              isDesktop={isDesktop}
            />
          </View>
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

function PremiumPlanSection({
  tier,
  name,
  subtitle,
  badge,
  benefits,
  options,
  selectedCycle,
  onSelectCycle,
  active,
  onSubscribe,
  checkoutLoading = false,
  available = true,
  isDesktop = false,
}: {
  tier: 'platinum' | 'diamond';
  name: string;
  subtitle: string;
  badge: string;
  benefits: readonly string[];
  options?: readonly BillingOption[];
  selectedCycle?: BillingCycle;
  onSelectCycle?: (cycle: BillingCycle) => void;
  active?: boolean;
  onSubscribe?: () => void | Promise<void>;
  checkoutLoading?: boolean;
  available?: boolean;
  isDesktop?: boolean;
}) {
  const { colors } = useTheme();
  const selected = options?.find((option) => option.id === selectedCycle) ?? options?.[0];
  const accent = tier === 'diamond' ? colors.primary : colors.textMuted;
  const accentSoft = tier === 'diamond' ? colors.primarySoft : colors.surfaceAlt;
  const ctaLabel = active
    ? `Seu ${name} está ativo`
    : !available
      ? `${name} · em breve`
        : checkoutLoading
          ? 'Preparando pagamento...'
        : selected
          ? `Assinar ${name} · ${formatCurrency(selected.price)}`
          : `Assinar ${name}`;
  const ctaDisabled = Boolean(active || !available || checkoutLoading);

  return (
    <Card
      style={[
        styles.premiumCard,
        isDesktop && styles.premiumCardDesktop,
        {
          borderColor: active ? colors.primary : colors.borderStrong,
          backgroundColor: colors.surface,
        },
      ]}>
      <View pointerEvents="none" style={[styles.premiumAccent, { backgroundColor: accent }]} />

      <View style={styles.premiumHeader}>
        <View style={[styles.premiumIcon, { backgroundColor: accentSoft }]}>
          <Ionicons
            name={tier === 'diamond' ? 'diamond-outline' : 'ribbon-outline'}
            size={22}
            color={accent}
          />
        </View>
        <View style={styles.planHeading}>
          <Text style={[styles.premiumTitle, { color: colors.text }]}>{name}</Text>
          <Text style={[styles.premiumSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        <Badge label={badge} tone={active ? 'accent' : 'neutral'} />
      </View>

      <View style={[styles.premiumPromise, { backgroundColor: accentSoft }]}>
        <Text style={[styles.premiumPromiseEyebrow, { color: accent }]}>VISÃO ALÉM DO GABARITO</Text>
        <Text style={[styles.premiumPromiseTitle, { color: colors.text }]}>Saiba onde evoluiu e onde precisa insistir.</Text>
      </View>

      <View style={styles.premiumBenefits}>
        {benefits.map((benefit) => (
          <View key={benefit} style={styles.premiumBenefit}>
            <View style={[styles.premiumCheck, { backgroundColor: accentSoft }]}>
              <Ionicons name="checkmark" size={13} color={accent} />
            </View>
            <Text style={[styles.premiumBenefitText, { color: colors.text }]}>{benefit}</Text>
          </View>
        ))}
      </View>

      {available && options && selectedCycle && onSelectCycle ? (
        <>
          <Text style={[styles.premiumCycleLabel, { color: colors.textSubtle }]}>ESCOLHA O CICLO</Text>
          <View style={styles.billingOptions} accessibilityRole="radiogroup">
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
                    { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
                    checked && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.billingTop}>
                    <Text style={[styles.billingName, { color: colors.text }]}>{option.name}</Text>
                    {option.badge ? (
                      <View style={[styles.savingsBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.savingsBadgeText, { color: colors.primary }]}>{option.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.billingPrice, { color: colors.text }]}>
                    {formatCurrency(option.price)}
                    <Text style={[styles.billingPeriod, { color: colors.textMuted }]}>{` ${option.period}`}</Text>
                  </Text>
                  <Text style={[styles.billingDescription, { color: colors.textMuted }]}>{option.description}</Text>
                  <Ionicons
                    name={checked ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={checked ? colors.primary : colors.textSubtle}
                    style={styles.radio}
                  />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <View style={[styles.comingSoon, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          <View style={styles.comingSoonText}>
            <Text style={[styles.comingSoonTitle, { color: colors.text }]}>Detalhes em definição</Text>
            <Text style={[styles.comingSoonDescription, { color: colors.textMuted }]}>Preço e condições serão apresentados antes do lançamento.</Text>
          </View>
        </View>
      )}

      <Button
        label={ctaLabel}
        variant={active || !available ? 'secondary' : 'primary'}
        icon={active ? 'checkmark-circle' : available ? 'arrow-forward' : 'time-outline'}
        onPress={onSubscribe}
        disabled={ctaDisabled}
        fullWidth
      />

      <View style={styles.paymentNotice}>
        <Ionicons
          name={available ? 'shield-checkmark-outline' : 'information-circle-outline'}
          size={18}
          color={colors.textSubtle}
        />
        <Text style={[styles.paymentNoticeText, { color: colors.textMuted }]}>
          {!available
            ? 'Os benefícios são os mesmos do Platina nesta primeira definição.'
            : Platform.OS === 'web'
              ? 'Pagamento processado no ambiente seguro do Mercado Pago.'
              : 'A compra será confirmada pelo servidor antes de liberar o acesso.'}
        </Text>
      </View>
    </Card>
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
  premiumGrid: { gap: Spacing.lg },
  premiumGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  basicCard: { gap: Spacing.lg, borderWidth: 1 },
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
  premiumCard: {
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    gap: Spacing.lg,
    borderWidth: 1,
  },
  premiumCardDesktop: { flex: 1 },
  premiumAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  premiumHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  premiumIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  premiumTitle: { fontSize: FontSize.heading + 1, fontWeight: FontWeight.bold },
  premiumSubtitle: { fontSize: FontSize.small, lineHeight: 18 },
  premiumPromise: { gap: 4, padding: Spacing.lg, borderRadius: Radius.lg },
  premiumPromiseEyebrow: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  premiumPromiseTitle: { fontSize: FontSize.heading, lineHeight: 24, fontWeight: FontWeight.bold, letterSpacing: -0.2 },
  premiumBenefits: { gap: Spacing.sm + 2 },
  premiumBenefit: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  premiumCheck: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  premiumBenefitText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  premiumCycleLabel: { fontSize: FontSize.tiny, fontWeight: FontWeight.bold, letterSpacing: 0.9 },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  paymentNoticeText: { flex: 1, fontSize: FontSize.small, lineHeight: 19 },
  billingOptions: { gap: Spacing.sm },
  billingOption: {
    position: 'relative',
    gap: 3,
    padding: Spacing.md,
    paddingRight: Spacing.xxxl,
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 78,
  },
  billingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  billingName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  billingPrice: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  billingPeriod: { fontSize: FontSize.small, fontWeight: FontWeight.regular },
  billingDescription: { fontSize: FontSize.small },
  savingsBadge: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: Radius.pill },
  savingsBadgeText: { fontSize: 9, fontWeight: FontWeight.bold },
  radio: { position: 'absolute', right: Spacing.md, top: '50%', marginTop: -10 },
  comingSoon: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  comingSoonText: { flex: 1, gap: 2 },
  comingSoonTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  comingSoonDescription: { fontSize: FontSize.small, lineHeight: 19 },
  pressed: { opacity: 0.75 },
});
