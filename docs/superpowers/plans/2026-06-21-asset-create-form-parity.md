# Asset Create Form — Full Prototype Parity Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the production React asset registration form (`AssetCreateForm`) to full visual + logic parity with `prototypes/preview.html` — group tabs, searchable category, condition/warranty with month-arithmetic warranty derivation, spec builders (RAM/Storage multi-slot, CPU combobox, GPU free-text), OS license (manual key / digital OEM + free-key pool), quick-assign (warehouse/employee/branch/department + work-mode for laptops), and GROUP mode (auto-advance stepper, dual uniqueness) — wired to real Firestore repos through audited writes.

**Architecture:** Decompose into focused child components under `src/components/features/assets/create/`. The parent `AssetCreateForm` keeps the same props contract and the same test-queried accessible names (Category `<select>`, OEM labels, "Склад"/"Сохранить" buttons) so existing `oem.test.tsx` + `freekey.test.tsx` stay green. Single-mode submit = existing `createAsset` (audited) + OEM coupling + assignment. Group-mode submit = new `createAssetsBatch` repo method looping audited `createAsset`. Dual uniqueness enforced via `isInvCodeTaken`/`isSerialTaken` Firestore queries at save + within-batch checks.

**Tech Stack:** React 19, Vite, TS strict, Firebase modular SDK, i18next (ru only), Tailwind dark/orange, Vitest + Testing Library.

---

## File Structure

- `src/components/features/assets/create/warranty.ts` — NEW pure helpers: `addYearsISO`, `addMonthsISO`, `oneYearFrom`, `todayISO`, `formatDateRU`. Month/year arithmetic via `Date.setFullYear/setMonth`, never `n*30*86400000`.
- `src/components/features/assets/create/ramStorage.ts` — NEW pure helpers: parse/serialize RAM (`parseRamValue`/`serializeRam`) and Storage (`parseStorageValue`/`serializeStorage`), `nextInvCode`, `pluralAssets`.
- `src/components/features/assets/create/GroupTabs.tsx` — NEW group pills (Устройства/Сетевые устройства/Мебель) with live counts.
- `src/components/features/assets/create/CategoryPicker.tsx` — MODIFY: keep native `<select>` accessible name "Категория" (test contract) but render group-prefixed options; expose capability flags. Add `requiresSerial`/`hasOemLicense`/`hasSpecs`/`isServer`/`isLaptop`/`isNetwork`/`hasTypeField` derivation.
- `src/components/features/assets/create/ConditionWarranty.tsx` — NEW Новый/Б/У toggle + purchase/warranty DatePickers with derivation + validation.
- `src/components/features/assets/create/SpecsPanel.tsx` — NEW Характеристики: CPU SpecCombobox, GPU input (default "Встроенная"), RamSlots, StorageSlots.
- `src/components/features/assets/create/SpecCombobox.tsx` — NEW free-text combobox with suggestion dropdown (CPU list).
- `src/components/features/assets/create/RamSlots.tsx` — NEW DDR-type + auto-numbered size slots + «Добавить».
- `src/components/features/assets/create/StorageSlots.tsx` — NEW type+size rows + «Добавить».
- `src/components/features/assets/create/specSuggestions.ts` — NEW CPU suggestions, RAM/STORAGE size+type dictionaries.
- `src/components/features/assets/create/GroupStepper.tsx` — NEW quantity + progress + confirmed rows + active-row form with Enter auto-advance + dual uniqueness.
- `src/components/features/assets/create/DatePicker.tsx` — NEW themed calendar (port of prototype) OR reuse if exists. (Port.)
- `src/components/features/assets/create/QuickAssignment.tsx` — MODIFY: 4 mode cards (icons), work-mode toggle for laptops, network gating (warehouse+employee only), keep "Склад" button name.
- `src/components/features/assets/create/AssetCreateForm.tsx` — MODIFY: orchestrate 2-column layout + group mode; preserve test contracts.
- `src/domain/asset/types.ts` — MODIFY: add `condition`/`purchaseDate`/`warrantyEndsAt`/`workMode` to `CreateAssetInput`; add `hasTypeField`/`hasSpecs`/`requiresSerial`/`type` to `CategoryRow` (optional, back-compat).
- `src/domain/asset/AssetRepository.ts` — MODIFY: extend `CreateAssetInput`; add `createAssetsBatch` to `AssetWriteRepository`.
- `src/infra/repositories/firestoreAssetRepository.ts` + `inMemoryAssetRepository.ts` — MODIFY: persist new fields; implement `createAssetsBatch`; within-batch dedupe.
- `src/pages/AssetCreatePage.tsx` — MODIFY: handle group submit.
- `src/locales/ru/assets.json` — MODIFY: add new keys.
- Tests: `warranty.test.ts`, `ramStorage.test.ts`, `GroupStepper.test.tsx`, `QuickAssignment.test.tsx`, `AssetCreateForm.parity.test.tsx`, repo `createAssetsBatch` test.

---

## Design decisions (locked)

