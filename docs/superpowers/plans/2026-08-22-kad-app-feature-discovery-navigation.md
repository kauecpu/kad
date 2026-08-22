# KAD App Feature Discovery Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor todas as funções do KAD App por uma barra inferior de cinco destinos e uma nova tela Explorar, sem alterar o KAD Site nem remover os cards de progresso da tela Início.

**Architecture:** Manter `expo-router` como navegador e usar um catálogo puro em `lib/` como fonte dos recursos exibidos em Explorar. Tornar Concursos uma tab visível, mover Perfil para a pilha em `/perfil`, redirecionar `/rank` para `/ranking` e abrir os recursos secundários como fluxos focados fora das tabs.

**Tech Stack:** Expo SDK 54, Expo Router `~6.0.24`, React Native 0.81, TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-22-kad-app-feature-discovery-navigation-design.md`

## Global Constraints

- Ler e seguir `https://docs.expo.dev/versions/v54.0.0/sdk/router/` antes de alterar código de navegação.
- Alterar somente KAD App, bibliotecas cliente compartilhadas pelo App, testes e documentação relacionada.
- Não alterar `site/`, `supabase/`, `admin/`, `.github/`, arquivos de ambiente, dependências ou infraestrutura.
- Manter cinco tabs visíveis: Início, Questões, Concursos, Simulados e Explorar, nessa ordem.
- Preservar `/perfil`, `/ranking`, `/trilhas`, `/redacao` e `/biblioteca`.
- Preservar o card roxo e os resumos atuais da tela Início.
- Suportar temas claro e escuro, movimento reduzido, foco por teclado e escala de fonte.
- Executar `npm run check` antes de concluir.

---

## File Structure

- `lib/app-feature-catalog.ts`: tipos, grupos e metadados puros dos recursos do App.
- `components/ui/feature-link-card.tsx`: card compacto acessível usado pelos recursos prioritários de Explorar.
- `app/(tabs)/explorar.tsx`: catálogo visual e entrada para Perfil.
- `app/(tabs)/_layout.tsx`: cinco tabs visíveis e rotas ocultas de compatibilidade.
- `app/(tabs)/rank.tsx`: redirecionamento de `/rank` para `/ranking`.
- `app/perfil/index.tsx`: tela de Perfil movida para a pilha, com retorno explícito.
- `app/_layout.tsx`: registra Perfil na área protegida da pilha.
- `tests/app-feature-navigation.test.ts`: contrato do catálogo, tabs, rotas e acessibilidade.

### Task 1: Catálogo puro dos recursos

**Files:**
- Create: `lib/app-feature-catalog.ts`
- Create: `tests/app-feature-navigation.test.ts`

**Interfaces:**
- Produces: `AppFeatureId`, `AppFeatureGroupId`, `AppFeature`, `APP_FEATURE_GROUPS`, `APP_FEATURES`, `featuresForGroup(group)`.
- Consumes: nenhum componente React ou React Native.

- [ ] **Step 1: Write the failing catalog test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

import {
  APP_FEATURES,
  APP_FEATURE_GROUPS,
  featuresForGroup,
} from '../lib/app-feature-catalog.ts';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

test('o catálogo apresenta todos os recursos aprovados em ordem estável', () => {
  assert.deepEqual(
    APP_FEATURES.map(({ id }) => id),
    ['questions', 'contests', 'simulations', 'ranking', 'trails', 'essay', 'library', 'profile']
  );
  assert.deepEqual(
    APP_FEATURE_GROUPS.map(({ id }) => id),
    ['practice', 'progress', 'other', 'account']
  );
});

