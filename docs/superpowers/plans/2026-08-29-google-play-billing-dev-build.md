# Google Play Billing Development Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the Expo app for a development-only Google Play Billing integration without connecting purchases to production UI or backend.

**Architecture:** Use `expo-iap`, the Expo-native OpenIAP module, in an isolated branch. Add stable Android/iOS identifiers, a staging-only EAS development profile, and a guarded billing adapter whose operations fail explicitly until store products and server validation are configured.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-dev-client, expo-iap, TypeScript, EAS Build.

**Spec:** `C:/Users/igord/Downloads/prompt-codex-google-play-billing.md`

## Global Constraints

- Preserve the existing card changes in the original checkout.
- Do not alter `supabase/`, `admin/`, `.github/`, environment files, or production configuration.
- Do not connect billing to `app/perfil/planos.tsx` in this preparation.
- Use staging Supabase only for the development profile.
- Never add secrets, store credentials, or Play Console keys.
- Require a development build; do not claim Expo Go support.
- Run `npm run check`; run a native build only if the environment and credentials permit.

---

### Task 1: Align native dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [x] Remove `react-native-iap` and install the Expo-compatible `expo-iap` version through `npx expo install`.
- [x] Confirm the installed package declares Expo SDK 53+ support and no incompatible peer dependency.
- [ ] Run `npm ls expo-iap expo-dev-client expo react-native`.

### Task 2: Configure app identifiers and development profile

**Files:**
- Modify: `app.json`, `eas.json`

- [x] Add `ios.bundleIdentifier` and `android.package` as `com.kad.app`.
- [x] Add a `development` EAS profile with `developmentClient: true`, `distribution: internal`, and staging Supabase URL/environment.
- [x] Add the `expo-iap` config plugin only if the installed package exposes one; do not add undocumented plugin options.

### Task 3: Add a guarded billing adapter

**Files:**
- Create: `lib/billing.ts`
- Test: `tests/billing.test.ts`

- [x] Define the plan/cycle SKU map with placeholders.
- [x] Expose `initBilling`, `endBilling`, `fetchStoreSubscriptions`, `requestStorePurchase`, and `observeStorePurchases`.
- [x] Ensure every operation is explicit about missing product/store/server configuration and has no UI side effects.
- [x] Add deterministic tests for the unconfigured state and listener cleanup.

### Task 4: Document the development boundary

**Files:**
- Modify: `docs/PAYMENTS.md`

- [x] Document that this branch prepares native wiring only.
- [x] Document that production product setup, receipt validation, RTDN, restoration, and UI integration remain pending.
- [x] Document the required physical-device Development Build.

### Task 5: Verify and package

**Files:** no tracked files for generated artifacts.

- [x] Run `npm run check`.
- [x] Run `npx expo config --type public` and verify identifiers/profile values.
- [ ] Attempt `eas build --profile development --platform android` only if EAS authentication is available; otherwise report the exact blocker.
- [ ] Keep build artifacts outside Git.
- [ ] Commit, push, and open a PR without merging.
