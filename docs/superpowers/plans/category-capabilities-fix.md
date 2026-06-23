# Plan — Category capability flags reach the UI (license / specs / serial / type)

## Problem (confirmed)
The asset CREATE form and the DETAIL page never show ЛИЦЕНЗИЯ ОС / ХАРАКТЕРИСТИКИ /
serial / furniture-type because category capability flags never reach the UI:

1. `firestoreAssetRepository.ts` — BOTH `loadSelfServiceRefData()` and
   `fetchReferenceData()` map `categories` with only `{name, group, lucideIcon}`,
   DROPPING `hasSpecs`, `hasOemLicense`, `requiresSerial`, `hasTypeField`.
2. The seed (`scripts/seed/referenceData.ts` + `buildSeed.ts`) writes only
   `{name, group, prefix, hasSpecs, lucideIcon}` — never `hasOemLicense`,
   `requiresSerial`, `hasTypeField`. So even reading them back would yield nothing.
3. `categoryCapabilities()` (CategoryPicker.tsx) requires `cat.hasOemLicense === true`
   strictly → OEM license section ALWAYS hidden in prod. `hasSpecs` has a name
   heuristic so it half-works, but flags are unreliable.

In-memory test repo carries flags → tests pass while prod is broken (mapper/seed gap).

## Chosen capability source: STATIC TAXONOMY TABLE (single source of truth)
`src/domain/asset/categoryCapabilities.ts` — a `CATEGORY_CAPABILITY_TAXONOMY`
keyed by category id, mirroring the prototype `_d`/`_n`/`_f` taxonomy:
- Computers/laptops/workstations/mini-pc/aio/desktop + ALL server families →
  `hasSpecs:true, hasOemLicense:true, requiresSerial:true`.
- Apple macbooks (cat_macbook_air, cat_macbook_pro) → `hasSpecs:true` but
  `hasOemLicense:FALSE` (no OS license, per prototype).
- Monitors/peripherals/phones/tablets/network non-server/etc. →
  `hasSpecs:false, hasOemLicense:false, requiresSerial:true (devices/network)`.
- Furniture → `hasTypeField:true, requiresSerial:false, hasSpecs:false, hasOemLicense:false`.

`categoryCapabilities(cat)` resolution order (one derivation point):
1. Explicit Firestore doc flag (admin override) when the field is present (=== boolean).
2. Static taxonomy table by `cat.id`.
3. Group/name heuristic fallback (unknown / admin-created custom categories).

Why static table over Firestore-only: capabilities are intrinsic taxonomy config
(not per-tenant business data → allowed by hard rules); works for the ~25 live
seeded categories with no redeploy; one source of truth; group fallback covers
custom categories. Belt-and-braces: also preserve flags from Firestore docs in the
mapper AND seed/backfill them, so admin overrides survive and live data is correct.

## Tasks (sequential)
1. domain-modeler: create `src/domain/asset/categoryCapabilities.ts` with the
   taxonomy table + `resolveCategoryCapabilities(cat)`; export from domain barrel.
   Move the capability logic out of CategoryPicker into domain; CategoryPicker +
   AssetDetailPage re-export / import from domain (keep `categoryCapabilities` name
   stable to avoid churn — re-export). Keep `CategoryCapabilities` interface.
   Add `*.test.ts` proving taxonomy correctness (computer→OEM+specs, macbook→specs
   no-OEM, monitor→none+serial, furniture→type no-serial, unknown→group fallback,
   Firestore explicit flag overrides taxonomy).
2. firebase-engineer:
   a. Fix BOTH category mappers in `firestoreAssetRepository.ts` to preserve
      `hasSpecs, hasOemLicense, requiresSerial, hasTypeField` when present on the doc
      (only set the field when the doc actually has a boolean — keep undefined
      otherwise so the taxonomy/heuristic fallback in resolve still runs).
   b. Add the flags to the seed: `CategorySeed` gains the 4 flags, derived from the
      same taxonomy; `buildSeed.ts` writes them. Update `buildSeed.test.ts`.
   c. data-migration: a non-destructive backfill script `scripts/backfill-category-caps.ts`
      that patches existing live `categories/*` docs with the 4 flags from the taxonomy
      (merge, no overwrite of other fields). Run it (ADC configured). Report exactly
      what was written.
   Add a test proving the Firestore category mapper preserves the flags.
3. react-ui-engineer: verify caps wiring end-to-end (create form gates license/specs/
   serial/type by caps; detail page `canManageLicense`/`showSpecs`). Add a test that
   the create form shows the license section for an OEM category (cat_computer) and
   hides it for a non-OEM (cat_monitor / cat_macbook_air).

## Reviews
- spec-reviewer (taxonomy matches prototype; MVP boundary; RU-only; component-first).
- code-quality-reviewer (one source of truth; no scattered duplication; mapper hygiene).

## DoD
- typecheck 0, build 0.
- full vitest: no NEW failures vs baseline (111 files / 1025 green; ignore the known
  flaky AssetCreateForm.freekey timeout that passes in isolation).
- New tests: mapper preserves flags; create form shows license for OEM category.
- Manual: Компьютер → license+specs+serial; Монитор → no license/specs, serial;
  furniture → type field, no specs/license; MacBook → specs, NO license.

## Hard rules
RU-only locales. Data from Firestore (static taxonomy table is config, OK). No prototype
mock import. Reuse shared LicensePicker. All writes audited (backfill is a non-destructive
field add — fine, no audit). No git commit/push. No new Cloud Function dependency.
