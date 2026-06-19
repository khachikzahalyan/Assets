# License Module — Sub-plan A: Domain + Masking + Repositories + Rules + Indexes

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Land the License domain (strict separation), key masking with a branded `MaskedKey`, both repositories (InMemory + Firestore) with private secret members and withAudit integration, firestore.rules license blocks (secrets deny-all), composite indexes, and type-level tests.

**Architecture:** Ports & adapters mirroring the existing repos (see `firestoreBranchRepository.ts`). Two independent license interfaces; no shared base. `withAudit` is the only write chokepoint; keys are masked before any audit write.

**Tech Stack:** TypeScript strict, Firebase SDK v9 modular, vitest, `expectTypeOf`/`*.test-d.ts` for type-level tests.

---

### Task A1: Key masking + branded MaskedKey

**Files:**
- Create: `src/lib/audit/maskSecrets.ts`
- Test: `src/lib/audit/maskSecrets.test.ts`
- Test (type): `src/lib/audit/maskSecrets.test-d.ts`

- [ ] **Step 1: Write failing tests** (`maskSecrets.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { maskLicenseKey, sanitizeLicenseAuditPayload } from './maskSecrets'

describe('maskLicenseKey', () => {
  it('keeps last 4 alphanumerics, masks the rest, preserves separators', () => {
    expect(maskLicenseKey('XCVF-7TR5-9HJK-5592')).toBe('****-****-****-5592')
  })
  it('handles no separators', () => {
    expect(maskLicenseKey('ABCD1234')).toBe('****5234'.replace('5234','1234') && '****1234')
  })
  it('handles short keys (<=4 chars) by masking nothing beyond available', () => {
    expect(maskLicenseKey('AB')).toBe('AB')
  })
  it('preserves spaces and mixed separators', () => {
    expect(maskLicenseKey('AAAA BBBB-CCCC')).toBe('**** ****-CCCC')
  })
  it('empty string -> empty', () => { expect(maskLicenseKey('')).toBe('') })
})

describe('sanitizeLicenseAuditPayload', () => {
  it('re-masks a key field even if a raw value leaks in', () => {
    const out = sanitizeLicenseAuditPayload({ key: 'XCVF-7TR5-9HJK-5592', name: 'Win' })
    expect(out.key).toBe('****-****-****-5592')
    expect(out.name).toBe('Win')
  })
  it('leaves payloads without a key untouched', () => {
    expect(sanitizeLicenseAuditPayload({ name: 'X' })).toEqual({ name: 'X' })
  })
  it('masks nested key under secrets', () => {
    const out = sanitizeLicenseAuditPayload({ secrets: { current: { key: 'AAAA-BBBB-1234' } } }) as any
    expect(out.secrets.current.key).toBe('****-****-1234')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.** `npx vitest run src/lib/audit/maskSecrets.test.ts`

- [ ] **Step 3: Implement** (`maskSecrets.ts`):

```ts
/** Branded string: a license key that has been masked. The compiler refuses a
 *  raw string where a MaskedKey is required, so audit payloads cannot carry a
 *  raw key by construction. */
declare const MaskedKeyBrand: unique symbol
export type MaskedKey = string & { readonly [MaskedKeyBrand]: true }

const ALNUM = /[A-Za-z0-9]/

/** Mask format: preserve the LAST 4 alphanumeric chars; replace every other
 *  alphanumeric with '*'; preserve all separators (dashes, spaces, etc.). */
export function maskLicenseKey(raw: string): MaskedKey {
  const alnumIdx: number[] = []
  for (let i = 0; i < raw.length; i++) if (ALNUM.test(raw[i]!)) alnumIdx.push(i)
  const keepFrom = Math.max(0, alnumIdx.length - 4)
  const keep = new Set(alnumIdx.slice(keepFrom))
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    out += ALNUM.test(ch) ? (keep.has(i) ? ch : '*') : ch
  }
  return out as MaskedKey
}

/** Belt-and-braces runtime sanitizer: re-mask any `key` field anywhere in the
 *  payload tree, defending against unknown-typed paths (CF callbacks, dynamic
 *  admin tooling). Idempotent — masking an already-masked key is a no-op shape. */
