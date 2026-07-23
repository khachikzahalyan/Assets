# decoupledFromAssetId + Freed-License UI on Disposed Asset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Retail/reusable license is decoupled during write-off, store the former asset link in `decoupledFromAssetId`; use it to surface a "freed key" card on the disposed asset's detail page; correctly show OEM retired-with-asset cards too.

**Architecture:** Four-layer change — domain type → both repository implementations → repository port (new query method) → UI (LicenseBlock + hook). No new files; all changes in-place. i18n keys added synchronously across ru/en/hy.

**Tech Stack:** TypeScript, Vitest, React 19, react-i18next, Firestore (modular SDK v9+), InMemory repository.

---

## File map

| File | Change |
|---|---|
| `src/domain/license/WorkstationLicense.ts` | Add `decoupledFromAssetId?: string \| null` field |
| `src/domain/license/WorkstationLicenseRepository.ts` | Add `listDecoupledFromAsset(assetId: string)` to port |
| `src/infra/repositories/firestoreWorkstationLicenseRepository.ts` | (a) decouple patch writes `decoupledFromAssetId`; (b) assign patch clears it; (c) implement `listDecoupledFromAsset` |
| `src/infra/repositories/inMemoryWorkstationLicenseRepository.ts` | Same three changes — InMemory parity |
| `src/locales/ru/assets.json` | Add `detail.license.freedByWriteOff` + `detail.license.retiredWithAsset` |
| `src/locales/en/assets.json` | Same keys in English |
| `src/locales/hy/assets.json` | Same keys in Armenian |
| `src/pages/assets/detail/useAssetDetail.ts` | Add `decoupledLicenses` state; load via `listDecoupledFromAsset` when `isDisposed && licenses.length === 0` |
| `src/components/features/assets/detail/LicenseBlock.tsx` | New `decoupledLicenses` prop; render freed-key card (STATE 4) and retired-OEM card (STATE 2b) |
| `src/infra/repositories/inMemoryWorkstationLicenseRepository.test.ts` | Tests: decouple writes field; reassign clears it; listDecoupledFromAsset returns only matching docs |
| `src/pages/assets/AssetDetailPage.test.tsx` | Tests: disposed asset shows freed Retail key card and freed OEM (retired) card |

---

## Task 1 — Domain type: add `decoupledFromAssetId` to `WorkstationLicense`

**Files:**
- Modify: `src/domain/license/WorkstationLicense.ts`

- [ ] **Step 1: Add the optional field to `WorkstationLicense` interface**

Open `src/domain/license/WorkstationLicense.ts`. After line 31 (`retiredWithAssetId?: string | null`) add:

```ts
  /**
   * Set when a reusable license is DECOUPLED from a device during write-off.
   * Records which asset it was last attached to before being freed.
   * Cleared when the license is subsequently assigned to a new device/employee.
   */
  decoupledFromAssetId?: string | null
```

The full `WorkstationLicense` interface after edit:

```ts
export interface WorkstationLicense {
  id: string
  name: string
  vendor: string | null
  type: LicenseType
  isReusable: boolean
  assignmentType: AssignmentType
  assignedToEmployeeId?: string | null
  assignedToAssetId?: string | null
  assignedAt?: string | null
  assignedBy?: string | null
  lifecycleStatus: LifecycleStatus
  retiredAt?: string | null
  retiredWithAssetId?: string | null
  decoupledFromAssetId?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}
```

- [ ] **Step 2: Verify TypeScript compiles (no test run needed yet)**

```
npx tsc -b --noEmit
```

Expected: 0 errors. If there are errors they will be in the mapper functions that destructure the type — fix them before proceeding.

---

## Task 2 — Repository port: add `listDecoupledFromAsset`

**Files:**
- Modify: `src/domain/license/WorkstationLicenseRepository.ts`

- [ ] **Step 1: Add the new method to the interface**

After the `listAssignablePool` line (line 30), insert:

```ts
  /**
   * Returns all licenses that were decoupled from the given asset during write-off.
   * These are active (reusable) licenses now free in the pool, with `decoupledFromAssetId === assetId`.
   * Used to show the "freed key" card on a disposed asset's detail page.
   */
  listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]>
```

The full interface signature block after edit:

```ts
export interface WorkstationLicenseRepository {
  listLicenses(q?: WorkstationLicenseListQuery): Promise<WorkstationLicense[]>
  getLicense(id: string): Promise<WorkstationLicense | null>
  listForAsset(assetId: string): Promise<WorkstationLicense[]>
  listAssignablePool(): Promise<WorkstationLicense[]>
  listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]>
  createLicense(input: CreateWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  assignLicense(id: string, input: AssignWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  decoupleLicense(id: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  retireLicense(id: string, assetId: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  rotateKey(id: string, rawKey: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
}
```

- [ ] **Step 2: Build check**

```
npx tsc -b --noEmit
```