test('cada recurso tem rota canônica, descrição e aparece em um único grupo', () => {
  assert.equal(new Set(APP_FEATURES.map(({ id }) => id)).size, APP_FEATURES.length);
  assert.equal(new Set(APP_FEATURES.map(({ href }) => href)).size, APP_FEATURES.length);
  for (const feature of APP_FEATURES) {
    assert.ok(feature.title.length > 0);
    assert.ok(feature.description.length > 0);
    assert.ok(feature.href.startsWith('/'));
    assert.equal(featuresForGroup(feature.group).filter(({ id }) => id === feature.id).length, 1);
  }
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/app-feature-catalog.ts`.

- [ ] **Step 3: Implement the catalog**

```ts
export type AppFeatureGroupId = 'practice' | 'progress' | 'other' | 'account';

export type AppFeatureId =
  | 'questions'
  | 'contests'
  | 'simulations'
  | 'ranking'
  | 'trails'
  | 'essay'
  | 'library'
  | 'profile';

export type AppFeatureIcon =
  | 'book-outline'
  | 'briefcase-outline'
  | 'timer-outline'
  | 'trophy-outline'
  | 'map-outline'
  | 'create-outline'
  | 'library-outline'
  | 'person-outline';

export type AppFeature = {
  id: AppFeatureId;
  group: AppFeatureGroupId;
  title: string;
  description: string;
  href:
    | '/questoes'
    | '/concursos'
    | '/simulados'
    | '/ranking'
    | '/trilhas'
    | '/redacao'
    | '/biblioteca'
    | '/perfil';
  icon: AppFeatureIcon;
  presentation: 'card' | 'row';
};

export const APP_FEATURE_GROUPS = [
  { id: 'practice', title: 'Praticar' },
  { id: 'progress', title: 'Acompanhar' },
  { id: 'other', title: 'Outras formas de estudar' },
  { id: 'account', title: 'Conta' },
] as const satisfies ReadonlyArray<{ id: AppFeatureGroupId; title: string }>;

export const APP_FEATURES = [
  { id: 'questions', group: 'practice', title: 'Questões', description: 'Pratique por disciplina, assunto ou concurso', href: '/questoes', icon: 'book-outline', presentation: 'card' },
  { id: 'contests', group: 'practice', title: 'Concursos', description: 'Veja concursos abertos, previstos e salvos', href: '/concursos', icon: 'briefcase-outline', presentation: 'card' },
  { id: 'simulations', group: 'practice', title: 'Simulados', description: 'Treine ritmo e formato de prova', href: '/simulados', icon: 'timer-outline', presentation: 'card' },
  { id: 'ranking', group: 'progress', title: 'Ranking', description: 'Acompanhe sua pontuação e posição', href: '/ranking', icon: 'trophy-outline', presentation: 'card' },
  { id: 'trails', group: 'other', title: 'Trilhas', description: 'Siga uma sequência de estudos', href: '/trilhas', icon: 'map-outline', presentation: 'row' },
  { id: 'essay', group: 'other', title: 'Redação', description: 'Escolha um tema e pratique sua escrita', href: '/redacao', icon: 'create-outline', presentation: 'row' },
  { id: 'library', group: 'other', title: 'Biblioteca', description: 'Materiais, flashcards e anotações', href: '/biblioteca', icon: 'library-outline', presentation: 'row' },
  { id: 'profile', group: 'account', title: 'Perfil', description: 'Conta, preferências e desempenho', href: '/perfil', icon: 'person-outline', presentation: 'row' },
] as const satisfies ReadonlyArray<AppFeature>;

export function featuresForGroup(group: AppFeatureGroupId): ReadonlyArray<AppFeature> {
  return APP_FEATURES.filter((feature) => feature.group === group);
}
```

- [ ] **Step 4: Run the catalog test**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the catalog**

```bash
git add lib/app-feature-catalog.ts tests/app-feature-navigation.test.ts
git commit -m "feat: add KAD App feature catalog"
```

### Task 2: Cinco tabs e rotas focadas

**Files:**
- Modify: `tests/app-feature-navigation.test.ts`
- Modify: `tests/ranking.test.ts`
- Modify: `tests/auth-session.test.ts`
- Modify: `tests/feedback.test.ts`
- Modify: `tests/presentation-cards.test.ts`
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/rank.tsx`
- Create: `app/(tabs)/explorar.tsx`
- Move: `app/(tabs)/perfil.tsx` to `app/perfil/index.tsx`
- Modify: `app/perfil/index.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: rotas canônicas definidas por `APP_FEATURES`.
- Produces: cinco tabs visíveis; `/perfil` como tela protegida de pilha; `/rank` como alias de `/ranking`.

- [ ] **Step 1: Add failing route and tab tests**

```ts
import { existsSync } from 'node:fs';

const tabsLayout = source('../app/(tabs)/_layout.tsx');
const rootLayout = source('../app/_layout.tsx');
const rankAlias = source('../app/(tabs)/rank.tsx');

test('a barra inferior apresenta cinco destinos na ordem aprovada', () => {
  const names = [...tabsLayout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((match) => match[1]);
  const visible = names.filter((name) => !['rank'].includes(name));
  assert.deepEqual(visible, ['inicio', 'questoes', 'concursos', 'simulados', 'explorar']);
  assert.doesNotMatch(tabsLayout, /name="concursos"[\s\S]{0,120}href:\s*null/);
  assert.doesNotMatch(tabsLayout, /name="perfil"/);
  assert.equal(existsSync(new NodeURL('../app/(tabs)/explorar.tsx', import.meta.url)), true);
});

test('Perfil sai das tabs e mantém a rota protegida', () => {
  assert.equal(existsSync(new NodeURL('../app/(tabs)/perfil.tsx', import.meta.url)), false);
  assert.equal(existsSync(new NodeURL('../app/perfil/index.tsx', import.meta.url)), true);
  assert.match(rootLayout, /Stack\.Screen name="perfil\/index"/);
  assert.match(source('../app/perfil/index.tsx'), /onBack=\{\(\) => router\.back\(\)\}/);
});

test('a rota antiga de Rank redireciona para Ranking', () => {
  assert.match(tabsLayout, /name="rank"[\s\S]{0,120}href:\s*null/);
  assert.match(rankAlias, /<Redirect href="\/ranking"/);
});
```

- [ ] **Step 2: Run the route tests and confirm the current layout fails**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: FAIL because Perfil and Rank remain visible, Concursos remains hidden, Explorar does not exist, and `app/perfil/index.tsx` is missing.

- [ ] **Step 3: Update the existing Ranking navigation contract**

Replace the obsolete bottom-tab test in `tests/ranking.test.ts` with:

```ts
test('Ranking sai da barra inferior e a rota antiga redireciona', () => {
  const visibleTabs = Array.from(
    tabsLayout.matchAll(/name="(inicio|questoes|concursos|simulados|explorar)"/g),
    (match) => match[1]
  );

  assert.deepEqual(visibleTabs, ['inicio', 'questoes', 'concursos', 'simulados', 'explorar']);
  assert.doesNotMatch(tabsLayout, /const RankTabIcon/);
  assert.match(tabsLayout, /name="rank"[\s\S]*?href:\s*null/);
  assert.match(rankTab, /<Redirect href="\/ranking"/);
});
```

- [ ] **Step 4: Move Perfil without changing its URL**

Run: `git mv "app/(tabs)/perfil.tsx" app/perfil/index.tsx`

Update the source fixture in `tests/auth-session.test.ts`, `tests/feedback.test.ts` and `tests/presentation-cards.test.ts` from:

```ts
source('../app/(tabs)/perfil.tsx')
```

to:

```ts
source('../app/perfil/index.tsx')
```

Change the existing header in `app/perfil/index.tsx` to:

```tsx
<ScreenHeader
  title="Meu KAD"
  subtitle="Dossiê do candidato"
  onBack={() => router.back()}
  backLabel="Voltar"
/>
```

The screen already owns `const router = useRouter()`, so no new navigation dependency is needed.

- [ ] **Step 5: Register Perfil inside the protected stack**

Add beside the other protected profile routes in `app/_layout.tsx`:

```tsx
<Stack.Screen name="perfil/index" options={{ headerShown: false }} />
```

- [ ] **Step 6: Replace the Rank tab body with a redirect**

```tsx
import { Redirect } from 'expo-router';

export default function RankRedirect() {
  return <Redirect href="/ranking" />;
}
```

- [ ] **Step 7: Rebuild the tab list**

In `app/(tabs)/_layout.tsx`:

1. Remove `RankTabIcon` and `ProfileTabIcon`.
2. Add icons:

```tsx
const ContestsTabIcon = tabIcon('briefcase-outline', 'briefcase');
const ExploreTabIcon = tabIcon('view-grid-outline', 'view-grid');
```

3. Declare screens in this exact order:

```tsx
<Tabs.Screen name="inicio" options={{ title: 'Início', tabBarIcon: HomeTabIcon }} />
<Tabs.Screen name="questoes" options={{ title: 'Questões', tabBarIcon: QuestionsTabIcon }} />
<Tabs.Screen name="concursos" options={{ title: 'Concursos', tabBarIcon: ContestsTabIcon }} />
<Tabs.Screen name="simulados" options={{ title: 'Simulados', tabBarIcon: SimulationsTabIcon }} />
<Tabs.Screen name="explorar" options={{ title: 'Explorar', tabBarIcon: ExploreTabIcon }} />
<Tabs.Screen name="rank" options={{ href: null }} />
```

Keep `tabBarButton: HapticTab`, `freezeOnBlur`, the active capsule, reduced-motion duration and current height.

- [ ] **Step 8: Create the initial Explore route boundary**

Create `app/(tabs)/explorar.tsx` so the tab exists before the full catalog lands:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ExploreScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Explorar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.display, fontWeight: FontWeight.bold },
});
```

- [ ] **Step 9: Run route tests and typecheck**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts tests/ranking.test.ts tests/auth-session.test.ts tests/feedback.test.ts tests/presentation-cards.test.ts`

Expected: PASS for catalog and routing assertions.

Run: `npm run typecheck`

Expected: PASS. If typed routes report `/explorar` as missing after the file exists, restart TypeScript; do not cast routes to `any`.

- [ ] **Step 10: Commit route changes**

```bash
git add app/_layout.tsx "app/(tabs)/_layout.tsx" "app/(tabs)/rank.tsx" "app/(tabs)/explorar.tsx" app/perfil/index.tsx tests/app-feature-navigation.test.ts tests/ranking.test.ts tests/auth-session.test.ts tests/feedback.test.ts tests/presentation-cards.test.ts
git commit -m "feat: reorganize KAD App primary navigation"
```

### Task 3: Card acessível de recurso

**Files:**
- Create: `components/ui/feature-link-card.tsx`
- Modify: `tests/app-feature-navigation.test.ts`

**Interfaces:**
- Consumes: `AppFeatureIcon`, texto e callback de navegação.
- Produces: `FeatureLinkCard({ icon, title, description, onPress })`.

- [ ] **Step 1: Add the failing component contract test**

```ts
test('o card de recurso expõe texto, ação e adaptação de fonte', () => {
  const card = source('../components/ui/feature-link-card.tsx');
  assert.match(card, /export function FeatureLinkCard/);
  assert.match(card, /accessibilityRole="button"/);
  assert.match(card, /accessibilityLabel=\{`\$\{title\}\. \$\{description\}`\}/);
  assert.match(card, /minHeight:\s*44/);
  assert.match(card, /flexShrink:\s*1/);
  assert.doesNotMatch(card, /numberOfLines/);
});
```

- [ ] **Step 2: Run the test and confirm the missing file failure**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: FAIL with `ENOENT` for `components/ui/feature-link-card.tsx`.

- [ ] **Step 3: Implement `FeatureLinkCard`**

```tsx
import Ionicons from '@/components/ui/app-icon';
import type { AppFeatureIcon } from '@/lib/app-feature-catalog';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, FontWeight, Radius, Spacing, cardShadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FeatureLinkCardProps = {
  icon: AppFeatureIcon;
  title: string;
  description: string;
  onPress: () => void;
};

export function FeatureLinkCard({ icon, title, description, onPress }: FeatureLinkCardProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        cardShadow(colors.shadow, 1),
        pressed && styles.pressed,
      ]}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Ionicons name="arrow-forward" size={17} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 44,
    flex: 1,
    minWidth: 0,
    position: 'relative',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: FontSize.body, fontWeight: FontWeight.bold, flexShrink: 1 },
  description: { fontSize: FontSize.small, lineHeight: 18, flexShrink: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
```

- [ ] **Step 4: Run the focused test and typecheck**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the card**

```bash
git add components/ui/feature-link-card.tsx tests/app-feature-navigation.test.ts
git commit -m "feat: add accessible KAD feature card"
```

### Task 4: Tela Explorar e integração completa

**Files:**
- Create: `app/(tabs)/explorar.tsx`
- Modify: `tests/app-feature-navigation.test.ts`
- Verify: `app/(tabs)/inicio.tsx`

**Interfaces:**
- Consumes: `APP_FEATURE_GROUPS`, `featuresForGroup`, `FeatureLinkCard`, `ListRow`, `ScreenHeader`, `useApp`, `useRouter`.
- Produces: `/explorar`, catálogo completo e acesso ao Perfil.

- [ ] **Step 1: Add failing Explore integration tests**

```ts
const explore = source('../app/(tabs)/explorar.tsx');
const home = source('../app/(tabs)/inicio.tsx');

test('Explorar renderiza o catálogo central e abre Perfil pelo avatar', () => {
  assert.match(explore, /APP_FEATURE_GROUPS/);
  assert.match(explore, /featuresForGroup/);
  assert.match(explore, /FeatureLinkCard/);
  assert.match(explore, /ListRow/);
  assert.match(explore, /accessibilityLabel="Abrir perfil"/);
  assert.match(explore, /router\.push\('\/perfil'\)/);
});

test('Explorar adapta a grade para texto ampliado e mantém tema e área segura', () => {
  assert.match(explore, /useWindowDimensions\(\)/);
  assert.match(explore, /fontScale >= 1\.35/);
  assert.match(explore, /useSafeAreaInsets\(\)/);
  assert.match(explore, /colors\.background/);
});

test('a nova navegação não remove a assinatura de progresso da Início', () => {
  assert.match(home, /intensity="strong"/);
  assert.match(home, /KadMascot/);
  assert.match(home, /colors\.brandTrace/);
});
```

- [ ] **Step 2: Run tests and confirm the Explore file failure**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts`

Expected: FAIL because the initial route boundary does not render the catalog, cards, lists, avatar or responsive grid.

- [ ] **Step 3: Implement the Explore screen**

Use the existing `ScreenHeader`, `Avatar`, `Section`, `Card`, `ListRow` and the card from Task 3. The screen must:

```tsx
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { FeatureLinkCard } from '@/components/ui/feature-link-card';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Section } from '@/components/ui/section';
import { CONTENT_MAX_WIDTH, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { APP_FEATURE_GROUPS, featuresForGroup, type AppFeature } from '@/lib/app-feature-catalog';
import { useApp } from '@/providers/app-provider';

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useApp();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const singleColumn = fontScale >= 1.35;

  const openFeature = (feature: AppFeature) => router.push(feature.href);
  const practice = featuresForGroup('practice');
  const progress = featuresForGroup('progress');
  const other = featuresForGroup('other');
  const account = featuresForGroup('account');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Explorar"
        subtitle="Tudo que você pode fazer no KAD"
        right={
          <Pressable
            onPress={() => router.push('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <Avatar name={profile.name} uri={profile.avatarUri} size={40} />
          </Pressable>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxxl }]}>
        <Section title={APP_FEATURE_GROUPS[0].title}>
          <View style={[styles.grid, singleColumn && styles.singleColumn]}>
            {practice.map((feature) => (
              <View key={feature.id} style={[styles.gridItem, singleColumn && styles.gridItemSingle]}>
                <FeatureLinkCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  onPress={() => openFeature(feature)}
                />
              </View>
            ))}
          </View>
        </Section>
        <Section title={APP_FEATURE_GROUPS[1].title}>
          {progress.map((feature) => (
            <FeatureLinkCard
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              onPress={() => openFeature(feature)}
            />
          ))}
        </Section>
        <Section title={APP_FEATURE_GROUPS[2].title}>
          <Card padded={false}>
            {other.map((feature, index) => (
              <ListRow
                key={feature.id}
                icon={feature.icon}
                label={feature.title}
                description={feature.description}
                onPress={() => openFeature(feature)}
                isLast={index === other.length - 1}
              />
            ))}
          </Card>
        </Section>
        <Section title={APP_FEATURE_GROUPS[3].title}>
          <Card padded={false}>
            {account.map((feature, index) => (
              <ListRow
                key={feature.id}
                icon={feature.icon}
                label={feature.title}
                description={feature.description}
                onPress={() => openFeature(feature)}
                isLast={index === account.length - 1}
              />
            ))}
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    gap: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  singleColumn: { flexDirection: 'column' },
  gridItem: { flexBasis: '46%', flexGrow: 1, minWidth: 0 },
  gridItemSingle: { flexBasis: '100%' },
  pressed: { opacity: 0.72 },
});
```

- [ ] **Step 4: Run focused tests and typecheck**

Run: `node --no-warnings --test tests/app-feature-navigation.test.ts tests/home-focus.test.ts tests/kad-progress-identity.test.ts tests/motion-navigation-progress.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS without route casts.

- [ ] **Step 5: Run the full repository check**

Run: `npm run check`

Expected: all tests, TypeScript and Expo lint PASS.

- [ ] **Step 6: Perform visual and interaction QA**

Run: `npm run web -- --port 8081`

Validate in the local preview:

- 390 px: five tabs fit without truncation; Concursos and Explorar are visible.
- 390 px: Explorar shows every approved resource and Profile.
- 390 px with large font: cards become one column and no text overlaps.
- 768 px: the same App navigation remains usable; no sidebar is introduced.
- Light and dark themes: text and icons keep readable contrast.
- Keyboard: focus reaches every entry in visual order and remains visible.
- Reduced motion: tab changes finish without delayed actions.
- Início: the large purple card and progress cards remain in place.
- Explore to each focused route: Back returns to Explore.
- Direct `/perfil`, `/ranking`, `/trilhas`, `/redacao` and `/biblioteca`: each route opens.

- [ ] **Step 7: Commit the Explore screen**

```bash
git add "app/(tabs)/explorar.tsx" tests/app-feature-navigation.test.ts
git commit -m "feat: add KAD App Explore catalog"
```

## Final Verification

- [ ] Run `npm run check` from a clean command invocation.
- [ ] Run `git diff --check origin/main...HEAD`.
- [ ] Confirm `git status --short` contains only known unrelated untracked files and `.superpowers/` mockups.
- [ ] Review `git diff --stat origin/main...HEAD` and confirm no path under `site/` changed.
- [ ] Request code review before push.
- [ ] Push `codex/adaptive-kad-navigation` and open one PR to `main`; do not merge it.
