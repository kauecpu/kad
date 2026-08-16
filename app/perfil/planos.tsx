import Ionicons from '@/components/ui/app-icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  BASIC_PLAN_ACCESS,
  CIRCLE_BENEFITS,
  CIRCLE_BILLING_OPTIONS,
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

export default function PlansScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const { session } = useAuth();
  const {
    subscription,
    isPremium,
    dailyQuestionLimit,
    dailyQuestionsAnswered,
    subscribe,
    cancelSubscription,
    refreshSubscription,
    subscriptionLoading,
  } = useApp();
  const [diamondCycle, setDiamondCycle] = useState<BillingCycle>('monthly');
  const [circleCycle, setCircleCycle] = useState<BillingCycle>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [checkoutReturned, setCheckoutReturned] = useState(false);

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
    : 'Gratuito, sem cobrança e com até 10 questões por dia.';
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

        <Card style={styles.currentCard}>
          <View style={styles.currentHeader}>
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
          ) : !isPremium ? (
            <ProgressBar
              value={(dailyQuestionsAnswered / dailyQuestionLimit) * 100}
              label={`${dailyQuestionsAnswered} de ${dailyQuestionLimit} questões usadas hoje`}
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

        <PlanSection
          title="Plano Básico"
          subtitle="O essencial para começar"
          badge="Grátis"
          icon="book-outline">
          {BASIC_PLAN_ACCESS.map((feature) => (
            <Benefit
              key={feature.label}
              label={feature.label}
              included={feature.included}
              color={feature.included ? colors.success : colors.textSubtle}
            />
          ))}
          <View style={[styles.freeNotice, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.freeNoticeText, { color: colors.textMuted }]}>
              Sempre disponível sem cartão ou cobrança.
            </Text>
          </View>
        </PlanSection>

        <PaidPlanSection
          title="KAD Diamante"
          subtitle="Tudo para estudar com ritmo e direção."
          mark="letter"
          accent={colors.primary}
          softAccent={colors.primarySoft}
          benefits={DIAMOND_BENEFITS}
          options={DIAMOND_BILLING_OPTIONS}
          selectedCycle={diamondCycle}
          onSelectCycle={setDiamondCycle}
          active={subscription.plan === 'diamond' && isPremium}
          onSubscribe={() => subscribeTo('diamond', diamondCycle)}
          checkoutLoading={checkoutLoading}
        />

        <PaidPlanSection
          title="KAD Círculo"
          subtitle="Quatro pessoas, cada uma no seu ritmo."
          mark="group"
          badge="25% OFF"
          accent={colors.primary}
          softAccent={colors.primarySoft}
          benefits={CIRCLE_BENEFITS}
          options={CIRCLE_BILLING_OPTIONS}
          selectedCycle={circleCycle}
          onSelectCycle={setCircleCycle}
          active={subscription.plan === 'circle' && isPremium}
          onSubscribe={() => subscribeTo('circle', circleCycle)}
          available={false}
        />

      </ScrollView>
    </View>
  );
}

