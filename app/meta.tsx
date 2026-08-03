import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { MultiSelectSheet } from '@/components/ui/multi-select-sheet';
import { StackHeader } from '@/components/ui/stack-header';
import { CONTENT_MAX_WIDTH, FontSize, FontWeight, Spacing } from '@/constants/theme';
import { TARGET_GOALS } from '@/data/roles';
import { useTheme } from '@/hooks/use-theme';
import { sortConcursos } from '@/lib/concursos';
import { useApp } from '@/providers/app-provider';
import { useConcursos } from '@/providers/concursos-provider';
import type { Concurso } from '@/types';

type MetaSheet = 'role' | 'concurso' | null;

function concursoLabel(concurso: Concurso): string {
  return `${concurso.shortName} · ${concurso.title}`;
}

export default function ChooseGoalScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { concursos } = useConcursos();
  const {
    profile,
    savedConcursos,
    updateProfile,
    toggleSavedConcurso,
  } = useApp();
  const [sheet, setSheet] = useState<MetaSheet>(null);
  const [selectedRole, setSelectedRole] = useState(profile.targetRole ? [profile.targetRole] : []);
  const [selectedConcurso, setSelectedConcurso] = useState<string[]>([]);
  const availableConcursos = sortConcursos(
    concursos.filter((concurso) => concurso.status !== 'encerrado'),
    'deadline'
  );

  const closeSheet = () => {
    const closingSheet = sheet;
    setSheet(null);

    if (closingSheet === 'role' && selectedRole[0]) {
      void updateProfile({ targetRole: selectedRole[0] }).then(() => router.back());
      return;
    }

    if (closingSheet === 'concurso' && selectedConcurso[0]) {
      const concurso = availableConcursos.find(
        (item) => concursoLabel(item) === selectedConcurso[0]
      );
      if (concurso && !savedConcursos.includes(concurso.id)) {
        toggleSavedConcurso(concurso.id);
      }
      if (concurso) router.back();
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StackHeader title="Escolha sua meta" onBack={() => router.back()} center />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="flag-outline" size={25} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Como você quer começar?</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>
            Sua escolha personaliza o radar, os desafios e as recomendações do KAD.
          </Text>
        </View>

        <Card padded={false} style={styles.optionsCard}>
          <ListRow
            icon="person-outline"
            label="Cargo ou área"
            description="Receba editais e questões alinhados à carreira que você busca."
            tone="primary"
            onPress={() => setSheet('role')}
          />
          <ListRow
            icon="briefcase-outline"
            label="Concurso específico"
            description="Acompanhe primeiro um edital que já está no seu radar."
            tone="accent"
            onPress={() => setSheet('concurso')}
          />
          <ListRow
            icon="compass-outline"
            label="Ainda estou explorando"
            description="Veja oportunidades em destaque antes de escolher."
            tone="neutral"
            onPress={() => router.replace('/concursos')}
            isLast
          />
        </Card>
      </ScrollView>

      <MultiSelectSheet
        visible={sheet !== null}
        title={sheet === 'concurso' ? 'Concurso específico' : 'Cargo ou área'}
        options={
          sheet === 'concurso'
            ? availableConcursos.map(concursoLabel)
            : TARGET_GOALS
        }
        selected={sheet === 'concurso' ? selectedConcurso : selectedRole}
        onChange={sheet === 'concurso' ? setSelectedConcurso : setSelectedRole}
        onClose={closeSheet}
        selectionMode="single"
      />
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
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  introIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    fontSize: FontSize.body,
    lineHeight: 21,
    textAlign: 'center',
  },
  optionsCard: { overflow: 'hidden' },
});