export function sanitizeLicenseAuditPayload<T>(payload: T): T {
  if (Array.isArray(payload)) return payload.map((v) => sanitizeLicenseAuditPayload(v)) as unknown as T
  if (payload && typeof payload === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (k === 'key' && typeof v === 'string') out[k] = maskLicenseKey(v)
      else out[k] = sanitizeLicenseAuditPayload(v)
    }
    return out as T
  }
  return payload
}
```

- [ ] **Step 4: Type test** (`maskSecrets.test-d.ts`):

```ts
import { expectTypeOf } from 'vitest'
import { maskLicenseKey, type MaskedKey } from './maskSecrets'

// maskLicenseKey returns a MaskedKey, not a plain string assignable from raw.
expectTypeOf(maskLicenseKey('x')).toEqualTypeOf<MaskedKey>()
// A raw string is NOT assignable to MaskedKey.
const raw = 'XCVF-7TR5'
// @ts-expect-error raw string cannot be used as MaskedKey
const bad: MaskedKey = raw
void bad
```

- [ ] **Step 5: Run, expect PASS.** `npx vitest run src/lib/audit/maskSecrets.test.ts` and `npx vitest --typecheck run src/lib/audit/maskSecrets.test-d.ts`
- [ ] **Step 6: Export from barrel** — add `export * from './maskSecrets'` to `src/lib/audit/index.ts`.
- [ ] **Step 7: Commit** `feat(license): key masking + branded MaskedKey + runtime sanitizer`

---

### Task A2: Domain types — strict separation

**Files:**
- Create: `src/domain/license/WorkstationLicense.ts`, `ServerLicense.ts`, `LicenseKey.ts`, `LicenseAudit.ts`, `index.ts`
- Test (type): `src/domain/license/license-separation.test-d.ts`
- Test: `src/domain/license/license-types.test.ts`

- [ ] **Step 1: `WorkstationLicense.ts`:**

```ts
import type { MaskedKey } from '@/lib/audit/maskSecrets'

export type LicenseType = 'Default' | 'OEM' | 'Retail' | 'Volume' | 'Subscription'
export type AssignmentType = 'employee' | 'device' | 'unassigned'
export type LifecycleStatus = 'active' | 'retired'

/** Workstation/employee license. Flat optional reference fields (decision A1). */
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
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/** Audit-safe view: key is always MaskedKey, never raw. */
export interface WorkstationLicenseAuditView {
  id: string
  name: string
  assignmentType: AssignmentType
  lifecycleStatus: LifecycleStatus
  key?: MaskedKey
}

/** Input shapes — assignment narrowing is enforced at repo layer (no device w/o assetId). */
export interface CreateWorkstationLicenseInput {
  name: string
  vendor?: string | null
  type: LicenseType
  isReusable?: boolean
  expiresAt?: string | null
  /** Raw key (optional). Written ONLY to secrets/current, never to the doc. */
  rawKey?: string | null
  assign?:
    | { to: 'employee'; employeeId: string }
    | { to: 'device'; assetId: string }
    | { to: 'unassigned' }
}

export interface AssignWorkstationLicenseInput {
  to: 'employee' | 'device' | 'unassigned'
  employeeId?: string
  assetId?: string
}
```

- [ ] **Step 2: `ServerLicense.ts`** (independent; NO assignedTo fields):

```ts
import type { MaskedKey } from '@/lib/audit/maskSecrets'

export type ServerLicenseType = 'Server' | 'Global' | 'Infrastructure'

/** Global/Server/company-wide license. Owned by the company; NEVER assigned to a
 *  person or workstation asset — the type has no assignedTo* fields by construction. */
