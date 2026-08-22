# KAD Progress Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fortalecer a identidade visual do KAD App com uma assinatura de progresso reconhecível, aplicada ao próximo passo da tela inicial e ao estado ativo da navegação inferior, sem alterar dados, rotas ou a simplicidade do produto.

**Architecture:** A mudança fica na camada de apresentação. Novos tokens semânticos sustentam claro/escuro; uma função pura traduz a rota da ação principal em pose/tom; um componente decorativo desenha o traço ascendente; e o `FeaturedCard` ganha uma variante opt-in. A Home compõe essas peças com dados existentes, enquanto a tab bar reaproveita o mesmo valor animado do ícone para revelar a cápsula ativa.

**Tech Stack:** Expo SDK 54, Expo Router 6, React 19, React Native 0.81, TypeScript, `expo-linear-gradient`, React Native Animated, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-22-kad-progress-identity-design.md`

## Global Constraints

- Trabalhar somente na branch `codex/strengthen-kad-identity`, nunca em `main`.
- Ler antes de codificar a documentação versionada do Expo SDK 54 para [Expo Router](https://docs.expo.dev/versions/v54.0.0/sdk/router/) e [LinearGradient](https://docs.expo.dev/versions/v54.0.0/sdk/linear-gradient/).
- Não alterar `site/`, `supabase/`, `admin/`, `.github/`, ambiente, infraestrutura, autenticação, rotas ou regras de negócio.
- Não adicionar dependências, fontes, imagens, progresso fictício, estado persistido nem requisições.
- Preservar os arquivos não rastreados preexistentes e nunca incluí-los nos commits.
- Manter o `FeaturedCard` atual como `intensity="standard"` implícito para todas as telas existentes.
- Respeitar redução de movimento, texto dinâmico, temas claro/escuro e alvos mínimos de 44 pt/48 dp.
- Executar `npm run check` antes do push; fazer commit, push e abrir um único PR para `main`; não fazer merge.

---

## Task 1: Registrar baseline e validar o ambiente de execução

**Files:**

- Read: `AGENTS.md`
- Read: `package.json`
- Read: `docs/superpowers/specs/2026-08-22-kad-progress-identity-design.md`
- Read: official Expo SDK 54 documentation linked above
- Inspect: `app/(tabs)/inicio.tsx`
- Inspect: `app/(tabs)/_layout.tsx`
- Inspect: `components/ui/featured-card.tsx`

- [ ] **Step 1: Confirmar branch e preservar a árvore de trabalho**

Run:

```powershell
git status --short --branch
git log -1 --oneline
```

Expected: branch `codex/strengthen-kad-identity`, um commit de especificação à frente de `origin/main`, e somente os arquivos não rastreados preexistentes fora do escopo.

- [ ] **Step 2: Ler a documentação exata do Expo SDK 54**

Confirmar os contratos de `Tabs`/Expo Router e `LinearGradient`. Não migrar APIs nem alterar versões.

- [ ] **Step 3: Rodar os testes focados antes da mudança**

Run:

```powershell
node --no-warnings --test tests/home-presentation.test.ts tests/home-focus.test.ts tests/presentation-cards.test.ts tests/ranking.test.ts tests/motion-navigation-progress.test.ts
```

Expected: PASS. Se falhar antes de qualquer edição, diagnosticar e separar a falha preexistente do escopo.

- [ ] **Step 4: Capturar o baseline visual**

Iniciar `npm run web`, abrir `/inicio` e registrar imagens temporárias — fora do Git — em 390 px, 768 px e largura ampla, ao menos no tema atualmente ativo. Anotar qualquer sobreposição ou quebra já existente.

---

## Task 2: Criar os contratos semânticos de tema e apresentação

**Files:**

- Modify: `constants/theme.ts`
- Modify: `lib/home-presentation.ts`
- Modify: `tests/home-presentation.test.ts`
- Create: `tests/kad-progress-identity.test.ts`

- [ ] **Step 1: Escrever os testes falhos do mapeamento visual**

Adicionar a `tests/home-presentation.test.ts`:

```ts
import {
  getHomePrimaryAction,
  getHomePrimaryVisual,
} from '../lib/home-presentation.ts';

