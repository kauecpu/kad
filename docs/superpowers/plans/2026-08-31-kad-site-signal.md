# KAD Site Signal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected KAD Site decorations with a restrained custom vector signal and simpler content-first layouts.

**Architecture:** A focused `ui/brand.ts` module owns the inline vector mark. Public and internal views consume either this meaningful signature or no visual at all; CSS tokens and scoped selectors control its variants without reintroducing placeholder art.

**Tech Stack:** TypeScript, template strings, CSS, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-08-31-kad-site-signal-design.md`

## Global Constraints

- Modify only `site/`, related site tests, and these implementation documents.
- Preserve routes, functionality, authentication, ranking, demo content, and future areas.
- Do not render mascot assets or tilted KAD placeholder squares.
- Use yellow only through centralized signal tokens and quiet emphasis.
- Do not merge automatically.

---

### Task 1: Lock the rejected patterns out with tests

**Files:**
- Modify: `site/tests/structure.test.ts`

**Interfaces:**
- Produces assertions for `kadSignalMark()`, inline SVG variants, and removed artificial classes.

- [ ] Write structural assertions that require `src/ui/brand.ts`, an SVG `viewBox`, `kad-signal--compact`, and `--kad-signal-yellow`.
- [ ] Assert that public, home, and shared hero sources no longer contain `landing-note`, `landing-hero__stamp`, `landing-hero__bolt`, `auth-story__mark`, `workspace-hero__mark`, or `home-intro__mark`.
- [ ] Run `npm test -- --test-name-pattern="sinal visual"` from `site/` and confirm it fails because the signal module and cleaned markup do not exist yet.

### Task 2: Build the KAD signal and simplify the public experience

**Files:**
- Create: `site/src/ui/brand.ts`
- Modify: `site/src/views/public.ts`
- Modify: `site/src/styles/app.css`

**Interfaces:**
- Produces `kadSignalMark(options?: { variant?: 'color' | 'mono' | 'compact'; title?: string; className?: string }): string`.

- [ ] Implement the minimal inline SVG component with color, monochrome, and compact variants.
- [ ] Replace the public hero art with a quiet product-pillar composition and compact signal.
- [ ] Remove floating notes, stamp, target rings, and authentication art placeholders while preserving carousel controls and copy.
- [ ] Centralize signal color and size tokens in the public shell.
- [ ] Run the focused test and confirm it passes.

### Task 3: Remove artificial art from authenticated surfaces

**Files:**
- Modify: `site/src/ui/components.ts`
- Modify: `site/src/views/home.ts`
- Modify: `site/src/views/explore.ts`
- Modify: `site/src/views/flashcards.ts`
- Modify: `site/src/views/profile.ts`
- Modify: `site/src/views/questions.ts`
- Modify: `site/src/views/simulations.ts`
- Modify: `site/src/styles/app.css`

**Interfaces:**
- Simplifies `workspaceHero()` by removing its visual placeholder option.

- [ ] Remove the visual option from the shared hero component and every call site.
- [ ] Remove the home placeholder figure.
- [ ] Make internal heroes and the home intro content-first and full-width.
- [ ] Run `npm test` and `npm run typecheck`.

### Task 4: Visual and production verification

**Files:**
- Modify only if visual inspection finds a concrete issue.

**Interfaces:**
- No new production interface.

- [ ] Inspect the public hero in light and dark desktop layouts.
- [ ] Inspect mobile width for overflow and content hierarchy.
- [ ] Inspect authentication, ranking, and questions pages.
- [ ] Run `npm run check` and `git diff --check`.
- [ ] Review the final diff against the spec, commit, push to the PR branch, and leave the PR unmerged.
