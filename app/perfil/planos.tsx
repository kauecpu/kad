import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useApp } from '@/providers/app-provider';
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
  const {
    subscription,
    isPremium,
    dailyQuestionLimit,
    dailyQuestionsAnswered,
    subscribe,
    cancelSubscription,
  } = useApp();
  const [diamondCycle, setDiamondCycle] = useState<BillingCycle>('monthly');
  const [circleCycle, setCircleCycle] = useState<BillingCycle>('monthly');

  const subscribeTo = (
    plan: Exclude<SubscriptionPlan, 'basic'>,
    cycle: BillingCycle
  ) => {
    const options = plan === 'circle' ? CIRCLE_BILLING_OPTIONS : DIAMOND_BILLING_OPTIONS;
    const billing =
      options.find((item) => item.id === cycle) ?? options[0];
    const planName = plan === 'circle' ? 'KAD Círculo' : 'KAD Diamante';
    const title = `Ativar demonstração do ${planName}`;
    const message = `Esta versão não fará nenhuma cobrança. Deseja testar o plano de ${formatCurrency(billing.price)} ${billing.period}?`;

    if (Platform.OS === 'web') {
      if (globalThis.confirm(`${title}\n\n${message}`)) subscribe(plan, cycle);
      return;
    }

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ativar demonstração', onPress: () => subscribe(plan, cycle) },
      ]
    );
  };

  const cancel = () => {
    Alert.alert(
      'Cancelar renovação',
      'Você continuará com acesso até o fim do período atual. Deseja continuar?',
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Cancelar renovação', style: 'destructive', onPress: cancelSubscription },
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Planos e assinatura" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Card style={styles.currentCard}>
          <View style={styles.currentHeader}>
            <View style={styles.currentText}>
              <Text style={[styles.eyebrow, { color: colors.textSubtle }]}>Seu plano atual</Text>
              <Text style={[styles.currentTitle, { color: colors.text }]}>
                {PLAN_LABEL[subscription.plan]}
              </Text>
              <Text style={[styles.currentDescription, { color: colors.textMuted }]}>
                {isPremium
                  ? `Acesso demonstrativo ativo até ${formatDate(subscription.renewsAt)}${subscription.autoRenew ? ' com renovação simulada.' : ' sem renovação simulada.'}`
                  : 'Gratuito, sem cobrança e com até 10 questões por dia.'}
              </Text>
            </View>
            <Badge
              label={isPremium ? 'Demonstração' : 'Grátis'}
              tone={isPremium ? 'accent' : 'neutral'}
            />
          </View>
          {isPremium ? (
            <Button
              label={subscription.autoRenew ? 'Cancelar renovação' : 'Reativar renovação'}
              variant={subscription.autoRenew ? 'danger' : 'secondary'}
              icon={subscription.autoRenew ? 'close-circle-outline' : 'refresh'}
              onPress={
                subscription.autoRenew
                  ? cancel
                  : () =>
                      subscribe(
                        subscription.plan === 'circle' ? 'circle' : 'diamond',
                        subscription.billingCycle ?? 'monthly'
                      )
              }
              fullWidth
            />
          ) : (
            <ProgressBar
              value={(dailyQuestionsAnswered / dailyQuestionLimit) * 100}
              label={`${dailyQuestionsAnswered} de ${dailyQuestionLimit} questões usadas hoje`}
            />
          )}
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
  onSubscribe: () => void;
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
                : `Testar ${title.replace('Plano ', '')} · ${formatCurrency(selected.price)}`
            }
            icon={active ? 'checkmark-circle' : 'arrow-forward'}
            size="lg"
            onPress={onSubscribe}
            disabled={active}
            fullWidth
          />
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