Expected: errors only in the two repository implementations (they don't yet implement `listDecoupledFromAsset`). That is correct — proceed.

---

## Task 3 — InMemory repository: implement all three changes + add `listDecoupledFromAsset`

**Files:**
- Modify: `src/infra/repositories/inMemoryWorkstationLicenseRepository.ts`

### 3a — `decoupleLicense`: stamp `decoupledFromAssetId`

- [ ] **Step 1: In `decoupleLicense`, capture `existing.assignedToAssetId` before clearing and write it to the updated doc**

Current `decoupleLicense` builds `updated` as (lines 258–267):

```ts
const updated: WorkstationLicense = {
  ...existing,
  assignmentType: 'unassigned',
  assignedToAssetId: null,
  assignedToEmployeeId: null,
  assignedAt: null,
  assignedBy: null,
  updatedAt: now,
  updatedBy: actor.uid,
}
```

Replace with:

```ts
const decoupledFromAssetId = existing.assignedToAssetId ?? null

const updated: WorkstationLicense = {
  ...existing,
  assignmentType: 'unassigned',
  assignedToAssetId: null,
  assignedToEmployeeId: null,
  assignedAt: null,
  assignedBy: null,
  decoupledFromAssetId,
  updatedAt: now,
  updatedBy: actor.uid,
}
```

### 3b — `assignLicense`: clear `decoupledFromAssetId`

- [ ] **Step 2: In `assignLicense`, add `decoupledFromAssetId: null` to the `updated` spread**

Current `updated` build in `assignLicense` (lines 213–220):

```ts
const updated: WorkstationLicense = {
  ...existing,
  ...assignmentFields,
  assignedAt: assignmentFields.assignmentType === 'unassigned' ? null : now,
  assignedBy: assignmentFields.assignmentType === 'unassigned' ? null : actor.uid,
  updatedAt: now,
  updatedBy: actor.uid,
}
```

Replace with:

```ts
const updated: WorkstationLicense = {
  ...existing,
  ...assignmentFields,
  assignedAt: assignmentFields.assignmentType === 'unassigned' ? null : now,
  assignedBy: assignmentFields.assignmentType === 'unassigned' ? null : actor.uid,
  decoupledFromAssetId: null,
  updatedAt: now,
  updatedBy: actor.uid,
}
```

### 3c — Mapper `cloneDoc` and `createLicense` default

- [ ] **Step 3: In `createLicense`, initialize `decoupledFromAssetId: null` in the doc literal**

Find the `doc: WorkstationLicense` object literal in `createLicense` (around line 147). Add `decoupledFromAssetId: null` after `retiredWithAssetId: null`:

```ts
const doc: WorkstationLicense = {
  id,
  name: input.name,
  vendor: input.vendor ?? null,
  type: input.type,
  isReusable,
  lifecycleStatus: 'active',
  expiresAt: input.expiresAt ?? null,
  assignmentType: assignmentFields.assignmentType,
  assignedToAssetId: assignmentFields.assignedToAssetId,
  assignedToEmployeeId: assignmentFields.assignedToEmployeeId,
  assignedAt: null,
  assignedBy: null,
  retiredAt: null,
  retiredWithAssetId: null,
  decoupledFromAssetId: null,
  createdAt: now,
  updatedAt: now,
  createdBy: actor.uid,
  updatedBy: actor.uid,
}
```

### 3d — `listDecoupledFromAsset` implementation

- [ ] **Step 4: Add `listDecoupledFromAsset` method after `listAssignablePool`**

```ts
async listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]> {
  return Array.from(this.docs.values())
    .filter(l => l.decoupledFromAssetId === assetId)
    .map(d => this.cloneDoc(d))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
```

- [ ] **Step 5: Build check**

```
npx tsc -b --noEmit
```

Expected: errors only in Firestore implementation (still missing `listDecoupledFromAsset`). That is correct — proceed.

---

## Task 4 — Firestore repository: implement all three changes + add `listDecoupledFromAsset`

**Files:**
- Modify: `src/infra/repositories/firestoreWorkstationLicenseRepository.ts`

### 4a — `toWorkstationLicense` mapper: read `decoupledFromAssetId`

- [ ] **Step 1: In `toWorkstationLicense`, add the new field**

Current mapper (lines 27–48). Add after `retiredWithAssetId` line:

```ts
function toWorkstationLicense(id: string, d: Record<string, unknown>): WorkstationLicense {
  return {
    id,
    name: String(d.name ?? ''),
    vendor: (d.vendor as string | null) ?? null,
    type: (d.type as WorkstationLicense['type']) ?? 'Default',
    isReusable: Boolean(d.isReusable),
    assignmentType: (d.assignmentType as AssignmentType) ?? 'unassigned',
    assignedToAssetId: (d.assignedToAssetId as string | null) ?? null,
    assignedToEmployeeId: (d.assignedToEmployeeId as string | null) ?? null,
    assignedAt: (d.assignedAt as string | null) ?? null,
    assignedBy: (d.assignedBy as string | null) ?? null,
    lifecycleStatus: (d.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active',
    retiredAt: (d.retiredAt as string | null) ?? null,
    retiredWithAssetId: (d.retiredWithAssetId as string | null) ?? null,
    decoupledFromAssetId: (d.decoupledFromAssetId as string | null) ?? null,
    expiresAt: (d.expiresAt as string | null) ?? null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    createdBy: String(d.createdBy ?? ''),
    updatedBy: String(d.updatedBy ?? ''),
  }
}
```

### 4b — `decoupleLicense`: stamp `decoupledFromAssetId` in patch

- [ ] **Step 2: In `decoupleLicense`, add `decoupledFromAssetId` to the patch**

Current `patch` in `decoupleLicense` (lines 263–271):

```ts
const patch: Record<string, unknown> = {
  assignmentType: 'unassigned',
  assignedToAssetId: null,
  assignedToEmployeeId: null,
  assignedAt: null,
  assignedBy: null,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
}
```

Replace with:

```ts
const decoupledFromAssetId = existing.assignedToAssetId ?? null

const patch: Record<string, unknown> = {
  assignmentType: 'unassigned',
  assignedToAssetId: null,
  assignedToEmployeeId: null,
  assignedAt: null,
  assignedBy: null,
  decoupledFromAssetId,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
}
```

(The `existing` variable is already fetched just above this block, so `existing.assignedToAssetId` is valid.)

### 4c — `assignLicense`: clear `decoupledFromAssetId` in patch

- [ ] **Step 3: In `assignLicense`, add `decoupledFromAssetId: null` to the patch**

Current `patch` in `assignLicense` (lines 215–221):

```ts
const isAssigning = assignmentFields.assignmentType !== 'unassigned'
const patch: Record<string, unknown> = stripUndefinedFs({
  ...assignmentFields,
  assignedAt: isAssigning ? serverTimestamp() : null,
  assignedBy: isAssigning ? actor.uid : null,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
})
```

Replace with:

```ts
const isAssigning = assignmentFields.assignmentType !== 'unassigned'
const patch: Record<string, unknown> = stripUndefinedFs({
  ...assignmentFields,
  assignedAt: isAssigning ? serverTimestamp() : null,
  assignedBy: isAssigning ? actor.uid : null,
  decoupledFromAssetId: null,
  updatedAt: serverTimestamp(),
  updatedBy: actor.uid,
})
```

### 4d — `createLicense`: initialize `decoupledFromAssetId: null` in docData

- [ ] **Step 4: In `createLicense`, add `decoupledFromAssetId: null` to `docData`**

In `createLicense`, find the `docData` object (around lines 150–168). Add `decoupledFromAssetId: null` after `retiredWithAssetId: null`:

```ts
const docData: Record<string, unknown> = stripUndefinedFs({
  name: input.name,
  vendor: input.vendor ?? null,
  type: input.type,
  isReusable,
  lifecycleStatus: 'active',
  expiresAt: input.expiresAt ?? null,
  assignmentType: assignmentFields.assignmentType,
  assignedToAssetId: assignmentFields.assignedToAssetId,
  assignedToEmployeeId: assignmentFields.assignedToEmployeeId,
  assignedAt: null,
  assignedBy: null,
  retiredAt: null,
  retiredWithAssetId: null,
  decoupledFromAssetId: null,
  createdBy: actor.uid,
  updatedBy: actor.uid,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```

### 4e — `listDecoupledFromAsset` method

- [ ] **Step 5: Add `listDecoupledFromAsset` after `listAssignablePool` (around line 136)**

```ts
async listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]> {
  const snap = await getDocs(fsQuery(
    collection(this.db, COL),
    where('decoupledFromAssetId', '==', assetId),
  ))
  return snap.docs
    .map(d => toWorkstationLicense(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
```

Note: Firestore automatically creates a single-field index for `where` queries on a single field — no manual index needed.

- [ ] **Step 6: Build check**

```
npx tsc -b --noEmit
```

Expected: 0 errors.

---

## Task 5 — Tests: InMemory repository parity

**Files:**
- Modify: `src/infra/repositories/inMemoryWorkstationLicenseRepository.test.ts`

- [ ] **Step 1: Write failing tests for the three new behaviours**

Add a new describe block after the existing `decoupleLicense` describe block:

```ts
describe('decoupleLicense — decoupledFromAssetId tracking', () => {
  it('sets decoupledFromAssetId to the former assignedToAssetId after decouple', async () => {
    const { repo } = makeRepo()
    const { value: lic } = await repo.createLicense(
      { name: 'Win 11', type: 'Retail', isReusable: true },
      ACTOR,
    )
    await repo.assignLicense(lic.id, { to: 'device', assetId: 'asset-xyz' }, ACTOR)
    const { value } = await repo.decoupleLicense(lic.id, ACTOR)
    expect(value.decoupledFromAssetId).toBe('asset-xyz')
    expect(value.assignedToAssetId).toBeNull()
  })

  it('clears decoupledFromAssetId when the license is re-assigned to a new device', async () => {
    const { repo } = makeRepo()
    const { value: lic } = await repo.createLicense(
      { name: 'Win 11', type: 'Retail', isReusable: true },
      ACTOR,
    )
    await repo.assignLicense(lic.id, { to: 'device', assetId: 'old-asset' }, ACTOR)
    await repo.decoupleLicense(lic.id, ACTOR)
    const { value } = await repo.assignLicense(lic.id, { to: 'device', assetId: 'new-asset' }, ACTOR)
    expect(value.decoupledFromAssetId).toBeNull()
    expect(value.assignedToAssetId).toBe('new-asset')
  })

  it('listDecoupledFromAsset returns only licenses decoupled from the given assetId', async () => {
    const { repo } = makeRepo()

    // Create two licenses, assign each to different assets, then decouple
    const { value: lic1 } = await repo.createLicense(
      { name: 'L1', type: 'Retail', isReusable: true },
      ACTOR,
    )
    const { value: lic2 } = await repo.createLicense(
      { name: 'L2', type: 'Retail', isReusable: true },
      ACTOR,
    )

    await repo.assignLicense(lic1.id, { to: 'device', assetId: 'asset-A' }, ACTOR)
    await repo.assignLicense(lic2.id, { to: 'device', assetId: 'asset-B' }, ACTOR)
    await repo.decoupleLicense(lic1.id, ACTOR)
    await repo.decoupleLicense(lic2.id, ACTOR)

    const forA = await repo.listDecoupledFromAsset('asset-A')
    expect(forA).toHaveLength(1)
    expect(forA[0]!.id).toBe(lic1.id)

    const forB = await repo.listDecoupledFromAsset('asset-B')
    expect(forB).toHaveLength(1)
    expect(forB[0]!.id).toBe(lic2.id)
  })

  it('listDecoupledFromAsset excludes a license that was re-assigned after decouple', async () => {
    const { repo } = makeRepo()
    const { value: lic } = await repo.createLicense(
      { name: 'L', type: 'Retail', isReusable: true },
      ACTOR,
    )
    await repo.assignLicense(lic.id, { to: 'device', assetId: 'asset-A' }, ACTOR)
    await repo.decoupleLicense(lic.id, ACTOR)
    // Re-assign to a new device — clears decoupledFromAssetId
    await repo.assignLicense(lic.id, { to: 'device', assetId: 'asset-B' }, ACTOR)

    const forA = await repo.listDecoupledFromAsset('asset-A')
    expect(forA).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run only these new tests to confirm they fail**

```
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/infra/repositories/inMemoryWorkstationLicenseRepository.test.ts
```

Expected: the 4 new tests fail (method doesn't exist or field not set). The existing tests should still pass.

- [ ] **Step 3: All tests in this file pass after Tasks 3 and 4 are done**

```
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/infra/repositories/inMemoryWorkstationLicenseRepository.test.ts
```

Expected: all tests PASS including the 4 new ones.

---

## Task 6 — i18n: add `freedByWriteOff` and `retiredWithAsset` keys

**Files:**
- Modify: `src/locales/ru/assets.json`
- Modify: `src/locales/en/assets.json`
- Modify: `src/locales/hy/assets.json`

In all three files, find the `"detail" > "license"` object. Add two new keys after `"keyAbsent"`:

### Russian (`src/locales/ru/assets.json`)

```json
"freedByWriteOff": "Ключ освобождён при списании",
"retiredWithAsset": "Списан с устройством"
```

Full `detail.license` object after edit (ru):

```json
"license": {
  "none": "Лицензия не привязана",
  "builtIn": "Встроен в BIOS",
  "oemKey": "OEM",
  "oem": "OEM",
  "retail": "Retail",
  "title": "Лицензия",
  "add": "Добавить лицензию",
  "attachTitle": "Привязать лицензию",
  "attach": "Привязать",
  "attachFailed": "Не удалось привязать лицензию. Попробуйте ещё раз.",
  "cancel": "Отмена",
  "copy": "Копировать",
  "copied": "Скопировано",
  "copyFailed": "Не удалось получить ключ",
  "keyAbsent": "Ключ не задан",
  "freedByWriteOff": "Ключ освобождён при списании",
  "retiredWithAsset": "Списан с устройством"
}
```

### English (`src/locales/en/assets.json`)

```json
"freedByWriteOff": "Key released on write-off",
"retiredWithAsset": "Retired with device"
```

### Armenian (`src/locales/hy/assets.json`)

```json
"freedByWriteOff": "Բանալին ազատ արձակվել է դուրսգրման ժամանակ",
"retiredWithAsset": "Դուրս է գրվել սարքի հետ"
```

- [ ] **Step 1: Edit all three files — add the two keys to `detail.license`**

(Each file: find the `"keyAbsent"` line inside `detail.license` and append the two new keys before the closing `}` of the `license` object.)

- [ ] **Step 2: Verify JSON validity**

```
node -e "['ru','en','hy'].forEach(l => { JSON.parse(require('fs').readFileSync('src/locales/' + l + '/assets.json', 'utf8')); console.log(l, 'OK') })"
```

Expected:
```
ru OK
en OK
hy OK
```

---

## Task 7 — Hook: load `decoupledLicenses` for disposed assets

**Files:**
- Modify: `src/pages/assets/detail/useAssetDetail.ts`

### 7a — Add state

- [ ] **Step 1: Add a `decoupledLicenses` state variable**

After the `licenses` state (line 63):

```ts
const [licenses, setLicenses] = useState<WorkstationLicense[]>([])
```

Add:

```ts
const [decoupledLicenses, setDecoupledLicenses] = useState<WorkstationLicense[]>([])
```

### 7b — Load in Phase 2

- [ ] **Step 2: In Phase 2 load block, call `listDecoupledFromAsset` in parallel after `listForAsset` resolves**

Current Phase 2 block (lines 100–112):

```ts
const [logs, asnList, licList, poolList] = await Promise.all([
  (repo as AssetWriteRepository).listAudit(id).catch(() => [] as AuditLog[]),
  repoAsn.listAssignments(id).catch(() => [] as Assignment[]),
  licenseRepo.listForAsset(id).catch(() => [] as WorkstationLicense[]),
  licenseRepo.listAssignablePool().catch(() => [] as WorkstationLicense[]),
])
setAuditLogs(logs)
setAssignments(asnList)
setLicenses(licList)
const freeOem = poolList.filter(
  l => l.type === 'OEM' && l.assignmentType === 'unassigned' && l.lifecycleStatus === 'active',
)
setLicensePool(freeOem.map(l => ({ id: l.id, name: l.name, vendor: l.vendor ?? null })))
```

Replace with:

```ts
const [logs, asnList, licList, poolList] = await Promise.all([
  (repo as AssetWriteRepository).listAudit(id).catch(() => [] as AuditLog[]),
  repoAsn.listAssignments(id).catch(() => [] as Assignment[]),
  licenseRepo.listForAsset(id).catch(() => [] as WorkstationLicense[]),
  licenseRepo.listAssignablePool().catch(() => [] as WorkstationLicense[]),
])
setAuditLogs(logs)
setAssignments(asnList)
setLicenses(licList)
const freeOem = poolList.filter(
  l => l.type === 'OEM' && l.assignmentType === 'unassigned' && l.lifecycleStatus === 'active',
)
setLicensePool(freeOem.map(l => ({ id: l.id, name: l.name, vendor: l.vendor ?? null })))

