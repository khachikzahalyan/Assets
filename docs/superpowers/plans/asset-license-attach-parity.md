# Plan — Asset-side "Add/Attach License" parity (create + detail)

Slug: `asset-license-attach-parity`
Owner: warehouse-orchestrator (AMS)
Date: 2026-06-21

## Problem

The "add license" capability is incomplete on the asset side:

- **Create form** (`AssetCreateForm.tsx`): license section is largely present (digital/manual
  toggle, free-OEM-pool picker, manual key + masking, audited coupling). Picker logic is inline,
  not shared. No regression desired — `AssetCreateForm.oem` + `AssetCreateForm.freekey` tests must
  keep passing.
- **Detail page** (`LicenseBlock.tsx`): when the asset has NO license the block renders `null` — there
  is **no attach affordance**. No way to add / change / detach a license from the asset detail page.
  This is the core gap.

## Goal

Component-first parity: one shared `LicensePicker` used by BOTH screens. Detail page gains an
"Добавить лицензию" empty-state that opens the same picker and couples the chosen/created license to
the asset through the existing AUDITED repository path; allow detach when a license is bound. Raw keys
NEVER written to Firestore from the client — routed through the existing `setLicenseKey` callable.

## Constraints (hard rules)

- RUSSIAN-ONLY locales (`src/locales/ru/*.json`). Reuse existing keys where possible.
- Data ONLY from existing Firestore license/asset repositories. NEVER import prototype mock (AMS_MOCK).
- All writes via existing audited repo methods (`createLicense`, `assignLicense`, `decoupleLicense`)
  + the existing `setLicenseKey` callable. No audit bypass. No NEW Cloud Function.
- Component-first: extract reusable `LicensePicker` consumed by create + detail.
- No git commit/push/checkout.

## Existing building blocks (reuse, do NOT reinvent)

- Domain: `WorkstationLicense`, `CreateWorkstationLicenseInput` (`rawKey` -> secrets only),
  `AssignWorkstationLicenseInput`.
- Repo port `WorkstationLicenseRepository`: `listForAsset`, `listAssignablePool`, `createLicense`,
  `assignLicense`, `decoupleLicense`. Firestore + InMemory adapters exist.
- `setLicenseKey(collection, licenseId, rawKey)` client wrapper (`src/lib/licenses/revealKey.ts`).
- `maskLicenseKey` (`src/lib/audit/maskSecrets.ts`).
- `SpecCombobox` (portal dropdown) — reuse for the pool/key field.
- `RevealKeyButton` — already used by LicenseBlock for non-OEM key reveal.
- Detail page already has `licenseRepo`, `actor`, and `load()` refresh.

## Design

### 1. Shared component: `src/components/features/licenses/LicensePicker.tsx`

Pure controlled component. NO Firebase imports. Props:

```ts
interface LicensePickerValue {
  licenseMode: 'oem_digital' | 'manual'
  rawKey: string          // formatted 5-5-5-5-5 (manual mode, new key)
  pickId: string          // selected existing free-pool license id (mutually exclusive w/ rawKey)
}
interface LicensePickerProps {
  value: LicensePickerValue
  onChange: (v: LicensePickerValue) => void
  pool: { id: string; name: string; vendor: string | null }[]
  /** When true (detail-attach) include 'oem_digital' card; create form already gates by category. */
  showDigital?: boolean   // default true
  idPrefix?: string       // 'asset-oem' (create) | 'attach-oem' (detail) -> stable label ids
}
```

Renders the prototype's two mode cards (Цифровая / Ручной ввод) + the manual key SpecCombobox + the
hidden sr-only `<select>` (pool) and `<input>` (raw key) for test accessibility, identical to the
current create-form markup. Owns `formatOemKey`. Mutual exclusivity (typing raw key clears pickId;
selecting pool clears rawKey). Masked preview line + secure hint. Visual parity with create form
(dark/orange tokens already in current JSX).

Export `formatOemKey` + the empty value factory from the same file so create + detail share them.

### 2. Refactor create form to consume `LicensePicker`

- Replace the inline OS-license block (lines ~338-449) with `<LicensePicker .../>`.
- Keep `licenseMode`/`oemRawKey`/`oemPickId`/`oemPool` state in AssetCreateForm (adapter), feed the
  picker value, map back. Keep `showDigital` true; section still gated by `showOemKey && !isGroup`.
- `baseInput()` oemLicense derivation unchanged.
- The sr-only `<select id="asset-oem-pick-hidden">` and `<input id="asset-oem-key-raw">` MUST remain
  with the SAME ids/labels so `AssetCreateForm.oem` + `.freekey` tests pass unchanged.

### 3. Detail page attach flow

New component `src/components/features/assets/detail/LicenseAttachPanel.tsx` (presentational + thin
callbacks). Renders inside `LicenseBlock` when no license is bound.

States:
- **Empty (no license):** muted line `detail.license.none` + secondary "Добавить лицензию" button
  (icon `plus`). Gated to `canManage` (super_admin || tech_admin — same roles `setLicenseKey` allows).
