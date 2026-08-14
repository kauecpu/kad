# Onboarding Mascot Poses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each onboarding slide a different study-related pose of the approved 2D KAD wolf while preserving one consistent character model.

**Architecture:** Keep `KadMascot` as the single rendering component and replace its repeated source map with four transparent PNG assets. Rename the internal variants to match the slide concepts, keep the existing responsive animation, and cover the accessible descriptions with a focused Node test.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, built-in image generation, PNG alpha processing with Pillow, Node test runner.

## Global Constraints

- Treat `C:\Users\unluc\Downloads\IMG-20260805-WA0008.jpg` as the exact welcome pose.
- Treat `C:\Users\unluc\Downloads\IMG-20260805-WA0007.jpg` as the exact practice pose.
- Use both JPEGs as the character sheet for the simulation and goal poses.
- Preserve the 2D purple wolf, lilac muzzle and belly, expressive eyes, small tooth, yellow pencil style, blue shorts, ears, tail, proportions, and soft shading.
- Produce 1254×1254 RGBA PNGs with transparent corners, full-subject framing, and no residual white, black, or chroma background.
- Keep `Animated.Image`, `resizeMode="contain"`, the existing animation, and the existing responsive size calculation.
- Do not change slide copy, icons, buttons, navigation, global colors, spacing, authentication, or other screens.
- Keep Pull Request 11 in draft and do not merge it.

---

### Task 1: Produce the three missing transparent mascot assets

**Files:**
- Create: `assets/images/kad-mascot-wolf-practice.png`
- Create: `assets/images/kad-mascot-wolf-simulation.png`
- Create: `assets/images/kad-mascot-wolf-goal-study.png`
- Verify: `assets/images/kad-mascot-wolf-writing.png`
- Temporary: `tmp/imagegen/kad-mascot-wolf-practice-chroma.png`
- Temporary: `tmp/imagegen/kad-mascot-wolf-simulation-chroma.png`
- Temporary: `tmp/imagegen/kad-mascot-wolf-goal-study-chroma.png`

**Interfaces:**
- Consumes: the two supplied JPEG references.
- Produces: four visually consistent square mascot assets consumed by `KadMascotVariant`.

- [ ] **Step 1: Generate the practice chroma source from the second supplied image**

Use the built-in image editor with both JPEGs attached and this exact prompt:

```text
Use case: background-extraction
Asset type: Expo onboarding mascot
Input images: Image 1 is the seated-writing character reference; Image 2 is the edit target and exact standing-pencil pose.
Primary request: Preserve the complete standing purple wolf from Image 2, including pose, facial expression, yellow pencil, blue shorts, tail, paws, proportions, colors, and 2D illustration finish. Replace only the white rounded background, black corners, and frame with a perfectly flat solid #00ff00 chroma-key background.
Composition: square 1254×1254 canvas, entire wolf and pencil visible with even padding, no crop or stretch.
Background: uniform #00ff00 edge to edge, no shadow, gradient, texture, frame, floor, or lighting variation.
Constraints: do not redraw, reinterpret, add, remove, reposition, or restyle the character. No text, logo, watermark, reflection, or cast shadow. Do not use #00ff00 in the subject.
```

Copy the exact file path returned by the image tool to `tmp/imagegen/kad-mascot-wolf-practice-chroma.png`.

- [ ] **Step 2: Generate the simulation chroma source**

Use the built-in image generator with both JPEGs attached and this exact prompt:

```text
Use case: style-transfer
Asset type: Expo onboarding mascot for the simulation slide
Input images: Image 1 and Image 2 are an identity and style sheet for the same KAD wolf.
Primary request: Create the same 2D purple wolf seated and concentrating while solving a test. One paw holds the same yellow pencil over a white answer sheet, the other paw steadies the paper, and a small simple stopwatch sits beside the sheet.
Character invariants: preserve the exact purple fur, lilac muzzle and belly, white expressive eyes with dark-purple pupils, angled eyebrows, dark-purple nose, one small white tooth, pointed ears with lilac interiors, large tail, childlike head-to-body proportions, blue shorts, clean shapes, and soft shading from the references.
Composition: square 1254×1254 canvas, full wolf, paper, pencil, and stopwatch visible with even padding. Keep the scene compact enough to read at mobile size.
Background: perfectly flat solid #00ff00 edge to edge, no shadow, gradient, texture, frame, floor, or lighting variation.
Constraints: no desk, classroom scene, readable text, extra character, logo, watermark, reflection, or cast shadow. Do not use #00ff00 in the subject.
```

