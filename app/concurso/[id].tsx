import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { CONCURSO_PACKS } from '@/data/exam-concursos';
import { useTheme } from '@/hooks/use-theme';
import { deadlineInfo, findStudyPackForConcurso, STATUS_LABEL } from '@/lib/concursos';
import { formatCurrency, formatDate, formatRelativeDay } from '@/lib/format';
import { useApp } from '@/providers/app-provider';
import type { ConcursoRole } from '@/types';
import { useConcursos } from '@/providers/concursos-provider';

export default function ConcursoDetailsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { savedConcursos, toggleSavedConcurso } = useApp();
  const { concursos } = useConcursos();
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const concurso = concursos.find((item) => item.id === id);
  const saved = concurso ? savedConcursos.includes(concurso.id) : false;

  const handleToggleSave = () => {
    if (!concurso) return;
    toggleSavedConcurso(concurso.id);
    setFeedback(
      saved
        ? `${concurso.shortName} removido dos salvos.`
        : `${concurso.shortName} salvo em Meus concursos.`
    );
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2400);
  };

  if (!concurso) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TopBar onBack={() => router.back()} />
        <EmptyState
          icon="alert-circle-outline"
          title="Concurso não encontrado"
          description="O edital que você tentou abrir não está mais disponível."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const deadline = deadlineInfo(concurso);
  const iconName = (concurso.icon ?? 'business') as keyof typeof Ionicons.glyphMap;
  const iconColor = concurso.iconColor ?? colors.primary;
  const studyPack = findStudyPackForConcurso(concurso, CONCURSO_PACKS);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <TopBar
          onBack={() => router.back()}
          saved={saved}
          onToggleSave={handleToggleSave}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: `${iconColor}22` }]}>
            <Ionicons name={iconName} size={30} color={iconColor} />
          </View>
          <Badge label={STATUS_LABEL[concurso.status]} tone={deadline.tone} icon={deadline.icon} />
        </View>

        <Text style={[styles.organ, { color: colors.textMuted }]}>{concurso.organ}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{concurso.title}</Text>
        <Text style={[styles.location, { color: colors.textSubtle }]}>
          {concurso.state === 'Nacional'
            ? 'Âmbito nacional'
            : `${concurso.city ? `${concurso.city}, ` : ''}${concurso.state} · Região ${concurso.region}`}
        </Text>

        <View style={[styles.trustBanner, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.trustText, { color: colors.textMuted }]}>
            {concurso.contentSource === 'published'
              ? `Fonte oficial verificada · Atualizado ${formatRelativeDay(concurso.updatedAt)}`
              : `Dados demonstrativos · Atualizado ${formatRelativeDay(concurso.updatedAt)}`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <QuickStat icon="people-outline" value={concurso.vacancies.toLocaleString('pt-BR')} label="Vagas" />
          <QuickStat
            icon="cash-outline"
            value={formatCurrency(concurso.salaryMax)}
            label="Salário até"
          />
          <QuickStat icon="business-outline" value={concurso.board} label="Banca" />
        </View>

        <Pressable
          onPress={!saved ? handleToggleSave : () => router.push('/concursos/salvos')}
          accessibilityRole="button"
          accessibilityLabel={
            !saved
              ? 'Salvar concurso para acompanhar prazos'
              : 'Abrir Meus concursos'
          }
          style={({ pressed }) => [
            styles.alertCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <View style={[styles.alertIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons
              name={!saved ? 'notifications-outline' : 'bookmark'}
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, { color: colors.text }]}>
              {!saved
                ? 'Acompanhe os prazos'
                : 'Concurso em acompanhamento'}
            </Text>
            <Text style={[styles.alertDescription, { color: colors.textMuted }]}>
              {!saved
                ? 'Salve este concurso para acompanhar datas e novidades.'
                : 'Ele está salvo em Meus concursos para você consultar prazos e novidades.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Pressable>

        <Card style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>Prazos e inscrição</Text>
          <InfoRow label="Situação" value={STATUS_LABEL[concurso.status]} />
          <InfoRow label="Início das inscrições" value={formatDate(concurso.registrationStart)} />
          <InfoRow label="Fim das inscrições" value={formatDate(concurso.registrationEnd)} />
          <InfoRow label="Data da prova" value={formatDate(concurso.examDate)} />
          <InfoRow
            label="Taxa de inscrição"
            value={concurso.fee ? formatCurrency(concurso.fee) : '--'}
            isLast
          />
          <View style={[styles.deadlineBanner, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name={deadline.icon} size={16} color={colors.textMuted} />
            <Text style={[styles.deadlineText, { color: colors.textMuted }]}>{deadline.label}</Text>
          </View>
        </Card>

        <Card style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>
            {concurso.roles.length > 1 ? 'Cargos' : 'Cargo'}
          </Text>
          {concurso.roles.map((role, index) => (
            <RoleRow key={role.name} role={role} isLast={index === concurso.roles.length - 1} />
          ))}
        </Card>

        <Card style={styles.block}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>Destaques do edital</Text>
          {concurso.highlights.map((highlight) => (
            <View key={highlight} style={styles.highlightRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.highlightText, { color: colors.textMuted }]}>{highlight}</Text>
            </View>
          ))}
        </Card>

        {studyPack ? (
          <Button
            label="Estudar para este concurso"
            icon="school-outline"
            onPress={() => router.push(`/questoes/concurso/${studyPack.id}`)}
            fullWidth
          />
        ) : null}
        <Button
          label="Abrir página oficial"
          variant="ghost"
          icon="open-outline"
          onPress={() => Linking.openURL(concurso.editalUrl)}
          fullWidth
        />
      </ScrollView>
      <FeedbackToast message={feedback} />
    </View>
  );
}

function TopBar({
  onBack,
  saved,
  onToggleSave,
}: {
  onBack: () => void;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
        style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      {onToggleSave ? (
        <Pressable
          onPress={onToggleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar concurso'}
          hitSlop={8}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? colors.primary : colors.text}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickStat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.quickStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={[styles.quickValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.quickLabel, { color: colors.textSubtle }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function RoleRow({ role, isLast }: { role: ConcursoRole; isLast: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.roleRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}>
      <View style={styles.roleText}>
        <Text style={[styles.roleName, { color: colors.text }]}>{role.name}</Text>
        <Text style={[styles.roleMeta, { color: colors.textSubtle }]}>
          {`${role.vacancies.toLocaleString('pt-BR')} vagas · Nível ${role.level}`}
        </Text>
      </View>
      <Text style={[styles.roleSalary, { color: colors.primary }]}>{formatCurrency(role.salary)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  logo: {
    minWidth: 60,
    height: 60,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  organ: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    lineHeight: 28,
  },
  location: {
    fontSize: FontSize.small,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  trustText: { flex: 1, fontSize: FontSize.small, fontWeight: FontWeight.medium },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  quickStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  quickValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.xs,
  },
  quickLabel: {
    fontSize: FontSize.tiny,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold },
  alertDescription: { fontSize: FontSize.small, lineHeight: 18 },
  block: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  blockTitle: {
    fontSize: FontSize.heading,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  infoLabel: {
    fontSize: FontSize.body,
  },
  infoValue: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    flexShrink: 1,
    textAlign: 'right',
  },
  deadlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  deadlineText: {
    fontSize: FontSize.small,
    fontWeight: FontWeight.medium,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  roleText: {
    flex: 1,
    gap: 2,
  },
  roleName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
  },
  roleMeta: {
    fontSize: FontSize.small,
  },
  roleSalary: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 1,
  },
  highlightText: {
    flex: 1,
    fontSize: FontSize.body,
    lineHeight: 21,
  },
  pressed: { opacity: 0.72 },
});