1. **Test-contract preservation:** Category control stays a `<select>` (role combobox, name "Категория"). Group tabs sit *above* it as a visual filter that also sets the select. OEM input labels and "Склад"/"Сохранить" button names unchanged. This keeps `oem.test.tsx` (3) + `freekey.test.tsx` (4) passing.
2. **Warranty math:** `addMonthsISO`/`addYearsISO` use `Date.setMonth`/`setFullYear`. Default warranty = purchase + 1 year. Warranty < purchase is rejected.
3. **GPU:** plain `Input` pre-filled `Встроенная`; serialized into `currentSpecs.gpu` (omitted if blank — matches prototype `specsForPayload`).
4. **RAM/Storage:** serialized strings stored in `currentSpecs.ram` / `currentSpecs.ssd` (matches existing `AssetSpecs` shape — no schema break).
5. **Quick-assign → status:** warehouse → null assignment → `st_warehouse`; employee/branch/department → assignment + `st_assigned`. `workMode` only for laptops + employee/department. Branch defaults `br_main` for non-branch modes (`refData.branches[0]`).
6. **Dual uniqueness (GOLDEN RULE):** single mode → `isInvCodeTaken`/`isSerialTaken` before submit (page already maps errors). Group mode → within-batch dedupe in stepper (prototype parity) + `createAssetsBatch` re-checks each against Firestore + accumulates seen codes/serials, throwing on first dup. Server follow-up: Firestore rule / Cloud Function (not deployable now, no Blaze) — noted.
7. **Network gating:** network group shows only Warehouse + Employee QA modes (prototype parity).
8. **Group mode:** lands on warehouse only (bulk-transfer deferred). One `createAssetsBatch` call → N audited creates.

---

## Task 1: Warranty + format helpers (pure, TDD)

**Files:**
- Create: `src/components/features/assets/create/warranty.ts`
- Test: `src/components/features/assets/create/warranty.test.ts`

- [ ] Step 1: write `warranty.test.ts` covering: `addMonthsISO('2026-01-31',1)` rolls correctly, `addYearsISO('2026-02-29'?,1)`, `oneYearFrom(today)=+1yr`, `formatDateRU`, and that arithmetic is NOT `n*30*86400000` (assert `addYearsISO('2024-03-01',1)==='2025-03-01'`).
- [ ] Step 2: run, expect FAIL.
- [ ] Step 3: implement helpers with `Date` setters + `formatLocalISO`.
- [ ] Step 4: run, expect PASS.

## Task 2: RAM/Storage/invCode helpers (pure, TDD)

**Files:**
- Create: `src/components/features/assets/create/ramStorage.ts`
- Test: `src/components/features/assets/create/ramStorage.test.ts`

- [ ] Test round-trips: `serializeRam(parseRamValue('16 ГБ + 32 ГБ DDR4'))` stable; storage `'SSD 256 ГБ + HDD 1 ТБ'` stable; `nextInvCode('460/00007')==='460/00008'`, `nextInvCode('LAP-099')==='LAP-100'`; `pluralAssets(1/2/5)`.
- [ ] Implement (port prototype functions). Run PASS.

## Task 3: spec suggestions + DatePicker + SpecCombobox

**Files:**
- Create: `specSuggestions.ts`, `DatePicker.tsx`, `SpecCombobox.tsx`

- [ ] Port `specSuggestions.ts` (CPU list, RAM_SIZES, RAM_TYPES, STORAGE_SIZES, STORAGE_TYPES).
- [ ] Port `DatePicker.tsx` to TS (themed calendar, portal). Reuse existing `Icon`.
- [ ] Port `SpecCombobox.tsx` to TS.
- [ ] typecheck clean.

## Task 4: RamSlots + StorageSlots + SpecsPanel

**Files:** Create `RamSlots.tsx`, `StorageSlots.tsx`, `SpecsPanel.tsx`. Use `SelectMini`.

- [ ] Port builders; SpecsPanel composes CPU/GPU/RAM/Storage; emits to `currentSpecs`.

## Task 5: ConditionWarranty + GroupTabs + QuickAssignment + GroupStepper

**Files:** Create `ConditionWarranty.tsx`, `GroupTabs.tsx`, `GroupStepper.tsx`; modify `QuickAssignment.tsx`, `CategoryPicker.tsx`.

- [ ] `GroupStepper.test.tsx`: confirm advances invCode, dup blocks, pull-back/delete.
- [ ] `QuickAssignment.test.tsx`: warehouse→null, employee→assignment, network gating, laptop work-mode.
- [ ] Implement all. Run new tests PASS.

## Task 6: domain + repo (CreateAssetInput fields, createAssetsBatch)

**Files:** modify `types.ts`, `AssetRepository.ts`, both repos.

- [ ] Add optional `condition`/`purchaseDate`/`warrantyEndsAt`/`workMode` to `CreateAssetInput`; persist in both repos.
- [ ] Add `createAssetsBatch(inputs, actor)` to interface + both repos with within-batch + Firestore dup checks. Test in `inMemoryAssetRepository.write.test.ts`.

## Task 7: AssetCreateForm orchestration + page group submit

**Files:** modify `AssetCreateForm.tsx`, `AssetCreatePage.tsx`, `assets.json`.

- [ ] Compose 2-column layout + group mode; preserve test contracts.
- [ ] Page: group submit → `createAssetsBatch`.
- [ ] `AssetCreateForm.parity.test.tsx`: group tabs render, condition toggle, warranty derive, single+group save shapes.

## Task 8: Verify

- [ ] `npm run typecheck` exit 0.
- [ ] `npm run test` — 932 baseline still green + new tests; only allowed deviation = the one known freekey flaky timeout (passes in isolation).
