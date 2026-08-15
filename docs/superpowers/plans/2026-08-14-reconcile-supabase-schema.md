# Supabase Schema Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the KAD repository, `kad-dev` migration history, database schema, grants, and deployed Edge Functions without deleting or overwriting existing data.

**Architecture:** Preserve the remote schema as the observed source of deployed state, add local historical mirror migrations for remote-only records, and apply only the proven-missing editorial pipeline plus one forward-only hardening migration. Validate the complete chain in the disposable `kad-reconciliation` project before using official migration-history repair and a narrowly verified push against `kad-dev`.

**Tech Stack:** Supabase CLI 2.114.0, PostgreSQL migrations, Supabase Edge Functions/Deno, pgTAP SQL tests, Node.js tests, GitHub Pull Requests.

## Global Constraints

- Work only on `codex/reconcile-supabase-schema`, based on the latest `origin/main`.
- Do not execute `db reset`, drops, truncates, blind pushes, or direct SQL edits to `supabase_migrations.schema_migrations`.
- Preserve profiles, checkouts, webhook events, subscriptions, transactions, and all other existing records.
- Never expose `.env`, passwords, tokens, cookies, PII, private keys, or `service_role` values.
- Do not downgrade deployed payment Edge Functions.
- Obtain explicit approval after the Phase 1 report and before any Supabase write.
- Use only the official `supabase migration repair` command for history repair.
- Run `npm run check`; run `npm run admin:build` only if `admin/` changes.
- Do not merge the Pull Request.

---

### Task 1: Freeze the audited state and approval checkpoint

**Files:**
- Create: `docs/SUPABASE_RECONCILIATION.md`
- Create: `docs/ENVIRONMENTS.md`
- Create: `docs/superpowers/plans/2026-08-14-reconcile-supabase-schema.md`

**Interfaces:**
- Consumes: sanitized remote catalog metadata and Edge Function bundles.
- Produces: the approved matrix, SQL, impact, rollback, and environment policy used by every later task.

- [x] **Step 1: Record the local/remote migration matrix and Edge Function mapping**

Record all ten local migrations, all three remote history entries, the four
deployed functions, versions, JWT settings, and the exact source commit without
including user records or secrets.

- [x] **Step 2: Record the exact proposed DDL and repair command**

Use the SQL and CLI command in `docs/SUPABASE_RECONCILIATION.md`. The editorial
pipeline source is pinned by path and SHA-256.

- [x] **Step 3: Verify the baseline**

Run: `npm run check`  
Expected: 167 tests pass, TypeScript passes, ESLint passes.

- [ ] **Step 4: Obtain explicit approval**

No Supabase project may be changed until the owner approves the matrix and SQL
in `docs/SUPABASE_RECONCILIATION.md`.

### Task 2: Add regression tests for reconciliation invariants

**Files:**
- Modify: `tests/database-schema.test.ts`
- Modify: `supabase/tests/payment-security.test.sql`
- Create: `supabase/tests/reconciliation-security.test.sql`

**Interfaces:**
- Consumes: migration filenames and SQL privileges documented in Task 1.
- Produces: static and database-level assertions that gate Tasks 3 through 6.

- [ ] **Step 1: Write failing static migration tests**

Add assertions that require:

```ts
expect(reconciliationSql).toContain(
  'revoke truncate, references, trigger\non all tables in schema public',
);
expect(reconciliationSql).toContain(
  'alter default privileges for role postgres in schema public',
);
expect(reconciliationSql).not.toContain(
  'alter default privileges for role supabase_admin',
);
expect(reconciliationSql).toContain(
  'payment_transactions_checkout_session_id_idx',
);
```

Also require local files for remote versions `20260812211105`,
`20260812221545`, and `20260812225749`.

- [ ] **Step 2: Run the focused Node test and confirm failure**

Run: `node --test tests/database-schema.test.ts`  
Expected: FAIL because the reconciliation and historical mirror files do not yet exist.

- [ ] **Step 3: Write failing pgTAP privilege tests**

Create SQL assertions using `has_table_privilege` and
`has_function_privilege` that require:

```sql
select ok(
  not has_table_privilege('anon', 'public.questions', 'TRUNCATE'),
  'anon cannot truncate questions'
);
select ok(
  not has_table_privilege('authenticated', 'private.editorial_import_batches', 'SELECT'),
  'authenticated cannot read private import batches directly'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_create_import_batch(text,jsonb)', 'EXECUTE'),
  'authenticated may call the permission-checking admin RPC'
);
```