- **Picker open:** `<LicensePicker>` (showDigital=true) + pool loaded via `listAssignablePool` filtered
  to `type==='OEM' && unassigned && active`. Confirm (`Привязать`) + Cancel. Confirm disabled until a
  valid choice (pickId OR (manual && rawKey)) — or digital mode (creates an OEM-digital license w/o key).
- **Bound (license present):** existing display (name + OEM/Retail chip + reveal/builtIn) PLUS an
  "Открепить" (detach) action gated to `canManage` (uses `licenses.actions.decouple` +
  `licenses.decoupleConfirm`).

`LicenseBlock` gets new optional props so it stays render-pure and test-friendly:
```ts
interface LicenseBlockProps {
  asset: Asset
  licenses: WorkstationLicense[]
  canManage?: boolean
  onAttach?: (choice: AttachChoice) => Promise<void>  // undefined => read-only (current behavior)
  onDetach?: (licenseId: string) => Promise<void>
  pool?: { id: string; name: string; vendor: string | null }[]
  busy?: boolean
}
type AttachChoice =
  | { kind: 'existing'; licenseId: string }
  | { kind: 'new-key'; rawKey: string }
  | { kind: 'oem-digital' }
```
When `onAttach` is undefined the block keeps today's exact behavior (returns null if no license) so the
existing `AssetDetailPage` tests that don't exercise attach remain green unless intentionally updated.

### 4. Detail page wiring (`AssetDetailPage.tsx`)

- Load pool: add `licenseRepo.listAssignablePool()` to the `Promise.all` in `load()`; filter to free OEM;
  store in `licensePool` state.
- `canManage = role === 'super_admin' || role === 'tech_admin'` AND `!isDisposed`.
- `onAttach(choice)`:
  - `existing` -> `licenseRepo.assignLicense(licenseId, { to:'device', assetId: asset.id }, actor)`.
  - `oem-digital` -> `licenseRepo.createLicense({ name: 'OEM — '+brand+' '+model, type:'OEM',
    isReusable:false, assign:{to:'device',assetId} }, actor)` (no key).
  - `new-key` -> `createLicense({ name, type:'OEM', isReusable:false, rawKey, assign:{to:'device',assetId} })`
    then resolve licenseId via `listForAsset` and call `setLicenseKey('licenses', id, rawKey)`
    (best-effort; non-fatal warning on failure — mirror AssetCreatePage pattern). Inject
    `onPersistOemSecret?` prop on AssetDetailPage for test stubbing (default = setLicenseKey callable).
  - then `await load()`.
- `onDetach(id)` -> `licenseRepo.decoupleLicense(id, actor)` then `load()`.
- Pass `canManage`, `onAttach`, `onDetach`, `pool`, `busy` to `TechSpecsCard` -> `LicenseBlock`.
- TechSpecsCard: thread the new props through. Also: the specs tab currently only renders TechSpecsCard
  when `caps?.hasSpecs`. License attach must show for OS-bearing categories — render the license area
  whenever `caps?.hasOemLicense` even if `!hasSpecs` (TechSpecsCard already renders license section when
  `licenses.length>0`; extend so the attach empty-state shows when `canManage && caps.hasOemLicense`).

### 5. Locales (ru only)

Add under `assets:detail.license`:
- `add: "Добавить лицензию"`
- `attachTitle: "Привязать лицензию"`
- `attach: "Привязать"`
- `detach: "Открепить"`
- `detachConfirm: "Открепить лицензию от актива? Это действие будет записано в журнал аудита."`
- `attachFailed: "Не удалось привязать лицензию. Попробуйте ещё раз."`
- `cancel: "Отмена"`
Reuse existing `osLicense.*`, `oem.*`, `detail.license.{none,oem,retail,builtIn,title}`,
`validation.oemKeyNotStored`.

## Task order (sequential, test-gated)

1. **react-ui-engineer** — build `LicensePicker` (extract from create form), refactor `AssetCreateForm`
   to consume it (keep sr-only hooks + ids). Add ru locale keys.
   -> test-engineer: run create-form oem/freekey tests + new LicensePicker unit test. MUST pass.
2. **react-ui-engineer** — build `LicenseAttachPanel`, extend `LicenseBlock` (new optional props,
   keep read-only default), thread props through `TechSpecsCard`.
   -> test-engineer: LicenseBlock attach/detach render tests. MUST pass.
3. **firebase-engineer** — wire `AssetDetailPage` (pool load, canManage, onAttach/onDetach handlers,
   onPersistOemSecret prop, audited coupling). Ensure raw key only via setLicenseKey.
   -> test-engineer: AssetDetailPage attach flow tests (existing + new-key + detach), masking, audit.
4. Reviews: spec-reviewer, code-quality-reviewer, security-reviewer.
5. Verify: typecheck + build + full vitest (no NEW failures vs 1006 baseline).

## Verification

- `npm run typecheck` exit 0.
- `npm run build` exit 0.
- `npm run test` — >= 1006 prior tests green + new tests; list any intentionally changed tests.
- Visual: dark theme parity with prototype license blocks.

## Rollback

All changes additive/refactor in named files. Revert the listed files to restore prior behavior;
`LicenseBlock` read-only default means partial revert is safe.