test('a apresentação da ação principal deriva somente da rota real', () => {
  assert.deepEqual(getHomePrimaryVisual({ route: '/meta' }), {
    mascot: 'goal',
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes' }), {
    mascot: 'practice',
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado' }), {
    mascot: 'simulation',
    tone: 'brand',
  });
  assert.deepEqual(getHomePrimaryVisual({ route: '/questoes/simulado/resultado' }), {
    mascot: 'simulation',
    tone: 'achievement',
  });
});
```

- [ ] **Step 2: Escrever os testes falhos dos tokens e contraste**

Criar `tests/kad-progress-identity.test.ts` importando `Colors` e verificando, nos dois temas, a presença de:

```ts
const semanticTokens = [
  'brandSurfaceStrong',
  'brandSurfaceDeep',
  'onBrand',
  'onBrandMuted',
  'brandTrace',
  'tabActiveSurface',
] as const;
```

No mesmo teste, usar uma pequena função WCAG de luminância para afirmar contraste mínimo `>= 4.5` de `onBrand` e `onBrandMuted` contra `brandSurfaceStrong` e `brandSurfaceDeep`. O helper deve aceitar apenas hex de seis dígitos; `brandTrace` não entra no cálculo porque é decorativo e usa RGBA.

- [ ] **Step 3: Confirmar que os novos testes falham pela razão correta**

Run:

```powershell
node --no-warnings --test tests/home-presentation.test.ts tests/kad-progress-identity.test.ts
```

Expected: FAIL porque `getHomePrimaryVisual` e os seis tokens ainda não existem.

- [ ] **Step 4: Implementar o mapeamento visual puro**

Adicionar a `lib/home-presentation.ts`, sem mudar `getHomePrimaryAction`:

```ts
export type HomePrimaryVisual = {
  mascot: 'goal' | 'practice' | 'simulation';
  tone: 'brand' | 'achievement';
};

export function getHomePrimaryVisual(
  action: Pick<HomePrimaryAction, 'route'>
): HomePrimaryVisual {
  switch (action.route) {
    case '/meta':
      return { mascot: 'goal', tone: 'brand' };
    case '/questoes':
      return { mascot: 'practice', tone: 'brand' };
    case '/questoes/simulado':
      return { mascot: 'simulation', tone: 'brand' };
    case '/questoes/simulado/resultado':
      return { mascot: 'simulation', tone: 'achievement' };
  }
}
```

- [ ] **Step 5: Adicionar os tokens aos dois temas**

Adicionar a `constants/theme.ts` sem substituir tokens existentes:

```ts
// light
brandSurfaceStrong: '#6D28D9',
brandSurfaceDeep: '#42158B',
onBrand: '#FFFFFF',
onBrandMuted: '#F3EEFF',
brandTrace: 'rgba(255, 255, 255, 0.18)',
tabActiveSurface: '#F3EEFF',

// dark
brandSurfaceStrong: '#6D28D9',
brandSurfaceDeep: '#2E1065',
onBrand: '#FFFFFF',
onBrandMuted: '#F3EEFF',
brandTrace: 'rgba(255, 255, 255, 0.18)',
tabActiveSurface: '#251F3D',
```

- [ ] **Step 6: Rodar testes e typecheck focados**

Run:

```powershell
node --no-warnings --test tests/home-presentation.test.ts tests/kad-progress-identity.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commitar o contrato de apresentação**

```powershell
git add constants/theme.ts lib/home-presentation.ts tests/home-presentation.test.ts tests/kad-progress-identity.test.ts
git commit -m "feat: add progress identity presentation tokens"
```

---

## Task 3: Construir a assinatura angular e a intensidade forte do FeaturedCard