Copy the exact file path returned by the image tool to `tmp/imagegen/kad-mascot-wolf-simulation-chroma.png`.

- [ ] **Step 3: Generate the goal chroma source**

Use the built-in image generator with both JPEGs attached and this exact prompt:

```text
Use case: style-transfer
Asset type: Expo onboarding mascot for the goal slide
Input images: Image 1 and Image 2 are an identity and style sheet for the same KAD wolf.
Primary request: Create the same 2D purple wolf standing confidently. One paw holds a small purple goal flag on a short pole, and the other paw holds a closed blue study book against the body.
Character invariants: preserve the exact purple fur, lilac muzzle and belly, white expressive eyes with dark-purple pupils, angled eyebrows, dark-purple nose, one small white tooth, pointed ears with lilac interiors, large tail, childlike head-to-body proportions, blue shorts, clean shapes, and soft shading from the references.
Composition: square 1254×1254 canvas, full wolf, flag, pole, tail, feet, and book visible with even padding. Use a confident study-achievement expression.
Background: perfectly flat solid #00ff00 edge to edge, no shadow, gradient, texture, frame, floor, or lighting variation.
Constraints: the flag and book have no words, numbers, logos, or symbols. No extra character, watermark, reflection, or cast shadow. Do not use #00ff00 in the subject.
```

Copy the exact file path returned by the image tool to `tmp/imagegen/kad-mascot-wolf-goal-study-chroma.png`.

- [ ] **Step 4: Remove each chroma background**

Run these commands with the bundled Python runtime:

```powershell
& 'C:\Users\unluc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\unluc\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py' --input 'tmp\imagegen\kad-mascot-wolf-practice-chroma.png' --out 'assets\images\kad-mascot-wolf-practice.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 72 --despill
& 'C:\Users\unluc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\unluc\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py' --input 'tmp\imagegen\kad-mascot-wolf-simulation-chroma.png' --out 'assets\images\kad-mascot-wolf-simulation.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 72 --despill
& 'C:\Users\unluc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\unluc\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py' --input 'tmp\imagegen\kad-mascot-wolf-goal-study-chroma.png' --out 'assets\images\kad-mascot-wolf-goal-study.png' --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 72 --despill
```

- [ ] **Step 5: Normalize dimensions and validate alpha**

Use Pillow to resize only images that are not already 1254×1254, preserving alpha with Lanczos. Then inspect all four final assets and confirm:

- mode `RGBA`;
- size `1254×1254`;
- four corner alpha values equal `0`;
- visible alpha bounding box leaves padding on all sides;
- no visible green-dominant edge pixels;
- subject, props, face, and blue shorts remain complete.

- [ ] **Step 6: Remove the chroma intermediates**

Delete only `tmp/imagegen/kad-mascot-wolf-practice-chroma.png`, `tmp/imagegen/kad-mascot-wolf-simulation-chroma.png`, and `tmp/imagegen/kad-mascot-wolf-goal-study-chroma.png`. Remove `tmp/imagegen` only if it becomes empty.

### Task 2: Connect distinct variants using TDD

**Files:**
- Modify: `tests/mascot-presentation.test.ts`
- Modify: `constants/mascots.ts`
- Modify: `components/kad-mascot.tsx`
- Modify: `app/onboarding.tsx`

**Interfaces:**
- Produces: `KadMascotVariant = 'welcome' | 'practice' | 'simulation' | 'goal'`.
- Produces: one accessible description and one PNG source for each variant.
- Consumes: the four final assets from Task 1.