export interface ServerLicense {
  id: string
  name: string
  vendor: string | null
  type: ServerLicenseType
  environment?: string | null
  host?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface ServerLicenseAuditView {
  id: string
  name: string
  key?: MaskedKey
}

export interface CreateServerLicenseInput {
  name: string
  vendor?: string | null
  type: ServerLicenseType
  environment?: string | null
  host?: string | null
  expiresAt?: string | null
  rawKey?: string | null
}
```

- [ ] **Step 3: `LicenseKey.ts`:**

```ts
/** Secret payload stored at {collection}/{id}/secrets/current. Never read by client SDK. */
export interface LicenseKeySecret {
  key: string
  updatedAt: string
  updatedBy: string
}
```

- [ ] **Step 4: `LicenseAudit.ts`** re-exports the two audit views:

```ts
export type { WorkstationLicenseAuditView } from './WorkstationLicense'
export type { ServerLicenseAuditView } from './ServerLicense'
```

- [ ] **Step 5: `index.ts` barrel** exports all of the above + the two repository ports (added in A3/A4).

- [ ] **Step 6: Type-level separation test** (`license-separation.test-d.ts`):

```ts
import { expectTypeOf } from 'vitest'
import type { WorkstationLicense } from './WorkstationLicense'
import type { ServerLicense } from './ServerLicense'

// ServerLicense has NO assignment fields.
expectTypeOf<ServerLicense>().not.toHaveProperty('assignedToEmployeeId')
expectTypeOf<ServerLicense>().not.toHaveProperty('assignedToAssetId')
expectTypeOf<ServerLicense>().not.toHaveProperty('assignmentType')
// WorkstationLicense and ServerLicense are not mutually assignable (no shared base).
const w = {} as WorkstationLicense
// @ts-expect-error independent interfaces
const s: ServerLicense = w
void s
```

- [ ] **Step 7: Runtime sanity test** (`license-types.test.ts`) asserting the const unions exist (`LicenseType` members) via a small array.
- [ ] **Step 8: Run typecheck + tests, expect PASS.**
- [ ] **Step 9: Commit** `feat(license): strict-separation domain types`

---

### Task A3: Repository ports

**Files:**
- Create: `src/domain/license/WorkstationLicenseRepository.ts`, `ServerLicenseRepository.ts`
- Modify: `src/domain/license/index.ts`

- [ ] **Step 1: `WorkstationLicenseRepository.ts`:**

```ts
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  WorkstationLicense, CreateWorkstationLicenseInput, AssignWorkstationLicenseInput,
} from './WorkstationLicense'

export interface WorkstationLicenseListQuery {
  assignmentType?: 'employee' | 'device' | 'unassigned' | 'all'
  lifecycleStatus?: 'active' | 'retired' | 'all'
  search?: string
}

/** The ONLY workstation-license port. Secret read/write/reveal are PRIVATE in the
 *  implementations — they are NOT on this interface. Every mutating method writes
 *  exactly one audit entry (returns AuditedResult). */
