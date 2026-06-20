# AMS Go-Live: Seeding, Bootstrap, Deploy Readiness & Operator Runbook — Design

Date: 2026-06-20
Status: Approved (owner brief; secure defaults chosen, forks flagged)
Type: DevOps + data-migration iteration (NOT a feature iteration)

## Goal

Make the already-feature-complete AMS app runnable against a real Firebase
project (or the emulator) with one idempotent seed step, a safe first-super-admin
bootstrap path, complete deploy configuration, and a single authoritative
operator runbook. No new feature pages. No scaffolding from zero.

## Context (verified against the codebase, not assumed)

- App lives at `C:/Users/DELL/Desktop/assets-crm`, git `master`, clean,
  806 app tests + 53 function tests green, typecheck clean, build green.
- Reference catalogs (`asset_statuses`, `categories`, `departments`,
  `settings/*`) are **super_admin-write** in `firestore.rules`. `categories`
  and `departments` are super-only; `asset_statuses` super-only with
  system-doc protections; `branches` super_admin OR asset_admin.
- `beforeCreate` Cloud Function (`functions/src/auth/beforeCreate.ts`) reads
  `settings/auth.allowedEmailDomains` via Admin SDK and **FAILS CLOSED**:
  missing/empty domains list rejects ALL sign-ups.
- Users self-claim a `no-role` record on first sign-in; only a super_admin can
  grant roles (`firestoreUserRepository.assignRole`). => chicken-and-egg: the
  first super_admin cannot be minted through the app.

### The bootstrap insight (why an Admin SDK script is correct)

The Firebase **Admin SDK bypasses Firestore security rules entirely**. A Node
script authenticated with a service account (or Application Default Credentials,
or pointed at the emulator) can therefore write the super-admin-only reference
catalogs and mint the first super_admin **before any privileged user exists**.
This is the only correct bootstrap mechanism; a client-SDK seeder would be
blocked by the very rules that protect this data.

## Exact Firestore doc shapes the seed MUST emit

Derived from the Firestore repository adapters (the readers tolerate Timestamp
OR ISO string for date fields; we write **Admin SDK `Timestamp`** for real
`createdAt`/`updatedAt` so the app and console render them natively).

- `asset_statuses/{id}`:
  `{ name, color, isFinal, isSystem, sortOrder, createdBy, updatedBy, createdAt, updatedAt }`
- `categories/{id}`:
  `{ name, group, prefix, hasSpecs, lucideIcon, createdBy, updatedBy, createdAt, updatedAt }`
- `branches/{id}`:
  `{ name, type, city, address, createdBy, updatedBy, createdAt, updatedAt }`
- `departments/{id}`:
  `{ name, createdBy, updatedBy, createdAt, updatedAt }`
- `settings/auth`:
  `{ allowedEmailDomains: string[], updatedBy, updatedAt }` (other fields preserved on merge)
- `settings/defaults` (referenced by §5 of the orchestrator doc; optional):
  `{ mainBranchId, defaultLocale }`

`createdBy`/`updatedBy` use the sentinel `'system'` (no real actor exists at
bootstrap). This is intentional and documented.

## Canonical reference data (source: Warehouse/prototypes/_shared/mock-data.js)

- **4 asset_statuses** (system, immutable ids):
  - `st_warehouse` "На складе" gray, isSystem:true, isFinal:false, sortOrder:0
  - `st_assigned`  "Выдано"    green, isSystem:true, isFinal:false, sortOrder:1
  - `st_repair`    "В ремонте" orange, isSystem:true, isFinal:false, sortOrder:2
  - `st_disposed`  "Списано"   red, isSystem:true, isFinal:true, sortOrder:3
- **5 branches**: br_main (Головной офис, type `warehouse` — the central
  warehouse/HQ), br_yerevan_2, br_yerevan_3, br_gyumri, br_vanadzor
  (type `branch`). city/address null (mock has none).
- **6 departments**: dep_it (ИТ), dep_hr (HR), dep_sales (Продажи),
  dep_finance (Финансы), dep_legal (Юристы), dep_ops (Операции).
- **categories**: see the prefix fork below.

## Decisions (forks resolved; secure defaults; owner can override)

1. **Seeder = Admin SDK TypeScript script** under `scripts/`, run with `tsx`.
   Credential resolution order: `FIRESTORE_EMULATOR_HOST` (emulator) →
   `GOOGLE_APPLICATION_CREDENTIALS` (service-account file) → Application
   Default Credentials (`gcloud auth application-default login`). Project id
   from `--project`, `GOOGLE_CLOUD_PROJECT`, or `.firebaserc` default.

2. **Pure builder + thin writer.** `scripts/seed/buildSeed.ts` exports a pure
   `buildSeedDocs(opts)` returning `SeedDoc[]` (`{ collection, id, data }`) with
   **zero Firebase imports**. Unit-testable: assert the emitted docs satisfy the
   domain types and round-trip through the InMemory repositories.
   `scripts/seed.ts` is the thin Admin-SDK runner.

3. **Idempotent, non-destructive.** Default = create-if-absent (read each doc;
   write only when missing). `--force` re-writes reference docs (still never
   deletes, still skips assets/employees/users). The seeder can NEVER delete.