**Files:**

- Create: `components/ui/kad-progress-signature.tsx`
- Modify: `components/ui/featured-card.tsx`
- Modify: `tests/presentation-cards.test.ts`
- Modify: `tests/kad-progress-identity.test.ts`

- [ ] **Step 1: Escrever os testes falhos da nova assinatura**

Em `tests/kad-progress-identity.test.ts`, ler os fontes e exigir:

```ts
assert.match(progressSignature, /export function KadProgressSignature/);
assert.match(progressSignature, /pointerEvents="none"/);
assert.match(progressSignature, /accessibilityElementsHidden/);
assert.match(progressSignature, /importantForAccessibility="no-hide-descendants"/);
assert.equal(progressSignature.match(/styles\.rail/g)?.length, 2);
assert.match(progressSignature, /colors\.brandTrace/);
```

Em `tests/presentation-cards.test.ts`, preservar as expectativas atuais do modo padrão e adicionar:

```ts
assert.match(featuredCard, /intensity\?: 'standard' \| 'strong'/);
assert.match(featuredCard, /artwork\?: ReactNode/);
assert.match(featuredCard, /intensity = 'standard'/);
assert.match(featuredCard, /<KadProgressSignature/);
assert.match(featuredCard, /colors\.brandSurfaceDeep/);
assert.match(featuredCard, /colors\.brandSurfaceStrong/);
```

- [ ] **Step 2: Confirmar a falha esperada**

Run:

```powershell
node --no-warnings --test tests/presentation-cards.test.ts tests/kad-progress-identity.test.ts
```

Expected: FAIL porque o componente e as novas props ainda não existem.

- [ ] **Step 3: Criar o componente decorativo sem semântica de dados**

Implementar `components/ui/kad-progress-signature.tsx` com duas faixas ascendentes, sem SVG nem animação:

```tsx
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type KadProgressSignatureProps = {
  style?: StyleProp<ViewStyle>;
};

export function KadProgressSignature({ style }: KadProgressSignatureProps) {
  const { colors } = useTheme();

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.frame, style]}>
      <View style={[styles.rail, styles.railWide, { backgroundColor: colors.brandTrace }]} />
      <View style={[styles.rail, styles.railThin, { backgroundColor: colors.brandTrace }]} />
    </View>
  );
}
```

Os estilos devem manter as faixas no quadrante direito, rotacionadas aproximadamente `-28deg`, com opacidades diferentes, recortadas pelo card e sem cobrir o conteúdo.

- [ ] **Step 4: Estender o FeaturedCard de forma opt-in**

Adicionar às props:

```ts
type FeaturedCardIntensity = 'standard' | 'strong';

intensity?: FeaturedCardIntensity;
artwork?: ReactNode;
```

No componente:

```ts
const strong = intensity === 'strong';
const surfaceColors = strong
  ? ([colors.brandSurfaceDeep, colors.brandSurfaceStrong] as const)
  : ([soft, colors.surface, colors.surface] as const);
const foreground = strong ? colors.onBrand : colors.text;
const mutedForeground = strong ? colors.onBrandMuted : colors.textMuted;
```

Requisitos de composição:

- `intensity` deve ter default `standard`.
- O gradiente padrão deve continuar literalmente com `[soft, colors.surface, colors.surface]` para não alterar as outras telas.
- O modo forte deve renderizar `KadProgressSignature` atrás do conteúdo.
- No modo forte, organizar conteúdo e `artwork` em uma linha flexível: conteúdo com `flex: 1; minWidth: 0`, arte com largura limitada e `flexShrink: 0`. Não posicionar o mascote sobre o texto.
- Em telas estreitas, reduzir a coluna da arte via `useWindowDimensions`, nunca esconder dados nem truncar o CTA.
- Aplicar `onBrand` ao título/ícone/CTA e `onBrandMuted` à descrição; o tom `achievement` continua selecionando o acento de conquista, mas não cria outra hierarquia de card.
- Manter `PressFeedback`, estado desabilitado, label de acessibilidade e o comportamento dos cards padrões.

