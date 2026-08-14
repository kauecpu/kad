# Welcome Mascot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace only the welcome onboarding wolf with the supplied seated-writing mascot, using a clean transparent PNG and the requested accessibility label.

**Architecture:** Keep the existing `KadMascot` component and onboarding layout. Add a dedicated welcome-mascot asset plus a small presentation descriptor consumed by `KadMascot`, so the welcome variant changes without affecting the nerd, book, or goal variants.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, Node test runner, PNG with alpha.

## Global Constraints

- Use `C:\Users\unluc\Downloads\IMG-20260805-WA0008.jpg` as the visual target and `C:\Users\unluc\Downloads\IMG-20260805-WA0007.jpg` only as character reference.
- Preserve the mascot's proportions, purple/lilac palette, expressive eyes, small tooth, yellow pencil, blue shorts, and image sharpness.
- The final asset must have a transparent background with no white field, black corners, frame, shadow, or chroma fringe.
- Render with React Native `Image` behavior, `resizeMode="contain"`, responsive sizing, no cropping or overlap, and accessibility label `Mascote KAD escrevendo com um lápis`.
- Do not change copy, buttons, navigation, global colors, or any other screen.
- Keep the existing nerd, book, and goal mascot assets unchanged.

---

### Task 1: Prepare the transparent welcome asset

**Files:**
- Create: `assets/images/kad-mascot-wolf-writing.png`
- Delete after reference migration: `assets/images/kad-mascot-wolf.png`

**Interfaces:**
- Consumes: the two supplied JPEG references.
- Produces: a square PNG whose corners are transparent and whose visible pixels contain the seated writing mascot.

- [ ] **Step 1: Inspect both supplied images at original resolution**

Confirm that the seated-writing image is the edit target and the standing image is reference-only.

- [ ] **Step 2: Produce a removable flat-background edit**

Use the built-in image editor with the seated wolf locked as the subject, the standing wolf used only for identity consistency, and a uniform `#00ff00` background with no shadow or surrounding frame.

- [ ] **Step 3: Convert the flat background to alpha**

Run:

```powershell
C:\Users\unluc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe C:\Users\unluc\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py --input tmp\imagegen\kad-mascot-wolf-writing-chroma.png --out assets\images\kad-mascot-wolf-writing.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 72 --despill
```

- [ ] **Step 4: Validate the image artifact**

Verify the PNG has an alpha channel, transparent corners, no green fringe, no black or white frame, and retains the complete wolf, pencil, shorts, and paper.

### Task 2: Connect the new welcome presentation using TDD

**Files:**
- Create: `constants/mascots.ts`
- Create: `tests/mascot-presentation.test.ts`
- Modify: `components/kad-mascot.tsx`

**Interfaces:**
- Produces: `getMascotAccessibilityLabel(variant: KadMascotVariant): string` and the `KadMascotVariant` type.
- Consumes: the dedicated `kad-mascot-wolf-writing.png` source for the `welcome` variant.

- [ ] **Step 1: Write the failing accessibility-contract test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { getMascotAccessibilityLabel } from '../constants/mascots.ts';

test('o mascote de boas-vindas descreve a pose de escrita para leitores de tela', () => {
  assert.equal(getMascotAccessibilityLabel('welcome'), 'Mascote KAD escrevendo com um lápis');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --no-warnings --test tests/mascot-presentation.test.ts`

Expected: FAIL because `constants/mascots.ts` does not exist.

- [ ] **Step 3: Add the minimal descriptor and update the component**

Create the exported variant type and label getter in `constants/mascots.ts`. Import them from `components/kad-mascot.tsx`, point only `MASCOT_SOURCES.welcome` to `kad-mascot-wolf-writing.png`, retain `resizeMode="contain"`, and keep the existing responsive `size` behavior.

```ts
export type KadMascotVariant = 'welcome' | 'nerd' | 'book' | 'goal';

const MASCOT_LABELS: Record<KadMascotVariant, string> = {
  welcome: 'Mascote KAD escrevendo com um lápis',
  nerd: 'Mascote lobo roxo com óculos estudando com um lápis',
  book: 'Mascote lobo roxo lendo um livro',
  goal: 'Mascote lobo roxo segurando uma bandeira de objetivo',
};

export function getMascotAccessibilityLabel(variant: KadMascotVariant) {
  return MASCOT_LABELS[variant];
}
```

Use this welcome source in `MASCOT_SOURCES`:

```ts
welcome: require('../assets/images/kad-mascot-wolf-writing.png'),
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --no-warnings --test tests/mascot-presentation.test.ts`

Expected: PASS with one test and zero failures.

- [ ] **Step 5: Confirm the old asset is unreferenced, then delete it**

Run: `rg -n "kad-mascot-wolf\.png" app components constants tests`

Expected: no matches before deleting `assets/images/kad-mascot-wolf.png`.

### Task 3: Visual and repository verification

**Files:**
- Verify: `app/onboarding.tsx`
- Verify: all changed files from Tasks 1 and 2.

**Interfaces:**
- Consumes: the Expo onboarding preview route `/onboarding-preview`.
- Produces: evidence that the first slide is correct in light and dark mobile layouts.

- [ ] **Step 1: Start Expo Web on an isolated port**

Run: `npx.cmd expo start --web --port 8083`

- [ ] **Step 2: Validate mobile widths visually**

Open `/onboarding-preview` at 320px and 430px widths. Confirm the whole mascot is contained, does not overlap copy or controls, and the PNG has no residual background or border.

- [ ] **Step 3: Validate light and dark modes**

Inspect the first slide in both themes and confirm the transparent asset blends with the existing themed background without changing global colors.

- [ ] **Step 4: Run the complete project check**

Run: `npm.cmd run check`

Expected: all tests, TypeScript, and Expo lint pass.

- [ ] **Step 5: Review and publish the isolated change**

Confirm `git diff --check` is clean and the diff is limited to the plan, asset, mascot descriptor, component, and test. Commit, push `codex/welcome-mascot`, and open a Pull Request to `main` without merging it.