// For disposed assets: if no active licenses remain, load any decoupled licenses
// that still reference this asset via decoupledFromAssetId.
if (licList.length === 0) {
  const decoupled = await licenseRepo.listDecoupledFromAsset(id).catch(() => [] as WorkstationLicense[])
  setDecoupledLicenses(decoupled)
} else {
  setDecoupledLicenses([])
}
```

### 7c — Export `decoupledLicenses`

- [ ] **Step 3: Add `decoupledLicenses` to the return object**

In the `return` block (line 306), after `licenses,`:

```ts
return {
  loading, loadError, load,
  asset, auditLogs, ref, assignments, licenses, decoupledLicenses, licensePool,
  ...
}
```

The full return remains the same shape — just `decoupledLicenses` is added after `licenses`.

- [ ] **Step 4: Build check**

```
npx tsc -b --noEmit
```

Expected: errors in LicenseBlock call sites that pass `decoupledLicenses` (not yet added to props). Proceed.

---

## Task 8 — UI: LicenseBlock — show freed and retired cards

**Files:**
- Modify: `src/components/features/assets/detail/LicenseBlock.tsx`

The component currently has:
- STATE 1/2: bound license (Retail with key / OEM without key)
- STATE 3: no license doc (legacy fallback for active non-disposed assets)

We add:
- STATE 4 (new): disposed asset, decoupled (freed) licenses from `decoupledLicenses` prop
- STATE 2b (existing STATE 2 remains, but OEM retired licenses come from `decoupledLicenses` too IF `retiredWithAssetId === asset.id`)

**Design decisions:**
- `freedByWriteOff` caption: small grey italic subtitle below the license name.
- Status chip for freed Retail: green chip (Chip color="emerald") with text `t('detail.license.retail')` and a separate "Free" / "Свободен" label — use the `licenses` namespace `status.active` is wrong context; we want a plain "Свободен"/"Free"/"Ազատ". Use `t('detail.license.retail')` for type chip + a plain text sub-caption `t('detail.license.freedByWriteOff')`.
- For OEM retired-with-asset: the license is already in `decoupledLicenses`? No — OEM non-reusable goes through `retireLicense`, NOT `decoupleLicense`. So `decoupledLicenses` will contain ONLY Retail-type freed licenses. OEM retired licenses have `retiredWithAssetId === asset.id` and `lifecycleStatus === 'retired'`. We need to surface those too.
- Strategy: we also pass a `retiredLicenses` prop (retired licenses with `retiredWithAssetId === asset.id`). The hook already uses `listForAsset` which only returns `lifecycleStatus === 'active'` docs. We need a separate query for retired OEM.

**Revised approach for OEM retired licenses (Task 8 update):**

Rather than adding yet another query method, query them via `listLicenses({ lifecycleStatus: 'retired' })` and filter client-side in the hook. This re-uses the existing port method with no schema changes.

### 8a — Hook addendum: load `retiredWithAssetLicenses`

- [ ] **Step 1: In `useAssetDetail.ts`, add `retiredWithAssetLicenses` state**

After `decoupledLicenses` state add:

```ts
const [retiredWithAssetLicenses, setRetiredWithAssetLicenses] = useState<WorkstationLicense[]>([])
```

- [ ] **Step 2: In Phase 2 load block, after the `decoupledLicenses` block, also load retired licenses for disposed assets**

After the `if (licList.length === 0) { ... }` block:

```ts
// For disposed assets: load licenses that were retired specifically with this asset (OEM path).
const allRetired = await licenseRepo.listLicenses({ lifecycleStatus: 'retired' }).catch(() => [] as WorkstationLicense[])
const retiredHere = allRetired.filter(l => l.retiredWithAssetId === id)
setRetiredWithAssetLicenses(retiredHere)
```

Note: This is a full-collection read filtered client-side. Acceptable for MVP (license counts are small). A Firestore compound index query on (lifecycleStatus, retiredWithAssetId) can optimize this in a later phase.

- [ ] **Step 3: Export `retiredWithAssetLicenses` from the hook return**

```ts
return {
  loading, loadError, load,
  asset, auditLogs, ref, assignments, licenses, decoupledLicenses, retiredWithAssetLicenses, licensePool,
  ...
}
```

### 8b — LicenseBlock props

- [ ] **Step 4: Add `decoupledLicenses` and `retiredWithAssetLicenses` to `LicenseBlockProps`**

After the `licenses: WorkstationLicense[]` prop:

```ts
interface LicenseBlockProps {
  asset: Asset
  licenses: WorkstationLicense[]
  /**
   * Licenses decoupled (freed) from this asset during write-off.
   * Only populated when the asset is disposed and has no active license.
   */
  decoupledLicenses?: WorkstationLicense[]
  /**
   * Licenses that were retired together with this asset (OEM path).
   * Only populated when the asset is disposed.
   */
  retiredWithAssetLicenses?: WorkstationLicense[]
  /** @deprecated No longer used */
  canManage?: boolean
  /** @deprecated No longer used */
  onAttach?: (choice: AttachChoice) => Promise<void> | void
  /** @deprecated No longer used */
  pool?: { id: string; name: string; vendor: string | null }[]
  /** @deprecated No longer used */
  busy?: boolean
  compact?: boolean
}
```

- [ ] **Step 5: Destructure the new props in the function signature**

```ts
export function LicenseBlock({
  asset,
  licenses,
  decoupledLicenses = [],
  retiredWithAssetLicenses = [],
  canManage: _canManage,
  onAttach: _onAttach,
  pool: _pool,
  busy: _busy,
  compact = false,
}: LicenseBlockProps) {
```

### 8c — Compact mode: render nothing for disposed + no bound license (unchanged)

The compact mode already returns `null` when `!lic && isDisposed`. This is correct — the freed/retired cards only render in the full desktop detail view. Leave compact mode as-is.

### 8d — STATE 4: freed (Retail) key cards after `lic` check

- [ ] **Step 6: Add STATE 4 after the `if (lic) { ... }` block (line 185) and before STATE 3**

The current flow is:
```
if (lic) { ... return STATE 1/2 }
if (isDisposed) return null
return STATE 3
```

Change to:
```
if (lic) { ... return STATE 1/2 }
if (isDisposed) {
  // STATE 4a: Freed Retail keys
  // STATE 4b: OEM retired-with-asset cards
  if (decoupledLicenses.length === 0 && retiredWithAssetLicenses.length === 0) return null
  return <STATE 4 render>
}
return STATE 3
```

Full replacement for the section after `if (lic) { ... }` (starting at line 252):

```tsx
// ---- STATE 4: Disposed asset — freed / retired license cards ---------------
if (isDisposed) {
  const hasFreed = decoupledLicenses.length > 0
  const hasRetired = retiredWithAssetLicenses.length > 0
  if (!hasFreed && !hasRetired) return null

  return (
    <div className="flex flex-col gap-3">
      {decoupledLicenses.map(freed => (
        <div key={freed.id} className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
          <MsLogo />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[15.5px] font-semibold text-text-primary truncate leading-tight">
                {freed.name}
              </span>
              <Chip color="blue">{t('detail.license.retail')}</Chip>
              <Chip color="emerald">{t('licenses:status.active')}</Chip>
            </div>
            <p className="text-[12px] text-text-subtle italic">
              {t('detail.license.freedByWriteOff')}
            </p>
          </div>
        </div>
      ))}
      {retiredWithAssetLicenses.map(retired => (
        <div key={retired.id} className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
          <MsLogo />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[15.5px] font-semibold text-text-primary truncate leading-tight">
                {retired.name}
              </span>
              <Chip color="indigo">{t('detail.license.oem')}</Chip>
            </div>
            <p className="text-[12px] text-text-subtle italic">
              {t('detail.license.retiredWithAsset')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- STATE 3: No license doc (legacy asset) — default display card --------
```

**Note on `t('licenses:status.active')`:** The "Свободен"/"Free"/"Ազատ" status label does not exist in the assets namespace. Rather than adding a third key, re-use `licenses:status.active` which already translates to "Активен"/"Active"/"Ակտիվ". This is semantically correct — the key is active (available). If the owner wants "Свободен" specifically, they should add a `licenses:status.free` key later; for now re-use `licenses:status.active` and pair it with the `freedByWriteOff` caption.

Wait — re-read the spec: *статус-чип «Свободен» (зелёный, как на /licenses)*. The /licenses page uses `licenses:assignment.unassigned` which maps to "Не назначен"/"Unassigned"/"Չնշանակված". The actual chip shown on free keys in the licenses module — let me use `licenses:assignment.unassigned` as it's the right semantic. The colour is green (emerald).

- [ ] **Step 6 (corrected): Use `licenses:assignment.unassigned` for the "free" chip**

Replace `{t('licenses:status.active')}` with `{t('licenses:assignment.unassigned')}` in the freed key card.

### 8e — Call site: AssetDetailPage passes new props

- [ ] **Step 7: Find where `LicenseBlock` is called in the detail page and pass the new props**

Search for `<LicenseBlock` in the codebase — it lives in the detail page component (likely `src/pages/assets/AssetDetailPage.tsx` or a TechSpecsCard component). Add `decoupledLicenses={decoupledLicenses}` and `retiredWithAssetLicenses={retiredWithAssetLicenses}` to the call.

```
npx grep -r "LicenseBlock" src/pages src/components --include="*.tsx" -l
```

Then in the found file, pass:

```tsx
<LicenseBlock
  asset={asset}
  licenses={licenses}
  decoupledLicenses={decoupledLicenses}
  retiredWithAssetLicenses={retiredWithAssetLicenses}
  compact={compact}
/>
```

- [ ] **Step 8: Build check**

```
npx tsc -b --noEmit
```

Expected: 0 errors.

---

## Task 9 — Tests: LicenseBlock disposed-asset states

**Files:**
- Modify: `src/pages/assets/AssetDetailPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add after the existing write-off tests (after line 273):

```ts
it('disposed asset with decoupled Retail license shows freed-key card with caption', async () => {
  // Arrange
  const store       = createInMemoryAuditStore()
  const auditCtx    = inMemoryAuditContext(store)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
  const repo        = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

  const { value: asset } = await repo.createAsset(
    {
      categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS',
      invCode: '111/FREED', serial: 'SN_F1',
      assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  // Create Retail license bound to the asset, then write it off (decouples the license)
  await licenseRepo.createLicense(
    {
      name: 'Windows 11 Home', type: 'Retail', isReusable: true,
      assign: { to: 'device', assetId: asset.id },
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  // Write off the asset — this calls decoupleLicense on the Retail key
  const svc = new WriteOffAssetService(repo as import('@/domain/asset').AssetWriteRepository, licenseRepo)
  await svc.writeOff(asset.id, { uid: 'u1', role: 'asset_admin' }, 'broken')

  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole="super_admin">
        <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
          <Routes>
            <Route
              path="/assets/:id"
              element={<AssetDetailPage repository={repo} licenseRepository={licenseRepo} />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>,
  )

  // Assert: the freed-key card shows the license name and caption
  await waitFor(() => screen.getByText('Windows 11 Home'))
  expect(screen.getByText(/Ключ освобождён при списании/i)).toBeTruthy()
}, 15000)

it('disposed asset with retired OEM license shows retired-with-asset card', async () => {
  // Arrange
  const store       = createInMemoryAuditStore()
  const auditCtx    = inMemoryAuditContext(store)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
  const repo        = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

  const { value: asset } = await repo.createAsset(
    {
      categoryId: 'cat_laptop', brand: 'HP', model: 'ProBook',
      invCode: '222/OEM_RET', serial: 'SN_OEM_R',
      assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  // Create OEM (non-reusable) license bound to the asset
  await licenseRepo.createLicense(
    {
      name: 'OEM Windows 10', type: 'OEM', isReusable: false,
      assign: { to: 'device', assetId: asset.id },
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  // Write off: retires the OEM license with the asset
  const svc = new WriteOffAssetService(repo as import('@/domain/asset').AssetWriteRepository, licenseRepo)
  await svc.writeOff(asset.id, { uid: 'u1', role: 'asset_admin' }, 'end of life')

  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole="super_admin">
        <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
          <Routes>
            <Route
              path="/assets/:id"
              element={<AssetDetailPage repository={repo} licenseRepository={licenseRepo} />}
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>,
  )

  // Assert: the retired-with-asset card shows the OEM license name and caption
  await waitFor(() => screen.getByText('OEM Windows 10'))
  expect(screen.getByText(/Списан с устройством/i)).toBeTruthy()
}, 15000)
```

NOTE: The `WriteOffAssetService` import is already present in the production code; add it to the test imports:

```ts
import { WriteOffAssetService } from '@/domain/services/WriteOffAssetService'
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/pages/assets/AssetDetailPage.test.tsx
```

Expected: the 2 new tests fail. All previous tests still pass.

- [ ] **Step 3: After Tasks 7 and 8 are done, run again to confirm all pass**

Expected: all tests in the file PASS.

---

## Task 10 — Full build + test suite

- [ ] **Step 1: Build**

```
npm run build
```

Expected: 0 TypeScript errors, bundle emitted successfully. Paste last 10 lines of output.

- [ ] **Step 2: Targeted test suite**

```
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/domain src/infra src/components/features/assets src/components/features/licenses src/pages
```

Expected: all tests PASS.

---

## Self-review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| `decoupledFromAssetId` field added to domain type | Task 1 |
| `decoupleLicense` stamps the field in Firestore repo | Task 4b |
| `decoupleLicense` stamps the field in InMemory repo | Task 3a |
| `assignLicense` clears field in both repos | Task 3b, 4c |
| `listDecoupledFromAsset` in port | Task 2 |
| `listDecoupledFromAsset` Firestore impl (where query) | Task 4e |
| `listDecoupledFromAsset` InMemory impl | Task 3d |
| i18n `freedByWriteOff` ru/en/hy | Task 6 |
| i18n `retiredWithAsset` ru/en/hy | Task 6 |
| Hook loads decoupled licenses for disposed asset | Task 7 + 8a |
| Hook loads retired-with-asset licenses | Task 8a |
| LicenseBlock STATE 4: freed Retail card | Task 8d |
| LicenseBlock STATE 4: retired OEM card | Task 8d |
| Tests: decouple writes field | Task 5 |
| Tests: reassign clears field | Task 5 |
| Tests: listDecoupledFromAsset | Task 5 |
| Tests: LicenseBlock freed Retail card | Task 9 |
| Tests: LicenseBlock retired OEM card | Task 9 |
| OEM path — retired license visible (not already showing) | Task 8d (new) |
| Backfill note for existing docs | Documented below |

**Backfill note for the owner (read before running REST):**

Existing Firestore `licenses` documents created BEFORE this change will not have `decoupledFromAssetId` field. The mapper defaults it to `null` via `(d.decoupledFromAssetId as string | null) ?? null`, so existing docs are read safely — they just return `null` and `listDecoupledFromAsset` will not surface them.

The only doc the owner mentioned manually backfilling:

- Go to Firestore console → `licenses` collection
- Find the license document that was decoupled during the write-off of the asset in question (it will have `assignmentType: "unassigned"` and `assignedToAssetId: null`, `lifecycleStatus: "active"`)
- The former `assignedToAssetId` value is stored nowhere in the license doc after the old decouple — but it IS recorded in `audit_logs` as `before.assignedToAssetId` for the `license_decoupled` action. Find the audit log entry (query: `entityType == "license"`, `action == "license_decoupled"`, `entityId == <license-doc-id>`) — the `before.assignedToAssetId` field is the value to write.
- REST PATCH: `PATCH /v1/projects/{project}/databases/(default)/documents/licenses/{licenseId}` with body `{ "fields": { "decoupledFromAssetId": { "stringValue": "<assetId>" } } }` (using `updateMask.fieldPaths=decoupledFromAssetId`).
- After the patch, `listDecoupledFromAsset(assetId)` will return the license and the disposed asset's detail page will show the freed-key card.

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references found.

**Type consistency check:**
- `decoupledFromAssetId: string | null` used consistently in domain type, both mapper functions, and both repo implementations.
- `listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]>` signature matches between port and both implementations.
- `decoupledLicenses` and `retiredWithAssetLicenses` named consistently in hook return and LicenseBlock props.