- [ ] **Step 5: Rodar testes focados e typecheck**

Run:

```powershell
node --no-warnings --test tests/presentation-cards.test.ts tests/kad-progress-identity.test.ts tests/motion-foundation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commitar o componente reutilizável**

```powershell
git add components/ui/kad-progress-signature.tsx components/ui/featured-card.tsx tests/presentation-cards.test.ts tests/kad-progress-identity.test.ts
git commit -m "feat: add strong KAD progress card"
```

---

## Task 4: Aplicar a identidade forte somente ao próximo passo da Home

**Files:**

- Modify: `app/(tabs)/inicio.tsx`
- Modify: `tests/home-focus.test.ts`
- Modify: `tests/presentation-cards.test.ts`

- [ ] **Step 1: Escrever os testes falhos de integração da Home**

Adicionar aos testes de fonte:

```ts
assert.match(home, /getHomePrimaryVisual\(primaryAction\)/);
assert.match(home, /intensity="strong"/);
assert.match(home, /tone=\{primaryVisual\.tone\}/);
assert.match(home, /artwork=\{[\s\S]*?<KadMascot/);
assert.match(home, /variant=\{primaryVisual\.mascot\}/);
assert.match(home, /active=\{false\}/);
assert.match(home, /color=\{colors\.onBrand\}/);
assert.equal(home.match(/<FeaturedCard/g)?.length, 1);
```

- [ ] **Step 2: Confirmar a falha esperada**

Run:

```powershell
node --no-warnings --test tests/home-focus.test.ts tests/presentation-cards.test.ts
```

Expected: FAIL porque a Home ainda não usa o mapper, mascote ou intensidade forte.

- [ ] **Step 3: Compor o herói com os dados reais existentes**

Em `app/(tabs)/inicio.tsx`:

```tsx
const primaryAction = getHomePrimaryAction(/* dados atuais, sem mudança */);
const primaryVisual = getHomePrimaryVisual(primaryAction);
const primaryArtworkSize = width < 420 ? 96 : width < 768 ? 112 : 128;
```

Aplicar somente no `FeaturedCard` principal:

```tsx
<FeaturedCard
  intensity="strong"
  tone={primaryVisual.tone}
  artwork={
    <KadMascot
      variant={primaryVisual.mascot}
      size={primaryArtworkSize}
      active={false}
    />
  }
  // preservar icon, eyebrow, title, description, route, CTA e acessibilidade atuais
>
  {primaryAction.progress !== undefined ? (
    <ProgressBar
      value={primaryAction.progress}
      color={colors.onBrand}
      label={`Progresso do simulado: ${Math.round(primaryAction.progress)}%`}
    />
  ) : null}
</FeaturedCard>
```

Usar o `width` já disponível na tela ou `useWindowDimensions`; não criar listener manual. O mascote permanece decorativo pelo contrato do próprio componente. Nenhum outro card da Home recebe `intensity="strong"`.

- [ ] **Step 4: Rodar os testes focados**

Run:

```powershell
node --no-warnings --test tests/home-presentation.test.ts tests/home-focus.test.ts tests/presentation-cards.test.ts tests/mascot-presentation.test.ts tests/motion-navigation-progress.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commitar a integração da Home**

```powershell
git add "app/(tabs)/inicio.tsx" tests/home-focus.test.ts tests/presentation-cards.test.ts
git commit -m "feat: highlight the next KAD study step"
```

---

## Task 5: Tornar o estado ativo da tab bar inequívoco

**Files:**

- Modify: `app/(tabs)/_layout.tsx`
- Modify: `tests/ranking.test.ts`
- Modify: `tests/kad-progress-identity.test.ts`

- [ ] **Step 1: Escrever os testes falhos do estado ativo**

Preservar o teste de ordem das cinco tabs e acrescentar contratos de fonte:

```ts
assert.match(tabsLayout, /styles\.tabActiveCapsule/);
assert.match(tabsLayout, /backgroundColor: colors\.tabActiveSurface/);
assert.match(tabsLayout, /opacity: active/);
assert.match(tabsLayout, /function TabLabel/);
assert.match(tabsLayout, /focused \? colors\.tabActive : colors\.tabInactive/);
assert.match(tabsLayout, /focused \? FontWeight\.semibold : FontWeight\.medium/);
```

O teste existente deve continuar garantindo a ordem `inicio`, `questoes`, `rank`, `simulados`, `perfil`, o ícone estável `RankTabIcon` e `concursos` oculto.

- [ ] **Step 2: Confirmar a falha esperada**

Run:

```powershell
node --no-warnings --test tests/ranking.test.ts tests/kad-progress-identity.test.ts
```

Expected: FAIL porque a cápsula e o label focado ainda não existem.

- [ ] **Step 3: Reaproveitar a animação existente para a cápsula**

Dentro da fábrica `tabIcon`, manter as duas camadas outline/filled e inserir atrás delas:

```tsx
<Animated.View
  pointerEvents="none"
  style={[
    styles.tabActiveCapsule,
    { backgroundColor: colors.tabActiveSurface, opacity: active },
  ]}
/>
```

Não criar outro `Animated.Value`, timeout ou animação contínua. O mesmo `active` continua controlando o crossfade do ícone e passa a controlar a cápsula.

- [ ] **Step 4: Extrair um label estável que respeite foco**

Criar fora de `MainLayout`:

```tsx
function TabLabel({ children, focused }: { children: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        styles.tabLabel,
        {
          color: focused ? colors.tabActive : colors.tabInactive,
          fontWeight: focused ? FontWeight.semibold : FontWeight.medium,
        },
      ]}>
      {children}
    </Text>
  );
}
```

Usar `tabBarLabel: TabLabel`, mantendo as funções de ícone em escopo de módulo. A cápsula deve medir aproximadamente 40 × 30, ficar centralizada atrás do glifo e não alterar a altura da barra nem o alvo do `HapticTab`.

- [ ] **Step 5: Rodar testes focados e typecheck**

Run:

```powershell
node --no-warnings --test tests/ranking.test.ts tests/kad-progress-identity.test.ts tests/theme-responsiveness.test.ts tests/motion-foundation.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commitar a navegação ativa**

```powershell
git add "app/(tabs)/_layout.tsx" tests/ranking.test.ts tests/kad-progress-identity.test.ts
git commit -m "feat: clarify active KAD navigation state"
```

---

## Task 6: Verificar visual, acessibilidade e responsividade

**Files:**

- Modify only if verification finds an in-scope defect in the files above
- Do not commit screenshots or unrelated generated output

- [ ] **Step 1: Rodar toda a verificação automatizada**

Run:

```powershell
npm run check
```

Expected: todos os testes, typecheck e lint passam, com exit code 0.

- [ ] **Step 2: Abrir o app web e testar os estados reais da Home**

Com `npm run web`, verificar `/inicio` em:

- 390 px: nenhum texto/CTA encoberto, mascote menor, tabs legíveis.
- 768 px: composição equilibrada e sem espaço morto excessivo.
- largura ampla: conteúdo contido, arte sem esticar e assinatura ainda discreta.
- temas claro e escuro: título, descrição, progresso, CTA e tab ativa legíveis.
- rotas/estados disponíveis: meta ausente, prática, simulado em andamento e resultado concluído, sem inventar dados para produção.

- [ ] **Step 3: Verificar interação e acessibilidade**

- Navegar por teclado no web e confirmar foco visível e ordem lógica.
- Confirmar que trocar de tema não bloqueia toque/clique e atualiza o herói e a tab ativa no mesmo frame perceptível.
- Confirmar que assinatura e mascote decorativos não entram na árvore acessível.
- Ativar redução de movimento e confirmar estado final imediato, sem animação contínua.
- Confirmar que os cinco alvos da tab bar mantêm dimensões mínimas e que nenhuma label troca de largura de forma destrutiva.

- [ ] **Step 4: Comparar antes/depois**

Capturar imagens temporárias nos mesmos três breakpoints do baseline. Manter os arquivos fora do commit; usá-los no handoff/PR somente se a interface permitir hospedagem ou anexo real.

- [ ] **Step 5: Corrigir somente defeitos observados e repetir os checks**

Para cada correção, primeiro adicionar/ajustar um teste quando o comportamento for automatizável. Depois rodar o teste focado e novamente:

```powershell
npm run check
```

Expected: PASS depois da última edição.

- [ ] **Step 6: Commitar eventuais ajustes de QA**

Somente se houver mudanças:

```powershell
git add constants/theme.ts lib/home-presentation.ts components/ui/kad-progress-signature.tsx components/ui/featured-card.tsx "app/(tabs)/inicio.tsx" "app/(tabs)/_layout.tsx" tests
git commit -m "fix: polish KAD progress identity responsiveness"
```

Antes do commit, conferir `git diff --cached --name-only` e retirar qualquer arquivo fora do escopo.

---

## Task 7: Revisar, publicar a branch e abrir o único PR

**Files:**

- Review: all committed diff against `origin/main`
- No production changes unless review identifies a concrete defect

- [ ] **Step 1: Fazer revisão final do diff**

Usar `superpowers:requesting-code-review` e revisar também manualmente:

```powershell
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short --branch
```

Confirmar: nenhuma mudança em `site/`, `supabase/`, `admin/`, `.github/` ou arquivos não rastreados do usuário; nenhum segredo; nenhum dado/rota alterado.

- [ ] **Step 2: Aplicar achados válidos e verificar novamente**

Se a revisão encontrar defeito, escrever teste falho, corrigir, rodar `npm run check` e criar um commit específico. Não aceitar sugestões que expandam o escopo aprovado.

- [ ] **Step 3: Executar a verificação final imediatamente antes de publicar**

Usar `superpowers:verification-before-completion` e rodar:

```powershell
npm run check
git diff --check origin/main...HEAD
git status --short --branch
```

Registrar os outputs reais para o resumo do PR.

- [ ] **Step 4: Fazer push da branch**

```powershell
git push -u origin codex/strengthen-kad-identity
```

- [ ] **Step 5: Abrir um único Pull Request para `main`**

```powershell
gh pr create --base main --head codex/strengthen-kad-identity --title "feat: fortalecer identidade visual do KAD App" --body "## Resumo`n- destaca o próximo passo com a assinatura de progresso do KAD`n- associa o mascote ao estado real da jornada`n- torna a tab ativa inequívoca nos temas claro e escuro`n`n## Escopo preservado`n- sem mudanças em dados, rotas, dependências, Site ou backend`n`n## Verificação`n- npm run check`n- QA web em 390 px, 768 px e largura ampla`n- temas claro/escuro, teclado e redução de movimento"
```

O corpo do PR deve conter:

- problema: hierarquia visual fraca e estado ativo pouco inequívoco;
- solução: herói de progresso, assinatura angular, mascote contextual e cápsula ativa;
- escopo preservado: sem dados, rotas, dependências, Site ou backend;
- testes executados, incluindo `npm run check`;
- QA em 390/768/wide, claro/escuro, teclado e redução de movimento;
- imagens antes/depois apenas se houver URLs/anexos reais disponíveis.

- [ ] **Step 6: Fazer readback do PR e entregar sem merge**

Run:

```powershell
gh pr view --json number,title,url,baseRefName,headRefName,state,body
```

Expected: um PR aberto de `codex/strengthen-kad-identity` para `main`. Informar URL, commits, verificações e limitações; não fazer merge.