Add equivalent denial checks for financial tables and draft question access.

- [ ] **Step 4: Run the SQL test against the disposable project and confirm failure**

Run the test with the disposable project's database connection supplied through
an unlogged environment variable.  
Expected: FAIL because the project is empty.

- [ ] **Step 5: Commit the tests and Phase 1 documentation**

```powershell
git add docs tests/database-schema.test.ts supabase/tests
git commit -m "test: define Supabase reconciliation invariants"
```

### Task 3: Canonicalize remote history and payment function sources

**Files:**
- Create: `supabase/migrations/20260812211105_harden_payment_subscriptions.sql`
- Create: `supabase/migrations/20260812221545_grant_payment_edge_function_access.sql`
- Create: `supabase/migrations/20260812225749_enforce_payment_edge_function_least_privilege.sql`
- Modify: `supabase/functions/_shared/mercado-pago.ts`
- Create: `supabase/functions/_shared/mercado-pago-webhook.ts`
- Modify: `supabase/functions/create-payment-checkout/index.ts`
- Modify: `supabase/functions/mercado-pago-webhook/index.ts`
- Create: `tests/payment-webhook-validation.test.ts`

**Interfaces:**
- Consumes: remote SQL statements and Edge Function files mapped to commit `ede946d0c8d114d2570a4089f26756b4039bf280`.
- Produces: local files whose content identifies every deployed payment bundle and every remote migration record.

- [ ] **Step 1: Add the exact historical mirror migrations**

`20260812211105` is a comment-only mirror because its SQL is byte-equivalent to
`20260812024756`. `20260812221545` contains the three intermediate
`service_role` grants recorded remotely. `20260812225749` contains the exact
least-privilege SQL from commit `ede946d`.

- [ ] **Step 2: Copy only the canonical Edge Function files from `ede946d`**

Use the four paths listed above. Do not cherry-pick the whole conflicted PR and
do not alter the redesigned app screens.

- [ ] **Step 3: Run the focused tests**

Run: `node --test tests/payment-webhook-validation.test.ts tests/database-schema.test.ts`  
Expected: PASS.

- [ ] **Step 4: Compare deployed bundles again**

Download each deployed function read-only and compare every bundled file after
normalizing only trailing line endings.  
Expected: all four deployed functions map to `main` plus the current branch;
no deploy is required.

- [ ] **Step 5: Commit the canonical artifacts**

```powershell
git add supabase/functions supabase/migrations tests/payment-webhook-validation.test.ts
git commit -m "fix: version deployed payment artifacts"
```

### Task 4: Create the forward reconciliation migration

**Files:**
- Create: `supabase/migrations/<generated>_reconcile_remote_schema.sql`
- Create: `supabase/migrations/<generated>_complete_editorial_fk_indexes.sql`
- Modify: `tests/database-schema.test.ts`
- Modify: `supabase/tests/reconciliation-security.test.sql`

**Interfaces:**
- Consumes: exact DDL approved in Task 1 and post-pipeline advisor findings.
- Produces: two forward-only migrations that remove unsafe privileges and add all missing FK indexes.

- [ ] **Step 1: Create the migration through the CLI**

Run: `npx supabase migration new reconcile_remote_schema`  
Expected: one empty timestamped SQL file under `supabase/migrations/`.

- [ ] **Step 2: Add the approved SQL without broadening scope**

Insert exactly the SQL block under “SQL exato proposto” in
`docs/SUPABASE_RECONCILIATION.md`. Do not add data updates, deletes, drops, or
new grants.

- [ ] **Step 3: Run the focused static tests**

Run: `node --test tests/database-schema.test.ts`  
Expected: PASS.

- [ ] **Step 4: Commit the migration**

```powershell
git add supabase/migrations tests/database-schema.test.ts supabase/tests/reconciliation-security.test.sql
git commit -m "fix: reconcile Supabase grants and indexes"
```

### Task 5: Prove the migration chain in the disposable project

**Files:**
- Modify: `docs/SUPABASE_RECONCILIATION.md`

**Interfaces:**
- Consumes: the complete migration chain and SQL tests from Tasks 2 through 4.
- Produces: sanitized evidence that the exact artifacts are safe before `kad-dev`.