4. **Seed writes bypass `withAudit`** (documented). Reference catalogs at
   bootstrap predate any actor; audit_logs rules require
   `actorUid == request.auth.uid`, impossible for an unauthenticated Admin
   script. Provenance is preserved via `createdBy/updatedBy: 'system'` +
   real timestamps. No audit_logs rows are written by the seeder.

5. **CATEGORY PREFIX — GENUINE FORK (owner decision #1).**
   Production `Category.prefix` is **required and globally unique**
   (`isPrefixTaken` enforces it). Mock data has 131 categories and NO prefixes.
   Minting 131 unique prefixes is fragile and pollutes the catalog.
   - **Default: `core` category set (~30)** — a curated, deduplicated subset
     spanning all 3 groups, each with an explicit hand-assigned unique prefix
     (covers the mock's real inv-code prefixes: LAP, MON, DSK, PHN, SRV, etc.).
   - **`--all-categories`**: emit all 131 with deterministic, collision-checked
     auto-prefixes. The builder THROWS on any prefix or name collision rather
     than silently truncating — a corrupt catalog must never be written.
   - Owner can re-run later with `--all-categories --force` if they want the
     full taxonomy.

6. **First super_admin bootstrap = `scripts/grant-super-admin.ts <uid|email>`.**
   Admin SDK. If given an email, resolve to uid via Admin Auth
   (`getUserByEmail`). Writes `users/{uid}` `{ role:'super_admin',
   status:'active' }` (merge). Guards: requires an explicit argument; prints the
   resolved uid/email/displayName and the target project, then performs the
   write; refuses if the user doc/auth record cannot be found (no silent create
   of a bogus user). This is a **one-time** operator action — clearly labeled.

7. **`settings/auth` seeding.** `allowedEmailDomains` comes from
   `SEED_ALLOWED_DOMAINS` (comma-separated env var) or `--domains a,b`. If
   neither is set, the seeder writes `[]` **and prints a LOUD warning** that
   sign-ups are blocked until a super_admin sets domains (via the Settings
   screen or re-running the seeder). This fail-closed gotcha is the #1 runbook
   warning.

8. **Demo data = `--demo` flag, OFF by default.** Seeds a small set of sample
   assets + employees that match the domain shapes, for smoke-testing only.
   Never seeded in a real go-live unless explicitly requested.

9. **Deploy config.** Complete `.firebaserc` (placeholder + how to set);
   add npm scripts `deploy:indexes`, `deploy:hosting`(n/a-Vercel note),
   `deploy:all`, `seed`, `seed:emulator`, `grant:super-admin`; expand
   `.env.example`; Vercel + Blaze notes. `firebase deploy --only
   firestore:rules,storage,firestore:indexes,functions` wired + documented.

10. **Runbook = `docs/RUNBOOK-go-live.md`.** Numbered, operator-only steps
    marked, Blaze requirements marked, fail-closed gotcha front-and-center.

## Components & boundaries

- `scripts/seed/referenceData.ts` — pure data: the 4 statuses, 5 branches,
  6 departments, the `core` category list (with explicit prefixes), and the
  `all` category source (imported/transcribed from mock-data.js shapes) +
  the deterministic prefix generator (collision-checked).
- `scripts/seed/buildSeed.ts` — pure `buildSeedDocs(opts)` → `SeedDoc[]`.
  No Firebase imports. Validates uniqueness; throws on collision.
- `scripts/seed/adminApp.ts` — Admin SDK initialization + credential/project
  resolution (the only place that imports `firebase-admin`).
- `scripts/seed.ts` — CLI runner: parse flags, build docs, create-if-absent
  (or `--force`), print a summary (created / skipped / would-write counts),
  `--dry-run` prints without writing.
- `scripts/grant-super-admin.ts` — the one-time bootstrap CLI.
- `scripts/seed/buildSeed.test.ts` — unit tests (Vitest) for the pure builder.

## Testing strategy

- Pure builder tests run under the existing app Vitest config (no emulator
  needed): assert counts, ids, required fields, status `isSystem/isFinal`,
  prefix uniqueness, `--all-categories` collision-throw, that emitted docs
  type-check as `AssetStatus`/`Category`/`Branch`/`Department` minus
  server-written timestamp fields, and that they load cleanly into the
  InMemory repositories.
- The Admin-SDK runner is thin and not unit-tested directly; it is exercised
  manually against the emulator (documented in the runbook) and its logic is
  the pure builder which IS tested.
- Keep app + functions suites green (806 / 53 baseline, additive only).

## Out of scope

- Real `firebase login`, project creation, billing/Blaze enablement, enabling
  Auth providers/authorized domains, real deploys, real sign-in — all are
  operator-only and documented in the runbook, not performed here.
- No changes to feature pages, rules logic, or function logic (only additive
  config/scripts/docs).

## Owner decisions to confirm (enumerated)

1. Category seed scope: **core (~30, default)** vs full 131 (`--all-categories`).
2. Allowed email domains for `settings/auth` (real customer domain — must be
   provided at seed time or sign-ups stay blocked).
3. Whether to seed `settings/defaults.mainBranchId = br_main` (recommended).
4. Demo data: off by default; turn on only for a throwaway/staging project.
