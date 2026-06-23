# Implementation Plan — Запчасти (Parts / Spare-Parts Inventory)

Plan id: `2026-06-23-parts-warehouse`
Feature spec: `docs/features/parts.md` (source of truth — do NOT contradict)
Prototype reference (read-only): `Warehouse/prototypes/parts.html` + `Warehouse/prototypes/_shared/mock-data.js`
Confirmed scope (user, all option A): Q1 full parity · Q2 event-sourced · Q3 full repository stack.

Working dir: `C:/Users/DELL/Desktop/assets-crm`. All paths absolute, forward slashes.

---

## 0. Architecture summary (the one paragraph that matters)

Two new collections — `parts` (SKU catalog) and `part_movements` (append-only journal).
**Stock is DERIVED from movements, never stored authoritatively.** The `parts` doc keeps a
denormalised `{ onHand, broken }` snapshot recomputed from the SKU's movements on every
write (so list reads don't need to scan the whole journal), but the journal is the truth.
Each mutating repository method runs inside `withAudit(...)` so the data write and exactly
one `audit_logs` write land in the same Firestore transaction. An install both appends an
`install` movement AND mutates the target asset's `upgradeCurrent` array — in the SAME
transaction — so stock and the asset's hardware snapshot can never desync.

Stock invariant (from spec §3, verified against prototype `skuStockMap` lines 3086-3108):
```
onHand = Σ(receive.qty) − Σ(install.qty) + Σ(uninstall.qty where !broken)
broken = Σ(uninstall.qty where broken)
working (UI) = max(0, onHand − broken)
Movements with serviceReplace === true are SKIPPED entirely in stock math.
```

---

## 1. Domain layer (`src/domain/part/`) — domain-modeler

### Files to CREATE
- `src/domain/part/types.ts`
- `src/domain/part/PartRepository.ts`
- `src/domain/part/partStock.ts` (pure stock-derivation + slot-resolution helpers)
- `src/domain/part/index.ts` (barrel)
- `src/domain/part/partStock.test.ts` (pure-function unit tests — domain-modeler may stub; test-engineer owns final)

### Files to MODIFY
- `src/domain/audit/types.ts` — extend the two enums (see §1.4).

### 1.1 `types.ts` — exact shapes (mirror spec §5)

```ts
export const PART_CATEGORIES = ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'] as const
export type PartCategory = (typeof PART_CATEGORIES)[number]

/** Categories an asset can hold at most ONE of (non-server). */
export const SINGLE_SLOT_CATS: ReadonlySet<PartCategory> = new Set(['psu', 'cooler', 'gpu'])

export const MOVEMENT_TYPES = ['receive', 'install', 'uninstall'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export interface Part {            // parts/{id}
  id: string                       // e.g. 'sku_ram_16gb_ddr4', 'gpu_<slug>'
  name: string                     // Tier-4 EN-only free text
  category: PartCategory
  variantId?: string | null        // e.g. '16gb' (RAM/storage variants)
  variantLabel?: string | null     // e.g. '16 ГБ'
  ddr?: string | null              // RAM only: 'DDR3'|'DDR4'|'DDR5'
  unit: string                     // 'шт'
  onHand: number                   // DERIVED snapshot, recomputed every write
  broken: number                   // DERIVED snapshot, recomputed every write
  lowStockThreshold: number        // default 5 (3 for variant SKUs per prototype)
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface PartMovement {    // part_movements/{id} — append-only
  id: string
  type: MovementType
  skuId: string
  qty: number                      // always positive
  broken: boolean                  // uninstall only; scrap when true (false otherwise)
  assetId: string | null           // internal asset slug (install/uninstall target)
  assetInvCode: string | null      // denormalised for journal display
  serviceReplace: boolean          // true → stock NOT debited (service device)
  note: string | null              // Tier-3
  reason: string | null            // human label (matches prototype 'reason' strings)
  actorUid: string
  actorRole: Role
  at: string                       // ISO timestamp
}

export interface PartStock { onHand: number; broken: number }   // derived view

/** Read-model projection of an upgradeable asset (UPGRADEABLE_CATEGORIES). */
export interface PartsAsset {
  id: string            // invCode (display id, e.g. 'LAP/00035')
  assetId: string       // internal slug
  categoryId: string
  kind: string          // server family → 'Сетевые Устройство'; else category name
  name: string          // brand + model
  user: string          // assignee display
  upgradeCurrent: UpgradeSlot[]
}

/** One entry of the asset's live hardware snapshot. Mirrors prototype upgradeCurrent. */
export interface UpgradeSlot {
  kind: string                 // 'ram'|'storage'|'cooler'|'psu'|'battery'
  spec: string                 // '' = empty factory slot (still a real component)
  storageType?: string | null  // 'SSD'|'HDD'|'M.2' for storage slots
  installedAt?: string | null
  replaced?: boolean
}
```
Reuse the existing `Role` import from `@/config/roles`.

### 1.2 `partStock.ts` — pure helpers (port the prototype's deterministic logic)

These functions MUST be pure (no Firebase, no localStorage) so they run in both adapters and
in unit tests. Port directly from the prototype, citing line numbers:

- `deriveStock(movements: PartMovement[]): Record<string, PartStock>` — port `skuStockMap`
  (parts.html 3086-3108). Skip `serviceReplace`. `receive` +onHand; `install` −onHand;
  `uninstall` broken→+broken else +onHand. Clamp negatives to 0.
- `workingStock(s: PartStock): number` → `Math.max(0, s.onHand - s.broken)`.
- `SKU_TO_SLOT_KIND` + `slotKindForSku(skuCat, assetFamily): string | null` — port mock-data
  1367-1381. `psu` → `'battery'` on laptop family else `'psu'`; ram→'ram'; ssd/hdd/nvme→'storage';
  cooler→'cooler'.
- `storageTypeForSku(skuCat): 'SSD'|'HDD'|'M.2'|null` — port mock-data 1374-1385.
- `slotIsSingle(slotKind, assetFamily): boolean` — port 1392-1398. battery→true;
  cooler/psu→ (family !== 'server'); ram/storage→false.
- `currentPartsForSkuCategory(upgradeCurrent, skuCat, assetFamily): { idx; slot; isEmpty }[]`
  — port 1417-1428. Filter `upgradeCurrent` by resolved slotKind (NOT by storageType — storage
  cats share the bay pool). Empty-spec entries still count.
- `assetFamilyOf(categoryId): 'laptop'|'desktop'|'server'|'aio'|...` — reuse the production
  asset domain's family helper if one exists (check `src/domain/asset/`); otherwise define a
  minimal map keyed by the production category ids. **domain-modeler: confirm the production
  family-resolution helper before duplicating it.**
- `isServiceOnly(categoryId): boolean` — laptop family or AIO → true (mock-data 360).

### 1.3 `PartRepository.ts` — port + write port

Split read/write like `AssetRepository` / `AssetWriteRepository`.

```ts
export interface PartReferenceData {
  parts: Part[]                 // catalog with derived onHand/broken snapshots
  movements: PartMovement[]     // full journal (MVP: load all; Phase 2 paginate)
  partsAssets: PartsAsset[]     // upgradeable-asset projection for the Devices tab
}

export interface PartRepository {
  loadReferenceData(): Promise<PartReferenceData>
  listMovementsForSku(skuId: string): Promise<PartMovement[]>
  listMovementsForAsset(assetId: string): Promise<PartMovement[]>
}

export interface ReceiveItem { skuId: string; qty: number }

export interface InstallInput {
  skuId: string
  assetId: string                 // internal slug
  assetInvCode: string
  assetCategoryId: string
  action: 'install' | 'replace'
  replaceUcIndex: number | null   // index into upgradeCurrent to overwrite (replace only)
  oldIsBroken: boolean            // replace only: scrap old vs return-to-shelf
  serviceReplace: boolean
  note?: string | null
}

export interface UninstallInput {
  skuId: string
  assetId: string
  assetInvCode: string
  assetCategoryId: string
  broken: boolean
  serviceReplace: boolean
  note?: string | null
}

export interface CreateGpuInput { name: string; initialQty: number }

export interface PartWriteRepository {
  receiveParts(items: ReceiveItem[], actor: Actor): Promise<AuditedResult<PartMovement[]>>
  installPart(input: InstallInput, actor: Actor): Promise<AuditedResult<PartMovement>>
  uninstallPart(input: UninstallInput, actor: Actor): Promise<AuditedResult<PartMovement>>
  createGpu(input: CreateGpuInput, actor: Actor): Promise<AuditedResult<Part>>
  deleteGpu(skuId: string, actor: Actor): Promise<AuditedResult<void>>  // GPU-only; blocked if installed
}
```
Reuse the existing `Actor` and `AuditedResult` types from the asset/audit domain
(domain-modeler: import them, do not redefine).

### 1.4 `src/domain/audit/types.ts` — additive enum extension (EXACT)

In `AuditEntityType` union, add after `'upgrade'`:
```
  | 'part' | 'part_movement'
```
In `AUDIT_ACTIONS` array, append these six (keep trailing comma style):
```
  'part_received', 'part_installed', 'part_uninstalled', 'part_scrapped', 'part_returned', 'gpu_created',
```
This is additive and non-breaking (mirrors `subscription_created` precedent). Do not reorder or
remove existing entries.

### 1.5 Audit action mapping (which action each write emits) — spec §7
| Operation | entityType | action | before / after |
|---|---|---|---|
| receive stock (per item) | `part_movement` | `part_received` | null → { skuId, qty } |
| install (no old part) | `part` | `part_installed` | { upgradeCurrent } before/after |
| replace, old returned | `part` | `part_returned` | upgradeCurrent + { returnedSkuId } |
| replace, old scrapped | `part` | `part_scrapped` | upgradeCurrent + { scrappedSlot } |
| uninstall → shelf | `part` | `part_returned` | upgradeCurrent before/after |
| uninstall → scrap | `part` | `part_scrapped` | upgradeCurrent before/after |
| create GPU SKU | `part` | `gpu_created` | null → SKU |
`part_uninstalled` is the umbrella action for any uninstall where the return/scrap distinction
is irrelevant — use `part_returned`/`part_scrapped` when known (above), `part_uninstalled` only
as a fallback. (One emitted action per write — never two.)

### domain-modeler verification
`npm run build` (type-check) + `npm test -- --run src/domain/part`. Report exported symbols.

---

## 2. Infra layer (Firestore + in-memory adapters) — firebase-engineer

### Files to CREATE
- `src/infra/repositories/inMemoryPartRepository.ts`
- `src/infra/repositories/firestorePartRepository.ts`
- (extend) `src/infra/repositories/factories.ts` — add `createDefaultPartRepository()`.
- `firestore.rules` — add `/parts` and `/part_movements` blocks (see §2.4).
- `firestore.indexes.json` — composite index for movements by `skuId`+`at`, `assetId`+`at`.

### 2.1 Shared write semantics (BOTH adapters implement identically)

All movement-id and timestamp generation, stock recompute, and upgradeCurrent mutation live in
the adapter and MUST match the prototype handlers:

- **receiveParts** (port `handleAddConfirm`, parts.html 3315-3354): for each item with qty≥1,
  append one `receive` movement `{ type:'receive', skuId, qty, assetId:null, reason:'Поставка' }`.
  Recompute the affected SKUs' `{onHand,broken}` snapshots via `deriveStock`. Emit ONE audit
  entry of action `part_received` per call (entityType `part_movement`, after = summary
  `{ items, totalQty }`). Inside one `withAudit` transaction.
- **installPart** (port `handleInstallConfirm`, parts.html 3211-3312):
  1. Append one `install` movement `{ type:'install', skuId, qty:1, assetId, assetInvCode,
     serviceReplace, reason }`. `reason` mirrors prototype: service→'Заменено через сервис';
     replace+broken→'Установка взамен неисправного'; replace+!broken→'Установка взамен
     (плановая замена)'; install→'Установка в актив'.
  2. Mutate the asset's `upgradeCurrent`: if `action==='replace'` and `replaceUcIndex` valid,
     overwrite that entry in place (`spec=newSpec`, `replaced=true`, `installedAt=now`, set
     `storageType` for storage). Else push a new entry `{ kind, spec, installedAt, replaced:false,
     storageType? }`. `newSpec = name + (variantLabel ? ' '+variantLabel : '')`. (parts.html
     3264-3298.)
  3. Stock: service → snapshot unchanged (deriveStock skips serviceReplace movements).
     in-house → recompute (install debits onHand). Replace of a uc-sourced/factory entry emits
     NO uninstall movement (the in-place uc mutation is the swap record) — matches prototype
     comment 3238-3243.
  4. Recompute snapshot for `skuId`. Audit action per §1.5. ONE `withAudit` txn wraps the
     movement write + asset upgradeCurrent write + audit write.
- **uninstallPart** (port `handleUninstallConfirm`, parts.html 3411-3463):
  - service → one `uninstall` movement `{ broken:false, serviceReplace:true, reason:'Снято как
    заменённое через сервис' }`; snapshot unchanged.
  - in-house → one `uninstall` movement `{ broken, serviceReplace:false, reason: broken ? 'Снято
    как неисправное' : 'Снятие с актива · возврат на склад' }`; recompute snapshot
    (broken→+broken, else +onHand). Remove the matching `upgradeCurrent` entry (find by resolved
    slotKind; if multiple, remove the most-recently-installed or the one the caller targets —
    keep parity with how the prototype's installed list maps rows). Audit per §1.5. ONE txn.
- **createGpu** (port `handleGpuAdd`, parts.html 3360-3387): create `parts/{id}` with
  `id='gpu_'+slug(+ts)`, category 'gpu', then if qty>0 append one `receive` movement for the
  initial stock (movements are the truth — do NOT set onHand directly except as the recomputed
  snapshot). Audit `gpu_created`. ONE txn.
- **deleteGpu** (port `handleGpuDelete`, parts.html 3391-3404): GPU category only; block if any
  asset currently has it installed (derive installed count from movements). Hard-delete the SKU
  doc. (No audit action defined → emit `deleted` umbrella action, entityType `part`.)

### 2.2 `inMemoryPartRepository`
Constructor `(parts: Part[], movements: PartMovement[], partsAssets: PartsAsset[], audit:
AuditContext = inMemoryAuditContext(createInMemoryAuditStore()))`. Mirror
`inMemoryAssetRepository.ts` exactly: keep arrays in memory, run mutations through
`withAudit(this.audit, spec, async (txn) => {...})`, return `AuditedResult`. `loadReferenceData`
returns current arrays with freshly-recomputed snapshots. This is the adapter the tests use.

### 2.3 `firestorePartRepository`
Mirror `firestoreAssetRepository.ts`. Imports: modular v9 only. Reads via `getDocs`/`getDoc`.
Writes via `runTransaction` inside `withAudit(firestoreAuditContext(db), spec, async (txn) =>
{...})`. `loadReferenceData` reads `parts` (getDocs), `part_movements` (getDocs ordered by `at`
desc), and projects `partsAssets` from the asset collection filtered to UPGRADEABLE_CATEGORIES —
reuse the asset repository's reference-data path or query assets directly; denormalise
brand+model+assignee+upgradeCurrent. For install/uninstall, READ the asset doc inside the txn,
mutate `currentSpecs`/`upgradeCurrent` (use whichever field the production asset doc carries —
**firebase-engineer: confirm the production asset field is `currentSpecs` and reconcile the
prototype's `upgradeCurrent` array with it; the spec §3 calls the live snapshot `upgradeCurrent`
but the production Asset type uses `currentSpecs` — if they differ, the install must update the
production field and the PartsAsset projection must read from it**). Recompute the SKU snapshot
inside the same txn.

### 2.4 `firestore.rules` blocks
```
match /parts/{id} {
  allow read:  if isSignedIn() && role() in ['super_admin','asset_admin','tech_admin'];
  allow create, update: if isSignedIn() && role() in ['super_admin','asset_admin','tech_admin'];
  allow delete: if false;   // GPU delete goes through a guarded path; revisit if needed
}
match /part_movements/{id} {
  allow read:   if isSignedIn() && role() in ['super_admin','asset_admin','tech_admin'];
  allow create: if isSignedIn() && role() in ['super_admin','asset_admin','tech_admin'];
  allow update, delete: if false;   // journal is immutable, like audit_logs
}
```
Role resolved server-side via existing `role()` helper (`get(/users/$(uid)).role`). Reuse the
existing `isSignedIn()`/`role()` helpers already in the file — do not redefine.
NOTE on deleteGpu: rules deny client delete. Either (a) drop deleteGpu from MVP, or (b) route it
through a Cloud Function. **firebase-engineer: prefer dropping client-side hard delete from MVP
to keep rules clean — surface a soft "cannot delete" toast in the UI instead, OR keep deleteGpu
in the in-memory repo for tests but make the Firestore adapter throw "not supported in MVP".
Pick the simpler path and document it. This is NOT a user fork — it is an infra-hygiene call.**

### firebase-engineer verification
`npm test -- --run src/infra/repositories` (in-memory) + `npm run build`. Rules tests if the
repo has a rules harness (`@firebase/rules-unit-testing`) — add `parts`/`part_movements` cases
mirroring the `audit_logs` immutability test.

---

## 3. Hook + Page + Components (UI) — react-ui-engineer

### Files to CREATE
- `src/hooks/useParts.ts` — mirror `useAssets.ts`. Returns `{ ref: PartReferenceData|null,
  loading, error, reload }` plus the write methods bound to the default repo + current actor.
  Snapshot/refresh pattern: load on mount; expose `reload()`; after any write, call `reload()`
  (MVP keeps it simple — no onSnapshot required for parity; matches AssetsPage's load-then-reload
  pattern). The hook owns the actor (from AuthContext) and the repository (from factory).
- `src/pages/PartsPage.tsx` — replaces the StubPage. Wraps in `RoleGate` via route table.
- `src/components/features/parts/` — the feature components, ported 1:1 in behavior from the
  prototype but using production UI primitives (`@/components/ui`) and i18n `t()`:
  - `PartsPage` body: stat strip (4 StatTiles), tab strip (`Склад` | `Устройства`), add button.
  - `WarehouseTab.tsx` — category card grid (`PartCard`) + per-category SKU rows + HistoryPanel
    (journal). Mobile: `CategoryChipStrip` + single detail panel.
  - `DevicesTab.tsx` — `DeviceGridCard` master list + `InstalledDetailPanel` / installed parts;
    per-row Install/Uninstall actions. Mobile: card list + `MobileSheet` bottom-sheet.
  - `PartCard.tsx`, `CategoryChipStrip.tsx`, `HistoryPanel.tsx`, `StatTile.tsx`,
    `DeviceGridCard.tsx`, `InstalledDetailPanel.tsx`.
  - Modals: `AddPartModal.tsx`, `InstallModal.tsx`, `UninstallModal.tsx`, `GpuAddModal.tsx`,
    `ServiceRecordModal.tsx`. Use production `MobileSheet`/`Drawer`/dialog primitives + portal
    pattern. Port the slot logic from the prototype InstallModal (parts.html 563-990) using the
    pure helpers from `src/domain/part/partStock.ts` — DO NOT reimplement slot math in the
    component; call the domain helpers.

### Files to MODIFY
- `src/config/nav.ts` — remove `phase: 2` from the `parts` nav item (line 31); remove `'parts'`
  from `PHASE_STUB_ROUTES` (line 81). This flips `/parts` from StubPage to the real page.
- `src/config/routes.tsx` — wire `/parts` → `<RoleGate roles={routeRoles('parts')}><PartsPage/>
  </RoleGate>`. Confirm `routeRoles('parts')` yields the three admin roles from nav `allow`.

### UI rules
- Use production primitives only (`PageHeader`, `SectionCard`, `EmptyState`, `LoadingState`,
  `ErrorState`, `Btn`/`Button`, `Chip`, `Badge`, `Icon`, `Input`, `Select`, `MobileSheet`,
  `Drawer`, `useModalA11y`) from `@/components/ui`. NO firebase imports in components — data via
  `useParts`. NO localStorage. NO inlined hex-soup if a primitive exists; the production app's
  theme differs from the prototype's dark palette — follow the production app's existing page
  styling (look at AssetsPage), not the prototype's literal Tailwind classes.
- Every user-facing string via `t()` (namespace `parts`). Part-category display labels
  (ОЗУ/SSD/Блоки/Кулеры/Видеокарта) are Tier-1 keys keyed by category id. SKU names, specs,
  units stay Tier-4 EN-only — rendered as-is, never translated, never `<MultiLangInput>`.
- Mobile adaptation: reactive `useIsMobile` (matchMedia 768px) — reuse the production app's
  existing mobile hook if one exists (the Assets list mobile port shipped — reuse its pattern;
  see memory `project_assetlist_mobile_port`). Modals become bottom-sheets on mobile.
- Loading/empty/error states wired to the hook's `{loading, error}` + empty `ref`.

### react-ui-engineer verification
`npm run build` + `npm test -- --run` (component/hook tests) + manual note: `npm run dev` →
`localhost:5173/parts`.

---

## 4. i18n — i18n-engineer

### Files to CREATE
- `src/locales/ru/parts.json`, `src/locales/en/parts.json`, `src/locales/hy/parts.json`.

### Files to MODIFY
- `src/lib/i18n/index.ts` — import the three `parts.json`, add `parts: ruParts` / `enParts` /
  `hyParts` to `resources`, add `'parts'` to the `ns` array.
- `src/locales/{ru,en,hy}/nav.json` — ensure `items.parts` exists (likely already present from
  the StubPage era; verify and keep).

### Keys to author (namespace `parts`) — every UI string in §3
Tab labels (`tabs.warehouse`, `tabs.devices`), stat labels (`stats.onHand`, `stats.installed`,
`stats.broken`, `stats.devices`), category labels (`category.psu`=Блоки, `category.cooler`,
`category.ssd`, `category.hdd`, `category.nvme`, `category.ram`=ОЗУ, `category.gpu`=Видеокарта),
modal titles/buttons (`addModal.*`, `installModal.*`, `uninstallModal.*`, `gpuModal.*`,
`serviceModal.*`), journal action labels (`journal.received`, `journal.installed`,
`journal.uninstalled`, `journal.scrapped`, `journal.replaced`, `journal.serviceReplace`),
column headers, empty/loading/error copy, toasts (`toast.received`, `toast.installed`, etc.).
Russian is the source-of-truth wording (match the prototype's existing Russian strings); en/hy
are faithful translations. Provide complete coverage — no missing keys, no English leaking into
ru.

### i18n-engineer verification
`npm test -- --run` (render test asserting a `parts` key resolves in ru/en/hy) + `npm run build`.

---

## 5. Tests (test-engineer gates EVERY stage)

- After domain-modeler: unit-test `partStock.ts` — stock invariant (receive/install/uninstall,
  broken vs return, serviceReplace skipped, negatives clamped), slot resolution (psu→battery on
  laptop, storage cats share bay, single-slot rules), `currentPartsForSkuCategory`.
- After firebase-engineer: `inMemoryPartRepository` tests — receive bumps onHand; install on a
  desktop debits onHand −1 AND mutates upgradeCurrent in ONE audited result (assert
  `store.logs` length 1 per call); install on a laptop (service) leaves onHand unchanged but
  mutates upgradeCurrent; replace with broken disposal scraps (no +1 return); replace with
  warehouse disposal returns +1; uninstall scrap vs return; createGpu registers SKU + initial
  receive; deleteGpu blocked when installed. Assert each mutation writes exactly one audit entry
  and `part_movements` is treated append-only. Rules tests (if harness present):
  `/part_movements` denies update/delete for all roles; employee denied read/write on both
  collections.
- After react-ui-engineer: `@testing-library/react` smoke for PartsPage (renders tabs, stat
  strip), InstallModal slot-decision interaction (empty slot → install; occupied single-slot →
  forced replace; occupied multi-slot → replace OR add), and the role gate (employee blocked).
- After i18n-engineer: render test — a `parts` namespace key resolves in all three locales.

Run command everywhere: `npm test -- --run`. PASS gate before advancing.

---

## 6. Review (after all stages PASS)
1. spec-reviewer — against `docs/features/parts.md` + this plan (full parity, event-sourced,
   full stack, role matrix = three admin roles, employee denied, MVP boundary respected).
2. code-quality-reviewer — repository boundary (no firebase in components), `withAudit` on every
   mutation, modular Firebase v9, primitives reused, i18n discipline, no localStorage, slot math
   only in domain helpers.
3. security-reviewer — `/part_movements` immutability (`update,delete:if false`), server-side
   role gate via `role()`, route guard + rules both enforce the three-admin matrix, employee
   denied, no secrets, audit written in same txn as every mutation, deleteGpu path safe.

Any FAIL → re-dispatch the responsible implementer with the report → re-run test-engineer →
re-run the failed reviewer. Loop to PASS.

## 7. Verify (Phase 6)
`npm test -- --run` and `npm run build` both clean. Paste last 10 lines of each.

## 8. Acceptance (spec §10 — restate for sign-off)
- `/parts` renders for super_admin/asset_admin/tech_admin; employee denied by route guard + rules.
- Both tabs functional; stock derives from movements per the invariant.
- Install on desktop: onHand −1 + upgradeCurrent updated, one transaction, one audit entry,
  rollback leaves no orphan movement.
- Install on laptop (service): stock unchanged, upgradeCurrent updated.
- Replace with broken: old part scrapped (no +1).
- Every mutation writes exactly one `audit_logs` entry; `part_movements` immutable.
- `npm test -- --run` and `npm run build` pass.

## 9. Open implementation questions for implementers (resolve internally, document choice — NOT user forks)
- **A. `currentSpecs` vs `upgradeCurrent`.** The production Asset doc uses `currentSpecs`
  (`{cpu,ram,ssd,gpu}`); the prototype + this feature use an `upgradeCurrent[]` array of slots.
  firebase-engineer + domain-modeler must reconcile: the PartsAsset projection and the install/
  uninstall mutation must read/write whatever field the production asset carries. If the
  production asset has no `upgradeCurrent` array, ADD it as an additive optional field on the
  Asset type and write to it (do not break `currentSpecs`). Document the decision in the adapter.
- **B. deleteGpu in Firestore.** Rules deny client delete. Keep deleteGpu working in the
  in-memory repo (for tests) but have the Firestore adapter either no-op-throw "not supported in
  MVP" or skip it. Prefer the simplest path; document it. (If this turns out to materially change
  user-visible behavior — e.g. the GPU delete button must be removed from the UI — that IS worth
  flagging back to the orchestrator before shipping.)
- **C. Movement load volume.** MVP loads the full journal. Fine for now; note Phase-2 pagination.

If any of A/B/C escalates into a genuine product decision (not just an infra-hygiene call),
STOP and report it to the orchestrator — subagents have no AskUserQuestion.