- [ ] **Step 1: Confirm the disposable target**

Verify project ref `txqnvkovdstikgziczyk`, project name `kad-reconciliation`,
and zero real-user data. Abort if the target differs.

- [ ] **Step 2: Apply all local migrations to the disposable project**

Use the Supabase migration workflow with credentials supplied only through a
private prompt or environment variable.  
Expected: every migration succeeds, including both historical mirrors and the
new reconciliation migration.

- [ ] **Step 3: Run database access tests**

Run `supabase/tests/payment-security.test.sql` and
`supabase/tests/reconciliation-security.test.sql`.  
Expected: published questions are readable; drafts and private imports are not;
admin RPCs enforce permissions; payment data is isolated; unsafe privileges are absent.

- [ ] **Step 4: Run security and performance advisors**

Expected: no new ERROR findings; the five missing-FK warnings are gone. Record
remaining intentional deny-all/`SECURITY DEFINER` notices and the dashboard-only
password-protection warning.

- [ ] **Step 5: Append sanitized evidence and commit**

```powershell
git add docs/SUPABASE_RECONCILIATION.md
git commit -m "docs: record disposable database validation"
```

### Task 6: Reconcile `kad-dev` with two explicit checkpoints

**Files:**
- Modify: `docs/SUPABASE_RECONCILIATION.md`

**Interfaces:**
- Consumes: successful disposable-project evidence and the approved repair list.
- Produces: aligned migration history and schema without changing existing rows.

- [ ] **Step 1: Reconfirm approval and pre-change counts**

Show the disposable evidence, exact repair versions, and exact pending migration
list. Re-read only sanitized counts from the twelve existing app tables.

- [ ] **Step 2: Repair only proven-equivalent local versions**

Run the exact `migration repair --linked --status applied` command recorded in
`docs/SUPABASE_RECONCILIATION.md`.  
Expected: no schema or row changes.

- [ ] **Step 3: Inspect migration list and dry-run**

Run: `npx supabase migration list --linked`  
Run: `npx supabase db push --linked --dry-run`  
Expected: only `202608090001_editorial_import_pipeline.sql`, the generated
`reconcile_remote_schema.sql`, and `complete_editorial_fk_indexes.sql` are
pending. Abort on any other output.

- [ ] **Step 4: Apply the three approved migrations**

Run: `npx supabase db push --linked`  
Expected: exactly the three dry-run migrations are applied.

- [ ] **Step 5: Verify preservation and access boundaries**

Repeat counts, catalog assertions, SQL tests, Edge Function comparisons, and
both advisors. Expected: existing-table counts unchanged; new editorial tables
start empty; all access tests pass.

- [ ] **Step 6: Record the remote commands and outcomes**

Append sanitized command names, migration versions, counts, advisor results,
and remaining blockers to `docs/SUPABASE_RECONCILIATION.md`.

- [ ] **Step 7: Commit the evidence**

```powershell
git add docs/SUPABASE_RECONCILIATION.md
git commit -m "docs: record kad-dev reconciliation evidence"
```

### Task 7: Final verification and draft Pull Request

**Files:**
- Modify: `docs/SUPABASE_RECONCILIATION.md`
- Modify: `docs/ENVIRONMENTS.md`

**Interfaces:**
- Consumes: all commits and remote verification evidence.
- Produces: a reviewable draft PR to `main`; never merges it.

- [ ] **Step 1: Run the complete repository check**

Run: `npm run check`  
Expected: all Node tests, TypeScript, and ESLint pass.

- [ ] **Step 2: Confirm secret hygiene and scope**

Run: `git diff --check origin/main...HEAD`  
Run: `git status --short`  
Inspect changed paths and scan the diff for credentials without printing any
candidate value. Expected: only Supabase code/tests and reconciliation docs.

- [ ] **Step 3: Push the branch**

```powershell
git push -u origin codex/reconcile-supabase-schema
```

- [ ] **Step 4: Open a draft PR**

The PR body must list remote writes, commands, validation, rollback approach,
function-to-commit mapping, advisor findings, and whether launch remains
blocked. Do not include secrets or data rows.

- [ ] **Step 5: Leave the PR unmerged**

Expected: draft PR targets `main`, checks are visible, and no merge action is taken.