export interface WorkstationLicenseRepository {
  listLicenses(q?: WorkstationLicenseListQuery): Promise<WorkstationLicense[]>
  getLicense(id: string): Promise<WorkstationLicense | null>
  /** Licenses currently bound to a device asset (device-detail page). */
  listForAsset(assetId: string): Promise<WorkstationLicense[]>
  /** Assignable pool: lifecycleStatus active AND assignmentType unassigned. */
  listAssignablePool(): Promise<WorkstationLicense[]>
  createLicense(input: CreateWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  assignLicense(id: string, input: AssignWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  /** Decouple to unassigned (reusable) — used by write-off + manual return. */
  decoupleLicense(id: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  /** Rotate the secret key (masked in audit). */
  rotateKey(id: string, rawKey: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
}
```

- [ ] **Step 2: `ServerLicenseRepository.ts`:**

```ts
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { ServerLicense, CreateServerLicenseInput } from './ServerLicense'

export interface ServerLicenseListQuery { search?: string }

/** The ONLY server-license port. Super-admin-write only (enforced in rules + repo).
 *  Secret methods PRIVATE in impl. No assignment methods — server licenses are
 *  never assigned to a person/asset. */
export interface ServerLicenseRepository {
  listLicenses(q?: ServerLicenseListQuery): Promise<ServerLicense[]>
  getLicense(id: string): Promise<ServerLicense | null>
  createLicense(input: CreateServerLicenseInput, actor: Actor): Promise<AuditedResult<ServerLicense>>
  updateLicense(id: string, patch: Partial<Pick<ServerLicense, 'name' | 'vendor' | 'environment' | 'host' | 'expiresAt'>>, actor: Actor): Promise<AuditedResult<ServerLicense>>
  rotateKey(id: string, rawKey: string, actor: Actor): Promise<AuditedResult<ServerLicense>>
}
```

- [ ] **Step 3: barrel exports both ports.**
- [ ] **Step 4: typecheck PASS. Commit** `feat(license): repository ports`

---

### Task A4: Audit type extensions

**Files:** Modify `src/domain/audit/types.ts`; Test `src/domain/audit/audit-types.test.ts`

- [ ] **Step 1: Add a failing test** asserting new members exist:

```ts
it('license audit extensions present', () => {
  expect(AUDIT_ACTIONS).toContain('key_revealed')
  expect(AUDIT_ACTIONS).toContain('license_decoupled')
  expect(AUDIT_ACTIONS).toContain('license_retired_with_asset')
  expect(AUDIT_ACTIONS).toContain('key_rotated')
  const t: AuditEntityType = 'server_license'
  expect(t).toBe('server_license')
})
```

- [ ] **Step 2:** Extend `AuditEntityType` with `'server_license'` (keep existing `'license'`); add `'key_revealed' | 'license_decoupled' | 'license_retired_with_asset' | 'key_rotated'` to `AUDIT_ACTIONS`.
- [ ] **Step 3:** Run tests PASS. **Commit** `feat(audit): license action/entity extensions`

---

### Task A5: InMemory workstation repo

**Files:**
- Create: `src/infra/repositories/inMemoryWorkstationLicenseRepository.ts`
- Test: `src/infra/repositories/inMemoryWorkstationLicenseRepository.test.ts`

- [ ] **Step 1: Failing tests** covering: create (with rawKey → secret stored privately, audit `created` carries MASKED key, doc has NO `key` field); narrowing (assign device without assetId → throws; assign device with assetId → assignmentType `device`); decouple reusable → unassigned + audit `license_decoupled`; rotateKey → audit `key_rotated` masked; listAssignablePool returns only active+unassigned; listForAsset filters by assignedToAssetId.

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { InMemoryWorkstationLicenseRepository } from './inMemoryWorkstationLicenseRepository'

const actor = { uid: 'u_super', role: 'super_admin' as const }
let store: ReturnType<typeof createInMemoryAuditStore>
let repo: InMemoryWorkstationLicenseRepository
beforeEach(() => { store = createInMemoryAuditStore(); repo = new InMemoryWorkstationLicenseRepository(inMemoryAuditContext(store), store) })

it('create stores secret privately, doc has no key, audit is masked', async () => {
  const { value } = await repo.createLicense({ name: 'Win', type: 'OEM', isReusable: false, rawKey: 'XCVF-7TR5-9HJK-5592' }, actor)
  expect((value as any).key).toBeUndefined()
  const log = store.logs.at(-1)!
  expect(JSON.stringify(log)).not.toContain('9HJK')          // raw never in audit
  expect(JSON.stringify(log)).toContain('****-****-****-5592') // masked present
})

it('assign device requires assetId', async () => {
  const { value } = await repo.createLicense({ name: 'Off', type: 'Volume' }, actor)
  await expect(repo.assignLicense(value.id, { to: 'device' }, actor)).rejects.toThrow()
  const r = await repo.assignLicense(value.id, { to: 'device', assetId: 'a_1' }, actor)
  expect(r.value.assignmentType).toBe('device')
  expect(r.value.assignedToAssetId).toBe('a_1')
})

it('decouple reusable returns to pool with license_decoupled audit', async () => {
  const { value } = await repo.createLicense({ name: 'Off', type: 'Volume', isReusable: true, assign: { to: 'device', assetId: 'a_1' } }, actor)
  const r = await repo.decoupleLicense(value.id, actor)
  expect(r.value.assignmentType).toBe('unassigned')
  expect(store.logs.at(-1)!.action).toBe('license_decoupled')
  expect(await repo.listAssignablePool()).toHaveLength(1)
})
```

- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement.** Keep a private `secrets: Map<id, string>` (raw key) separate from the docs Map. Every mutation goes through `withAudit(this.ctx, spec, …)`. The audit `spec.after`/`spec.before` for any key-bearing operation must use `maskLicenseKey(raw)` → never the raw value; run `sanitizeLicenseAuditPayload` on the spec before passing. Narrowing helper throws on `device` w/o assetId and `employee` w/o employeeId.
- [ ] **Step 4: Run PASS. Commit** `feat(license): in-memory workstation repository`

---

### Task A6: InMemory server repo

**Files:**
- Create: `src/infra/repositories/inMemoryServerLicenseRepository.ts`
- Test: `src/infra/repositories/inMemoryServerLicenseRepository.test.ts`

- [ ] **Step 1: Failing tests:** create (secret private, audit masked, entityType `server_license`); update; rotateKey masked; getLicense; listLicenses search. Assert there is NO assign method exposed (compile-time covered by port; runtime test just checks shape lacks assignment fields).
- [ ] **Step 2: FAIL → implement (mirror A5 minus assignment) → PASS.**
- [ ] **Step 3: Commit** `feat(license): in-memory server repository`

---

### Task A7: Firestore workstation repo

**Files:**
- Create: `src/infra/repositories/firestoreWorkstationLicenseRepository.ts`

- [ ] **Step 1: Implement** mirroring `firestoreBranchRepository.ts` + `firestoreAssetRepository.ts`:
  - `private get audit() { return firestoreAuditContext(this.db) }`
  - Secret writes: inside the SAME `withAudit` txn, `txn.set(doc(db,'licenses',id,'secrets','current'), { key: rawKey, updatedAt: serverTimestamp(), updatedBy: actor.uid })`. The license DOC never gets a `key` field.
  - Audit specs use `maskLicenseKey(rawKey)` in `after`.
  - `listForAsset`: `query(collection('licenses'), where('assignmentType','==','device'), where('assignedToAssetId','==',assetId))`.
  - `listAssignablePool`: `where('lifecycleStatus','==','active'), where('assignmentType','==','unassigned')`.
  - Private secret read method exists but is ONLY used internally (no reveal — reveal is the CF; this method is unused by UI and may stay for the WriteOff path which does not need the key). Keep it `private` and minimal.
  - Narrowing helper identical to InMemory.
- [ ] **Step 2: typecheck PASS. Commit** `feat(license): firestore workstation repository`

> No unit test here (Firestore path covered by InMemory contract + rules tests). A thin smoke import test may be added to keep coverage scripts happy if needed.

---

### Task A8: Firestore server repo

**Files:** Create `src/infra/repositories/firestoreServerLicenseRepository.ts`

- [ ] **Step 1: Implement** mirroring A7 minus assignment, entityType `server_license`, secrets at `server_licenses/{id}/secrets/current`.
- [ ] **Step 2: typecheck PASS. Commit** `feat(license): firestore server repository`

---

### Task A9: Export repos from infra barrel + index

**Files:** Modify `src/infra/repositories/index.ts`

- [ ] Add exports for the four new repo classes. typecheck PASS. **Commit** `chore(license): export repositories`

---

### Task A10: firestore.rules — license blocks

**Files:** Modify `firestore.rules`; Test `tests/rules/licenses.rules.test.ts`

- [ ] **Step 1: Add rules** (inside the document match, near `/assets`):

```
match /licenses/{id} {
  allow read: if isAnyAdmin();
  allow write: if isSuperAdmin() || isTechAdmin();
  match /secrets/{s} { allow read, write: if false; }
}
match /server_licenses/{id} {
  allow read: if isAnyAdmin();
  allow write: if isSuperAdmin();
  match /secrets/{s} { allow read, write: if false; }
}
```

- [ ] **Step 2: Author rules test** (`tests/rules/licenses.rules.test.ts`) following the existing `tests/rules` pattern: assert (a) tech_admin can write `/licenses`, asset_admin cannot; (b) only super can write `/server_licenses`; (c) ALL roles incl super are DENIED read+write on `*/secrets/*`; (d) employee cannot read `/licenses`.
- [ ] **Step 3: Commit** `feat(license): firestore rules (secrets deny-all)` — tests run in CI (`npm run test:rules`); Java unavailable locally so do not block on local exec.

---

### Task A11: Composite indexes

**Files:** Modify `firestore.indexes.json`

- [ ] **Step 1: Add:**

```json
{ "collectionGroup": "licenses", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "assignmentType", "order": "ASCENDING" },
  { "fieldPath": "assignedToAssetId", "order": "ASCENDING" }
]},
{ "collectionGroup": "licenses", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "lifecycleStatus", "order": "ASCENDING" },
  { "fieldPath": "assignmentType", "order": "ASCENDING" }
]}
```

- [ ] **Step 2:** Validate JSON parses (`node -e "require('./firestore.indexes.json')"`). **Commit** `feat(license): composite indexes`

---

### Self-check before handoff to Sub-plan B
- typecheck clean, all tests green (baseline 388 + new), build green.
- No raw key ever reaches an audit payload (A1 sanitizer + A5/A6 assertions).
- Secrets deny-all in rules. Ports expose no secret methods.