- [ ] **Step 1: Write the failing variant-description test**

Replace the existing focused test with:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { getMascotAccessibilityLabel } from '../constants/mascots.ts';

test('cada slide descreve sua pose de estudo para leitores de tela', () => {
  const expectations = [
    ['welcome', 'Mascote KAD escrevendo com um lápis'],
    ['practice', 'Mascote KAD em pé segurando um lápis'],
    ['simulation', 'Mascote KAD resolvendo uma prova com cronômetro'],
    ['goal', 'Mascote KAD segurando uma bandeira de objetivo e um livro'],
  ] as const;

  for (const [variant, label] of expectations) {
    assert.equal(getMascotAccessibilityLabel(variant), label);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --no-warnings --test tests/mascot-presentation.test.ts`

Expected: FAIL because `practice` and `simulation` are absent from the current label map.

- [ ] **Step 3: Implement the new variant names and labels**

Set `KadMascotVariant` and `MASCOT_LABELS` in `constants/mascots.ts` to the four approved variant names and exact labels from Step 1.

- [ ] **Step 4: Point the rendering component to four distinct assets**

Set `MASCOT_SOURCES` in `components/kad-mascot.tsx` to:

```ts
const MASCOT_SOURCES = {
  welcome: require('../assets/images/kad-mascot-wolf-writing.png'),
  practice: require('../assets/images/kad-mascot-wolf-practice.png'),
  simulation: require('../assets/images/kad-mascot-wolf-simulation.png'),
  goal: require('../assets/images/kad-mascot-wolf-goal-study.png'),
} as const;
```

Keep the rest of `KadMascot` unchanged.

- [ ] **Step 5: Update only the internal slide variant names**

In `app/onboarding.tsx`, change the practice slide from `mascot: 'nerd'` to `mascot: 'practice'`, and change the simulation slide from `mascot: 'book'` to `mascot: 'simulation'`. Leave all visible content unchanged.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `node --no-warnings --test tests/mascot-presentation.test.ts`

Expected: PASS with one test and zero failures.

### Task 3: Verify all slides and publish the revision

**Files:**
- Verify: `app/onboarding.tsx`
- Verify: `components/kad-mascot.tsx`
- Verify: `constants/mascots.ts`
- Verify: all four mascot PNGs.

**Interfaces:**
- Consumes: `/onboarding-preview` from the Expo server on port 8083.
- Produces: visual and automated evidence for Pull Request 11.

- [ ] **Step 1: Reload the local preview**

Use the existing Expo server at `http://localhost:8083/onboarding-preview`. If it is no longer running, start it with:

```powershell
npx.cmd expo start --web --port 8083
```

- [ ] **Step 2: Validate the four slides in light mode**

Inspect every slide at 320×700 and 430×900. Confirm four different image sources, the expected pose for each slide, full containment, clean transparency, and no overlap with copy or controls.

- [ ] **Step 3: Validate the four slides in dark mode**

Switch the theme through the app UI and repeat the same slide sequence. Confirm each asset blends with the themed glow and retains clean edges.

- [ ] **Step 4: Inspect accessibility and browser errors**

Confirm the DOM exposes the four exact accessible descriptions from Task 2 and four distinct asset URLs. Confirm the browser console contains no new errors.

- [ ] **Step 5: Run the complete project verification**

Run:

```powershell
npm.cmd run check
git diff --check
```

Expected: 157 tests pass, TypeScript passes, Expo lint passes, and Git reports no whitespace errors.

- [ ] **Step 6: Review the final scope**

Confirm the diff contains only the three new PNGs, variant wiring, the focused test, the approved design and plan documents. Confirm no legacy 3D mascot file or reference returned.

- [ ] **Step 7: Commit and publish the revision**

Stage only the intended files and commit with:

```powershell
git commit -m "feat: add distinct onboarding mascot poses"
git push
```

Update Pull Request 11 with the four-pose summary and verification evidence. Keep the PR in draft and do not merge it. Wait for the `quality` GitHub Actions check and require a successful result before completion.