function PlanSection({
  title,
  subtitle,
  badge,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={styles.planCard}>
      <View style={styles.planHeader}>
        <View style={styles.planIcon}>
          <Ionicons name={icon} size={20} color={colors.textMuted} />
        </View>
        <View style={styles.planHeading}>
          <Text style={[styles.planTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.planSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        <Badge label={badge} tone="neutral" />
      </View>
      <View style={styles.benefits}>{children}</View>
    </Card>
  );
}

function Benefit({
  label,
  included = true,
  color,
}: {
  label: string;
  included?: boolean;
  color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.benefit}>
      <Ionicons
        name={included ? 'checkmark-circle' : 'close-circle-outline'}
        size={18}
        color={color}
      />
      <Text style={[styles.benefitText, { color: included ? colors.textMuted : colors.textSubtle }]}>
        {label}
      </Text>
    </View>
  );
}

type BillingOption = {
  id: BillingCycle;
  name: string;
  originalPrice?: number;
  price: number;
  period: string;
  description: string;
  badge?: string;
};

function PaidPlanSection({
  title,
  subtitle,
  mark,
  badge,
  accent,
  softAccent,
  benefits,
  options,
  selectedCycle,
  onSelectCycle,
  active,
  onSubscribe,
  checkoutLoading = false,
  available = true,
}: {
  title: string;
  subtitle: string;
  mark: 'letter' | 'group';
  badge?: string;
  accent: string;
  softAccent: string;
  benefits: string[];
  options: readonly BillingOption[];
  selectedCycle: BillingCycle;
  onSelectCycle: (cycle: BillingCycle) => void;
  active: boolean;
  onSubscribe: () => void | Promise<void>;
  checkoutLoading?: boolean;
  available?: boolean;
}) {
  const { colors } = useTheme();
  const selected = options.find((option) => option.id === selectedCycle) ?? options[0];

  return (
    <Card style={styles.planCard}>
      <View style={styles.planHeader}>
        <View style={styles.planIcon}>
          {mark === 'letter' ? (
            <Text style={[styles.kadMark, { color: accent }]} accessible={false}>
              K
            </Text>
          ) : (
            <Ionicons name="people-outline" size={22} color={accent} />
          )}
        </View>
        <View style={styles.planHeading}>
          <Text style={[styles.planTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.planSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        {!available ? (
          <Badge label="Em breve" tone="warning" icon="time-outline" />
        ) : active ? (
          <Badge label="Ativo" tone="success" />
        ) : badge ? (
          <Badge label={badge} tone="accent" />
        ) : null}
      </View>

      <View style={styles.benefits}>
        {benefits.map((benefit) => (
          <Benefit key={benefit} label={benefit} color={accent} />
        ))}
      </View>

      {available ? (
        <>
          <Text style={[styles.eyebrow, { color: colors.textSubtle }]}>Período do plano</Text>
          <View style={styles.billingOptions}>
            {options.map((option) => {
              const checked = option.id === selectedCycle;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => onSelectCycle(option.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  accessibilityLabel={
                    option.originalPrice
                      ? `${option.name}: de ${formatCurrency(option.originalPrice)} por ${formatCurrency(option.price)} ${option.period}`
                      : `${option.name}: ${formatCurrency(option.price)} ${option.period}`
                  }
                  style={({ pressed }) => [
                    styles.billingOption,
                    {
                      backgroundColor: checked ? softAccent : colors.surfaceAlt,
                      borderColor: checked ? accent : colors.border,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.billingTop}>
                    <Text style={[styles.billingName, { color: colors.text }]}>{option.name}</Text>
                    {option.badge ? <Badge label={option.badge} tone="accent" /> : null}
                  </View>
                  {option.originalPrice ? (
                    <Text style={[styles.originalPrice, { color: colors.textSubtle }]}> 
                      {`De ${formatCurrency(option.originalPrice)}`}
                    </Text>
                  ) : null}
                  <Text style={[styles.billingPrice, { color: colors.text }]}> 
                    {option.originalPrice ? 'Por ' : ''}
                    {formatCurrency(option.price)}
                    <Text style={[styles.billingPeriod, { color: colors.textMuted }]}> 
                      {` ${option.period}`}
                    </Text>
                  </Text>
                  <Text style={[styles.billingDescription, { color: colors.textMuted }]}>
                    {option.description}
                  </Text>
                  <Ionicons
                    name={checked ? 'radio-button-on' : 'radio-button-off'}
                    size={21}
                    color={checked ? accent : colors.textSubtle}
                    style={styles.radio}
                  />
                </Pressable>
              );
            })}
          </View>

          <Button
            label={
              active
                ? `${title} já está ativo`
                : checkoutLoading
                  ? 'Preparando pagamento...'
                  : Platform.OS === 'web'
                    ? `Assinar ${title.replace('Plano ', '')} · ${formatCurrency(selected.price)}`
                    : 'Pagamento móvel em breve'
            }
            icon={active ? 'checkmark-circle' : checkoutLoading ? 'time-outline' : 'arrow-forward'}
            size="lg"
            onPress={onSubscribe}
            disabled={active || checkoutLoading || Platform.OS !== 'web'}
            fullWidth
          />
          <View style={[styles.paymentNotice, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons
              name={Platform.OS === 'web' ? 'shield-checkmark-outline' : 'phone-portrait-outline'}
              size={18}
              color={colors.textMuted}
            />
            <Text style={[styles.paymentNoticeText, { color: colors.textMuted }]}>
              {Platform.OS === 'web'
                ? 'Pix e cartão são processados no ambiente seguro do Mercado Pago. A disponibilidade da renovação via Pix depende do banco e da conta.'
                : 'A compra pelo aplicativo será liberada após a configuração da Apple App Store e do Google Play.'}
            </Text>
          </View>
        </>
      ) : (
        <View style={[styles.freeNotice, { backgroundColor: colors.surfaceAlt }]}> 
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.freeNoticeText, { color: colors.textMuted }]}> 
            O gerenciamento de quatro acessos ainda está em preparação.
          </Text>
        </View>
      )}
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
  currentCard: { gap: Spacing.md },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  currentText: { flex: 1, gap: 3 },
  eyebrow: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.semibold,
  },
  currentTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  currentDescription: { fontSize: FontSize.small, lineHeight: 19 },
  planCard: { gap: Spacing.lg },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  planHeading: { flex: 1, gap: 2 },
  planTitle: {
    fontSize: FontSize.heading + 1,
    fontWeight: FontWeight.bold,
  },
  planSubtitle: { fontSize: FontSize.small, lineHeight: 18 },
  planIcon: {
    width: 22,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kadMark: {
    fontSize: 23,
    lineHeight: 25,
    fontWeight: FontWeight.bold,
    letterSpacing: -1.5,
  },
  benefits: { gap: Spacing.sm },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  benefitText: { flex: 1, fontSize: FontSize.small, lineHeight: 20 },
  freeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  freeNoticeText: { flex: 1, fontSize: FontSize.small },
  checkoutNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  checkoutNoticeText: { flex: 1, gap: 3 },
  checkoutNoticeTitle: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
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
  },
  billingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  billingName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold },
  billingPrice: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
  },
  originalPrice: {
    fontSize: FontSize.small,
    textDecorationLine: 'line-through',
  },
  billingPeriod: { fontSize: FontSize.small, fontWeight: FontWeight.regular },
  billingDescription: { fontSize: FontSize.small },
  radio: { position: 'absolute', right: Spacing.md, top: '50%', marginTop: -10 },
  pressed: { opacity: 0.75 },
});
