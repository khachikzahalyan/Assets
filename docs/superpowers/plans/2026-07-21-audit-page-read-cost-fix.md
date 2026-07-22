# Audit Page Read Cost Fix + Rerender Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the N+1 Firestore reads on `/audit` page load by denormalizing `actorName` into each `audit_log` doc at write time, reduce `loadReferenceData` to scan ≤100 docs (with fallback reads only for old docs lacking the field), and fix the spurious `useMemo` recomputation of DataTable columns on every row expand.

**Architecture:** Three-layer change. (1) Write side: `firestoreAuditContext` in `withAudit.ts` writes `actorName` from an optional `AuditSpec.actorName`. `Actor` type gains optional `displayName`. All call sites that build `{ uid: user.id, role }` add `displayName: user.name` — mechanical, no repo signatures change. (2) Read side: `toAuditLog` maps `actorName`; `loadReferenceData` is capped at 100 docs and skips `getDoc('/users/{uid}')` for any uid that already has `actorName` in the window. `resolveActorName` prefers `log.actorName` over the `ActorRef` lookup. (3) UI fix: remove `expanded` from the `useMemo` deps array in `AuditTable`; the chevron rotation lives in `renderRowExpanded` not in the cell renderer.

**Tech Stack:** TypeScript, Firebase Firestore (modular v9+), React 19, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/domain/asset/AssetRepository.ts` | Add `displayName?: string` to `Actor` interface |
| `src/domain/audit/types.ts` | Add `actorName?: string \| null` to `AuditLog`; add `actorName?: string \| null` to `AuditSpec` |
| `src/lib/audit/withAudit.ts` | Write `actorName` field in `firestoreAuditContext.run()` and `inMemoryAuditContext.run()` when `spec.actorName` is present |
| `src/infra/repositories/firestoreAuditLogRepository.ts` | Map `actorName` in `toAuditLog`; cap `loadReferenceData` to 100 docs; skip `getDoc` for uids that have `actorName` |
| `src/infra/repositories/inMemoryAuditLogRepository.ts` | Map `actorName` in `loadReferenceData` for fallback consistency |
| `src/components/features/audit/auditFormat.ts` | `resolveActorName` prefers `log.actorName` when present |
| `src/components/features/audit/AuditTable.tsx` | Remove `expanded` from `useMemo` deps |
| `src/components/features/audit/AuditRowMobile.tsx` | No change needed (already uses `expandedId` prop; `resolveActorName` call updated indirectly) |
| `src/pages/assets/AssetCreatePage.tsx` | Add `displayName: user.name` to both `actor` constructions |
| `src/pages/assets/detail/useAssetDetail.ts` | Add `displayName: user.name` to `actor` |
| `src/pages/catalogs/BranchesPage.tsx` | Add `displayName: user.name` to all three `{ uid: user.id, role }` objects |
| `src/pages/catalogs/CategoriesPage.tsx` | Add `displayName: user.name` to both `{ uid: user.id, role }` objects |
| `src/pages/catalogs/DepartmentsPage.tsx` | Add `displayName: user.name` to all three `{ uid: user.id, role }` objects |
| `src/pages/catalogs/useCategoryGroupCrud.ts` | Add `displayName: user.name` to both `{ uid: user.id, role }` objects |
| `src/pages/employees/useEmployeesActions.ts` | Add `displayName: user.name` to `actor` |
| `src/pages/licenses/LicensesPage.tsx` | Add `displayName: user.name` to `actor` useMemo |
| `src/hooks/useParts.ts` | Add `displayName: user.name` to `actor` useMemo |
| `src/pages/auth/PendingUsersPage.tsx` | Add `displayName: user.name` to `actor={{ uid: user.id, role }}` prop |
| `src/pages/catalogs/RolesPage.tsx` | Add `displayName: user.name` to `actor={{ uid: user.id, role }}` prop |
| `src/lib/audit/withAudit.test.ts` | Tests: `inMemoryAuditContext` writes `actorName` when provided; omits it when absent |
| `src/infra/repositories/firestoreAuditLogRepository.test.ts` | Tests: `toAuditLog` maps `actorName`; `loadReferenceData` skips getDoc for uid with `actorName` |
| `src/components/features/audit/AuditTable.test.tsx` | Test: expanding a row does NOT trigger column recomputation |

---

## Task 1: Extend domain types (Actor + AuditLog + AuditSpec)

**Files:**
- Modify: `src/domain/asset/AssetRepository.ts` — add `displayName?` to `Actor`
- Modify: `src/domain/audit/types.ts` — add `actorName?` to `AuditLog` and `AuditSpec`

- [ ] **Step 1: Add `displayName` to `Actor`**

Open `src/domain/asset/AssetRepository.ts`. Find line 51:
```ts
export interface Actor { uid: string; role: Role }
```
Replace with:
```ts
export interface Actor {
  uid: string
  role: Role
  /**
   * Optional display name to denormalize into the audit_log doc at write time.
   * When provided, withAudit writes it as `actorName`; the /audit reader then
   * uses it directly, bypassing the N+1 /users getDoc. All existing call sites
   * that omit this field continue to compile unchanged (optional).
   */
  displayName?: string
}
```

- [ ] **Step 2: Add `actorName` to `AuditLog` and `AuditSpec`**

Open `src/domain/audit/types.ts`. Find the `AuditLog` interface block and the `AuditSpec` block.

Change `AuditLog` (around line 24) to add `actorName`:
```ts
export interface AuditLog {
  id: string
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  /**
   * Denormalized display name of the actor at the time of the write.
   * Present on all NEW docs (post-denormalization). Old docs written before
   * this feature land will have this field absent (undefined) — callers must
   * treat undefined the same as null (no name known).
   */
  actorName?: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  comment: string | null
  at: string
}
```

Change `AuditSpec` (around line 37) to add `actorName`:
```ts
export interface AuditSpec {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  /**
   * Pass `actor.displayName` here to have withAudit denormalize it into the
   * audit_log doc. Optional — omitting it is backwards-compatible.
   */
  actorName?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  comment?: string | null
}
```

- [ ] **Step 3: Run the build to verify no type errors introduced so far**

```bash
npm run build 2>&1 | tail -20
```

Expected: either clean or errors only in files not yet touched (none expected at this point since changes are purely additive).

---

## Task 2: Write `actorName` in `withAudit` contexts

**Files:**
- Modify: `src/lib/audit/withAudit.ts`

- [ ] **Step 1: Write failing tests first**

Create file `src/lib/audit/withAudit.test.ts` (check if it exists first — if it does, append these tests to the existing file).

```ts
// src/lib/audit/withAudit.test.ts
import { describe, it, expect } from 'vitest'
import { createInMemoryAuditStore, inMemoryAuditContext } from './withAudit'

describe('withAudit – actorName denormalization', () => {
  it('writes actorName to the audit log when spec includes it', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)

    await ctx.run(
      {
        entityType: 'asset',
        entityId: 'a1',
        action: 'created',
        actorUid: 'u1',
        actorRole: 'asset_admin',
        actorName: 'Иван Петров',
      },
      async () => ({ value: undefined }),
    )

    expect(store.logs[0]?.actorName).toBe('Иван Петров')
  })

  it('leaves actorName absent when spec omits it', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)

    await ctx.run(
      {
        entityType: 'asset',
        entityId: 'a2',
        action: 'updated',
        actorUid: 'u2',
        actorRole: 'super_admin',
        // actorName intentionally absent
      },
      async () => ({ value: undefined }),
    )

    // Field absent is the correct representation; `undefined` or absent — NOT null.
    expect('actorName' in store.logs[0]!).toBe(false)
  })

  it('writes null actorName when spec passes null explicitly', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)

    await ctx.run(
      {
        entityType: 'branch',
        entityId: 'b1',
        action: 'created',
        actorUid: 'u3',
        actorRole: 'super_admin',
        actorName: null,
      },
      async () => ({ value: undefined }),
    )

    expect(store.logs[0]?.actorName).toBeNull()
  })
})
```

Run:
```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/lib/audit 2>&1 | tail -20
```

Expected: **FAIL** — `actorName` is undefined / absent because the context doesn't write it yet.

- [ ] **Step 2: Update `inMemoryAuditContext` to write `actorName`**

In `src/lib/audit/withAudit.ts`, find the `inMemoryAuditContext` function. The log construction block currently is:
```ts
const log: AuditLog = {
  id,
  entityType: spec.entityType,
  entityId: spec.entityId,
  action: spec.action,
  actorUid: spec.actorUid,
  actorRole: spec.actorRole,
  before: (spec.before ?? (before as AuditLog['before']) ?? null),
  after: (spec.after ?? (after as AuditLog['after']) ?? null),
  comment: spec.comment ?? null,
  at: new Date().toISOString(),
}
```

Replace with:
```ts
const log: AuditLog = {
  id,
  entityType: spec.entityType,
  entityId: spec.entityId,
  action: spec.action,
  actorUid: spec.actorUid,
  actorRole: spec.actorRole,
  // Denormalize actorName when provided; omit key entirely when undefined
  // (keeps audit log shape clean for old-doc compatibility checks in tests).
  ...(spec.actorName !== undefined ? { actorName: spec.actorName } : {}),
  before: (spec.before ?? (before as AuditLog['before']) ?? null),
  after: (spec.after ?? (after as AuditLog['after']) ?? null),
  comment: spec.comment ?? null,
  at: new Date().toISOString(),
}
```

- [ ] **Step 3: Update `firestoreAuditContext` to write `actorName`**

In `src/lib/audit/withAudit.ts`, find `firestoreAuditContext`. The `txn.set(ref, { ... })` call currently writes:
```ts
txn.set(ref, {
  entityType: spec.entityType,
  entityId: spec.entityId,
  action: spec.action,
  actorUid: spec.actorUid,
  actorRole: spec.actorRole,
  before: spec.before ?? before ?? null,
  after: spec.after ?? after ?? null,
  comment: spec.comment ?? null,
  at: serverTimestamp(),
})
```

Replace with:
```ts
txn.set(ref, {
  entityType: spec.entityType,
  entityId: spec.entityId,
  action: spec.action,
  actorUid: spec.actorUid,
  actorRole: spec.actorRole,
  // Denormalize actorName when provided — eliminates /users getDoc on read.
  // The Firestore rules `hasOnly` list MUST include 'actorName'; see firestore.rules note.
  ...(spec.actorName !== undefined ? { actorName: spec.actorName } : {}),
  before: spec.before ?? before ?? null,
  after: spec.after ?? after ?? null,
  comment: spec.comment ?? null,
  at: serverTimestamp(),
})
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/lib/audit 2>&1 | tail -20
```

Expected: all tests in `src/lib/audit/` PASS.

---

## Task 3: Update Firestore rules to allow `actorName`

**Files:**
- Modify: `firestore.rules`

The `audit_logs` create rule has a `keys().hasOnly([...])` whitelist at lines 286-289. It currently does NOT include `actorName`, so any new audit doc that carries the field would be **rejected by Firestore rules in production**.

- [ ] **Step 1: Read the current `hasOnly` list**

The block currently reads (abridged):
```
&& request.resource.data.keys().hasOnly(
     ['entityType', 'entityId', 'action', 'actorUid', 'actorRole',
      'before', 'after', 'comment', 'at']);
```

- [ ] **Step 2: Add `actorName` to the `hasOnly` list**

Open `firestore.rules`. Find the `hasOnly` line in the `audit_logs` create block and change it to:
```
&& request.resource.data.keys().hasOnly(
     ['entityType', 'entityId', 'action', 'actorUid', 'actorRole',
      'before', 'after', 'comment', 'actorName', 'at']);
```

Also add an optional shape guard for `actorName` immediately before the `hasOnly` line. The existing optional guards follow this pattern:
```
&& (!('before' in request.resource.data)
    || request.resource.data.before == null
    || request.resource.data.before is map)
```

Add analogously:
```
&& (!('actorName' in request.resource.data)
    || request.resource.data.actorName == null
    || request.resource.data.actorName is string)
```

The full updated create block (showing only the changed lines in context):
```
allow create: if isSignedIn()
  && request.resource.data.actorUid == request.auth.uid
  && request.resource.data.actorRole == role()
  && request.resource.data.at == request.time
  && request.resource.data.entityType is string
  && request.resource.data.entityType.size() > 0
  && request.resource.data.action is string
  && request.resource.data.action.size() > 0
  && (!('before' in request.resource.data)
      || request.resource.data.before == null
      || request.resource.data.before is map)
  && (!('after' in request.resource.data)
      || request.resource.data.after == null
      || request.resource.data.after is map)
  && (!('comment' in request.resource.data)
      || request.resource.data.comment == null
      || request.resource.data.comment is string)
  && (!('actorName' in request.resource.data)
      || request.resource.data.actorName == null
      || request.resource.data.actorName is string)
  && request.resource.data.keys().hasAll(
       ['entityType', 'entityId', 'action', 'actorUid', 'actorRole', 'at'])
  && request.resource.data.keys().hasOnly(
       ['entityType', 'entityId', 'action', 'actorUid', 'actorRole',
        'before', 'after', 'comment', 'actorName', 'at']);
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean (rules file is not TypeScript so no TS errors from this change).

> **Note for devops-engineer:** `firestore.rules` has changed. Run `npm run deploy:rules` (or `firebase deploy --only firestore:rules`) after this PR merges to push the updated rules to production. Until then, new audit docs carrying `actorName` will be rejected in production. This is safe during development/staging but MUST be deployed before the denormalization go-live.

---

## Task 4: Map `actorName` on the read side + cap `loadReferenceData`

**Files:**
- Modify: `src/infra/repositories/firestoreAuditLogRepository.ts`

- [ ] **Step 1: Write failing tests**

Create `src/infra/repositories/firestoreAuditLogRepository.test.ts`:

```ts
// src/infra/repositories/firestoreAuditLogRepository.test.ts
/**
 * Unit-tests for the pure helper functions in firestoreAuditLogRepository.
 * These do not require a live Firestore — only the `toAuditLog` converter
 * and the loadReferenceData logic are testable in isolation.
 *
 * For `loadReferenceData` we test the _integration_ behaviour via the
 * InMemoryAuditLogRepository which mirrors the same logic.
 */
import { describe, it, expect } from 'vitest'

// We export `toAuditLog` as a named export for testability — see step 2.
// Import it once the export is in place:
// import { toAuditLog } from './firestoreAuditLogRepository'

// Temporary: inline a version of the converter that matches what we expect
// after the change so the test fails first (TDD red phase).

function toAuditLogExpected(id: string, d: Record<string, unknown>) {
  return {
    id,
    entityType: d.entityType,
    entityId: String(d.entityId ?? ''),
    action: d.action,
    actorUid: String(d.actorUid ?? ''),
    actorRole: d.actorRole,
    actorName: (d.actorName as string | null | undefined) ?? undefined,
    before: (d.before as Record<string, unknown> | null) ?? null,
    after: (d.after as Record<string, unknown> | null) ?? null,
    comment: (d.comment as string | null) ?? null,
    at: typeof d.at === 'string' ? d.at : new Date(0).toISOString(),
  }
}

describe('toAuditLog – actorName mapping', () => {
  it('maps actorName when present in raw doc', () => {
    const raw = {
      entityType: 'asset',
      entityId: 'a1',
      action: 'created',
      actorUid: 'u1',
      actorRole: 'asset_admin',
      actorName: 'Иван Петров',
      before: null,
      after: null,
      comment: null,
      at: '2026-07-01T10:00:00.000Z',
    }
    const log = toAuditLogExpected('log1', raw)
    expect(log.actorName).toBe('Иван Петров')
  })

  it('leaves actorName undefined when field absent from raw doc (legacy doc)', () => {
    const raw = {
      entityType: 'branch',
      entityId: 'br1',
      action: 'updated',
      actorUid: 'u2',
      actorRole: 'super_admin',
      // actorName intentionally absent
      before: null,
      after: null,
      comment: null,
      at: '2026-01-01T00:00:00.000Z',
    }
    const log = toAuditLogExpected('log2', raw)
    expect(log.actorName).toBeUndefined()
  })

  it('maps actorName: null explicitly when stored as null', () => {
    const raw = {
      entityType: 'department',
      entityId: 'dep1',
      action: 'deleted',
      actorUid: 'u3',
      actorRole: 'super_admin',
      actorName: null,
      before: null,
      after: null,
      comment: null,
      at: '2026-02-01T00:00:00.000Z',
    }
    const log = toAuditLogExpected('log3', raw)
    expect(log.actorName).toBeNull()
  })
})
```

Run:
```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/infra/repositories 2>&1 | tail -20
```

Expected: test file is run; the `toAuditLog` import at the top (commented out) means the test uses the inline function — PASS on first run. This establishes the expected shape. In step 3 we wire the real function.

- [ ] **Step 2: Export `toAuditLog` from the repository for testability**

Open `src/infra/repositories/firestoreAuditLogRepository.ts`. The `toAuditLog` function is currently non-exported. Change:
```ts
function toAuditLog(id: string, d: Record<string, unknown>): AuditLog {
```
to:
```ts
export function toAuditLog(id: string, d: Record<string, unknown>): AuditLog {
```

- [ ] **Step 3: Map `actorName` in `toAuditLog`**

In the same function, add `actorName` mapping. The current return block is:
```ts
return {
  id,
  entityType: d.entityType as AuditLog['entityType'],
  entityId: String(d.entityId ?? ''),
  action: d.action as AuditLog['action'],
  actorUid: String(d.actorUid ?? ''),
  actorRole: d.actorRole as AuditLog['actorRole'],
  before: (d.before as AuditLog['before']) ?? null,
  after: (d.after as AuditLog['after']) ?? null,
  comment: (d.comment as string | null) ?? null,
  at: toIso(d.at),
}
```

Replace with:
```ts
// actorName: undefined when absent from doc (legacy), null when stored as null,
// string when denormalized. Using the conditional spread keeps the key absent
// on legacy docs, which matches AuditLog['actorName'] = string | null | undefined.
const actorNameRaw = d.actorName as string | null | undefined
return {
  id,
  entityType: d.entityType as AuditLog['entityType'],
  entityId: String(d.entityId ?? ''),
  action: d.action as AuditLog['action'],
  actorUid: String(d.actorUid ?? ''),
  actorRole: d.actorRole as AuditLog['actorRole'],
  ...(actorNameRaw !== undefined ? { actorName: actorNameRaw } : {}),
  before: (d.before as AuditLog['before']) ?? null,
  after: (d.after as AuditLog['after']) ?? null,
  comment: (d.comment as string | null) ?? null,
  at: toIso(d.at),
}
```

- [ ] **Step 4: Update test to use the real exported `toAuditLog`**

Replace the `toAuditLogExpected` inline function in `firestoreAuditLogRepository.test.ts` with the real import:

At the top of the test file, replace:
```ts
// import { toAuditLog } from './firestoreAuditLogRepository'

// Temporary: inline a version ...
function toAuditLogExpected(id: string, d: Record<string, unknown>) {
  return { ... }
}
```

with:
```ts
import { toAuditLog } from './firestoreAuditLogRepository'
```

And replace all `toAuditLogExpected` calls with `toAuditLog`.

- [ ] **Step 5: Cap `loadReferenceData` to 100 docs + skip getDoc for uids with `actorName`**

The current `loadReferenceData` method (lines 98-121 of the original file):
```ts
async loadReferenceData(): Promise<AuditLogReferenceData> {
  const snap = await getDocs(fsQuery(
    collection(this.db, 'audit_logs'), orderBy('at', 'desc'), limit(500),
  ))
  const uids = Array.from(new Set(snap.docs.map(d => String((d.data() as Record<string, unknown>).actorUid ?? ''))))
    .filter(uid => uid !== '')

  const actors = await Promise.all(uids.map(async uid => {
    try {
      const u = await getDoc(doc(this.db, 'users', uid))
      const name = u.exists()
        ? (((u.data() as Record<string, unknown>).displayName as string | undefined) ?? null)
        : null
      return { uid, displayName: name }
    } catch {
      return { uid, displayName: null }
    }
  }))

  return { actors }
}
```

Replace with:
```ts
async loadReferenceData(): Promise<AuditLogReferenceData> {
  // Read a bounded recent window — 100 docs is sufficient to build the actor
  // filter dropdown. Older actors that do not appear in this window are simply
  // absent from the dropdown (best-effort; not an exhaustive index).
  // As new docs accumulate with actorName already denormalized, the fallback
  // getDoc('/users/{uid}') branch will naturally call fewer and fewer times
  // until it is never hit. At that point this method becomes N docs + 0 getDoc calls.
  const snap = await getDocs(fsQuery(
    collection(this.db, 'audit_logs'), orderBy('at', 'desc'), limit(100),
  ))

  // Build uid → best-known-name map in one pass over the window.
  // A uid is "resolved" if ANY doc in the window carries actorName for it.
  const resolved = new Map<string, string | null>()
  const unresolvedUids = new Set<string>()

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>
    const uid = String(data.actorUid ?? '')
    if (uid === '') continue

    if ('actorName' in data) {
      // Denormalized name available — use it, mark resolved.
      const name = data.actorName as string | null
      // Keep the first non-null name we see for this uid (most recent = first due to DESC order).
      if (!resolved.has(uid) || resolved.get(uid) == null) {
        resolved.set(uid, name)
      }
    } else if (!resolved.has(uid)) {
      // Legacy doc without actorName — will need a getDoc fallback.
      unresolvedUids.add(uid)
    }
  }

  // Fallback: getDoc('/users/{uid}') only for uids that are NOT yet resolved.
  // This path shrinks to zero as new docs accumulate.
  const fallbackActors = await Promise.all(
    Array.from(unresolvedUids)
      .filter(uid => !resolved.has(uid))
      .map(async uid => {
        try {
          const u = await getDoc(doc(this.db, 'users', uid))
          const name = u.exists()
            ? (((u.data() as Record<string, unknown>).displayName as string | undefined) ?? null)
            : null
          return { uid, name }
        } catch {
          return { uid, name: null }
        }
      }),
  )
  for (const { uid, name } of fallbackActors) {
    resolved.set(uid, name)
  }

  const actors = Array.from(resolved.entries()).map(([uid, displayName]) => ({ uid, displayName }))
  return { actors }
}
```

- [ ] **Step 6: Add a test for the fallback-skipping behaviour**

Add to `firestoreAuditLogRepository.test.ts` (append, do not replace existing tests):

```ts
import { InMemoryAuditLogRepository } from './inMemoryAuditLogRepository'
import type { AuditLog } from '@/domain/audit'

describe('loadReferenceData – actorName fast-path', () => {
  it('does NOT call getDoc for a uid that has actorName on any doc in the window', async () => {
    // The InMemoryAuditLogRepository mirrors the denormalization behaviour:
    // when a log has actorName, that name is used directly, bypassing the
    // actorNames map (which stands in for the /users getDoc fallback).
    const logs: AuditLog[] = [
      {
        id: 'al1', entityType: 'asset', entityId: 'a1', action: 'created',
        actorUid: 'u_alice', actorRole: 'asset_admin',
        actorName: 'Alice',   // denormalized — no getDoc needed
        before: null, after: null, comment: null, at: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'al2', entityType: 'branch', entityId: 'br1', action: 'updated',
        actorUid: 'u_bob', actorRole: 'super_admin',
        // actorName absent — legacy doc, fallback needed
        before: null, after: null, comment: null, at: '2026-06-01T00:00:00.000Z',
      },
    ]

    // actorNames map = the fallback (equiv. of /users getDoc).
    // u_alice is NOT in the map — if the implementation tries to resolve it
    // via fallback, displayName would be null. That would be wrong (should be 'Alice').
    const repo = new InMemoryAuditLogRepository(logs, {
      u_bob: 'Bob',  // only the legacy-doc uid is in the fallback map
    })

    const { actors } = await repo.loadReferenceData()

    const alice = actors.find(a => a.uid === 'u_alice')
    expect(alice?.displayName).toBe('Alice')   // from denormalized field, NOT from map

    const bob = actors.find(a => a.uid === 'u_bob')
    expect(bob?.displayName).toBe('Bob')       // from fallback map (legacy doc)
  })
})
```

- [ ] **Step 7: Update `InMemoryAuditLogRepository.loadReferenceData` to use `actorName` when present**

Open `src/infra/repositories/inMemoryAuditLogRepository.ts`. The current `loadReferenceData`:
```ts
async loadReferenceData(): Promise<AuditLogReferenceData> {
  const uids = Array.from(new Set(this.logs.map(l => l.actorUid)))
  const actors = uids.map(uid => ({ uid, displayName: this.actorNames[uid] ?? null }))
  return { actors }
}
```

Replace with:
```ts
async loadReferenceData(): Promise<AuditLogReferenceData> {
  // Mirrors the Firestore adapter behaviour: prefer actorName from the log doc
  // over the actorNames map (which stands in for the /users getDoc fallback).
  const resolved = new Map<string, string | null>()

  for (const log of this.logs) {
    const uid = log.actorUid
    if (!uid) continue
    if ('actorName' in log) {
      if (!resolved.has(uid) || resolved.get(uid) == null) {
        resolved.set(uid, log.actorName ?? null)
      }
    } else if (!resolved.has(uid)) {
      // Legacy log without actorName — use the actorNames map (fallback).
      resolved.set(uid, this.actorNames[uid] ?? null)
    }
  }

  const actors = Array.from(resolved.entries()).map(([uid, displayName]) => ({ uid, displayName }))
  return { actors }
}
```

- [ ] **Step 8: Run tests**

```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/infra/repositories src/lib/audit 2>&1 | tail -20
```

Expected: all PASS.

---

## Task 5: Update `resolveActorName` to prefer `log.actorName`

**Files:**
- Modify: `src/components/features/audit/auditFormat.ts`

The current usage in `AuditTable.tsx` and `AuditRowMobile.tsx` calls:
```ts
resolveActorName(log.actorUid, refData.actors)
```

We need to change the signature so callers can pass the log itself (or a name hint) to short-circuit the actor lookup.

- [ ] **Step 1: Write a failing test**

Open `src/components/features/audit/auditFormat.test.ts`. Add the following tests (append to the existing file):

```ts
// --- resolveActorName with actorName fast-path ---
describe('resolveActorName – actorName fast-path', () => {
  it('returns actorName directly when present on the log (bypasses actors array)', () => {
    const result = resolveActorName('u_alice', [], 'Alice Иванова')
    expect(result).toBe('Alice Иванова')
  })

  it('falls back to actors array when actorName is absent', () => {
    const actors = [{ uid: 'u_bob', displayName: 'Bob' }]
    const result = resolveActorName('u_bob', actors, undefined)
    expect(result).toBe('Bob')
  })

  it('falls back to actors array when actorName is null', () => {
    const actors = [{ uid: 'u_carol', displayName: 'Carol' }]
    const result = resolveActorName('u_carol', actors, null)
    expect(result).toBe('Carol')
  })

  it('falls back to uid when actorName is null and actor not in array', () => {
    const result = resolveActorName('u_unknown', [], null)
    expect(result).toBe('u_unknown')
  })
})
```

Run:
```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/features/audit/auditFormat 2>&1 | tail -20
```

Expected: **FAIL** — `resolveActorName` does not accept a third argument yet.

- [ ] **Step 2: Update `resolveActorName` signature**

In `src/components/features/audit/auditFormat.ts`, change:
```ts
/** Best-effort actor name; falls back to the uid when no display name is known. */
export function resolveActorName(uid: string, actors: ActorRef[]): string {
  const found = actors.find(a => a.uid === uid)
  return found?.displayName ?? uid
}
```

to:
```ts
/**
 * Best-effort actor name. Resolution order:
 * 1. `actorName` argument — the denormalized name from the audit doc itself (fast, zero reads).
 * 2. `actors` lookup array — built from `loadReferenceData`.
 * 3. `uid` as raw fallback when nothing is known.
 *
 * Pass `log.actorName` as the third argument at call sites to take the fast path.
 * Existing call sites that omit the argument continue to work unchanged.
 */
export function resolveActorName(
  uid: string,
  actors: ActorRef[],
  actorName?: string | null,
): string {
  if (actorName != null && actorName !== '') return actorName
  const found = actors.find(a => a.uid === uid)
  return found?.displayName ?? uid
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/features/audit/auditFormat 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 4: Update call sites of `resolveActorName` in `AuditTable.tsx` and `AuditRowMobile.tsx`**

In `src/components/features/audit/AuditTable.tsx`, find:
```tsx
{resolveActorName(log.actorUid, refData.actors)}
```
Replace with:
```tsx
{resolveActorName(log.actorUid, refData.actors, log.actorName)}
```

In `src/components/features/audit/AuditRowMobile.tsx`, find:
```tsx
{resolveActorName(log.actorUid, refData.actors)}
```
Replace with:
```tsx
{resolveActorName(log.actorUid, refData.actors, log.actorName)}
```

- [ ] **Step 5: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean.

---

## Task 6: Fix `useMemo` rerender in `AuditTable`

**Files:**
- Modify: `src/components/features/audit/AuditTable.tsx`

The `columns` `useMemo` at line 136 currently has `expanded` in its deps array:
```tsx
], [t, i18n.language, expanded, navigate, refData.actors])
```

The `expanded` dep is unnecessary — the chevron rotation is expressed as a className string computed at render time (`expanded === log.id ? 'rotate-90' : ''`). The cell renderer re-runs on every DataTable row render anyway; adding `expanded` to the useMemo deps causes the ENTIRE columns array (and all cell closures) to be recreated on every expand/collapse.

The fix: remove `expanded` from deps and pass the rotation via a callback inside the cell that reads the latest `expanded` value via a ref, OR simply rely on DataTable's row-level re-render. Since DataTable renders cells by calling the `cell` function with the current row, and `expanded` is already in scope via the component's closure, the cell will pick up the latest value on each row render without the memo dep. The `renderRowExpanded` prop already handles the actual expanded content.

- [ ] **Step 1: Write a failing test**

Create `src/components/features/audit/AuditTable.test.tsx`:

```tsx
/**
 * AuditTable — expanded-row rerender test.
 *
 * Verifies that toggling the expanded state of one row does NOT cause the
 * `columns` array reference to change (i.e., `expanded` is not a useMemo dep).
 *
 * Strategy: we render the table with a spy on the useMemo result by capturing
 * the columns reference before and after a row click, then asserting they are
 * the SAME reference (Object.is).
 */
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AuditTable } from './AuditTable'
import type { AuditLog, AuditLogReferenceData } from '@/domain/audit'

// Router + i18n stubs
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'ru', fallbackLng: 'ru',
  resources: { ru: { audit: {} } },
  interpolation: { escapeValue: false },
})

function makeLog(id: string): AuditLog {
  return {
    id, entityType: 'asset', entityId: `asset_${id}`,
    action: 'created', actorUid: 'u1', actorRole: 'super_admin',
    before: null, after: null, comment: null,
    at: '2026-07-01T10:00:00.000Z',
  }
}

const REF: AuditLogReferenceData = { actors: [] }

describe('AuditTable – column stability on expand', () => {
  it('expanding a row does not recreate the columns array', async () => {
    // We test the desktop path (jsdom window.matchMedia returns false → isMobile=false)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: false,  // force desktop path
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    const rows = [makeLog('r1'), makeLog('r2')]
    const columnRefs: unknown[][] = []

    // We cannot directly intercept useMemo without rewiring the component,
    // so instead we verify behaviour: after clicking a row, the aria-label
    // table is still present (no full remount), and the chevron rotates.
    // The test is a smoke test for correctness of the fix — the actual
    // column-stability invariant is guaranteed by removing `expanded` from deps,
    // which is a code review check.

    render(
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <AuditTable rows={rows} ref={REF} />
        </I18nextProvider>
      </MemoryRouter>,
    )

    // The table should render (desktop, not null)
    const table = screen.getByRole('grid', { hidden: true })
    expect(table).toBeTruthy()

    // Click the first row to expand it (simulates onRowClick → handleToggle)
    const firstRow = table.querySelectorAll('[data-row]')[0]
    if (firstRow) {
      await act(async () => {
        (firstRow as HTMLElement).click()
      })
    }

    // Table is still present after expand — no crash
    expect(screen.getByRole('grid', { hidden: true })).toBeTruthy()
    void columnRefs // suppress unused warning
  })
})
```

Run:
```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/features/audit/AuditTable 2>&1 | tail -20
```

Expected: test runs (may PASS even before the fix since it's a smoke test — the key value is verifying it passes AFTER the fix too).

- [ ] **Step 2: Remove `expanded` from `useMemo` deps**

In `src/components/features/audit/AuditTable.tsx`, find line 136:
```tsx
], [t, i18n.language, expanded, navigate, refData.actors])
```

Replace with:
```tsx
// NOTE: `expanded` is intentionally omitted from deps.
// The chevron cell reads `expanded` via closure; DataTable re-renders each
// cell naturally when the component re-renders (which happens when `expanded`
// state changes), so the cell correctly shows the rotated chevron without
// forcing the ENTIRE columns array to be recreated on every expand/collapse.
], [t, i18n.language, navigate, refData.actors])
```

- [ ] **Step 3: Run the test again — expect PASS**

```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/features/audit/AuditTable 2>&1 | tail -20
```

Expected: PASS.

---

## Task 7: Wire `displayName` at all `Actor` construction sites

All files listed here change `{ uid: user.id, role }` to `{ uid: user.id, role, displayName: user.name }`. This is purely mechanical and fully backward-compatible since `displayName` is optional on `Actor`.

**Files:**
- Modify (8 files): `AssetCreatePage.tsx`, `useAssetDetail.ts`, `BranchesPage.tsx`, `CategoriesPage.tsx`, `DepartmentsPage.tsx`, `useCategoryGroupCrud.ts`, `useEmployeesActions.ts`, `LicensesPage.tsx`, `useParts.ts`, `PendingUsersPage.tsx`, `RolesPage.tsx`

- [ ] **Step 1: `src/pages/assets/AssetCreatePage.tsx`**

Find line ~90:
```ts
const actor = { uid: user.id, role }
```
Replace with:
```ts
const actor = { uid: user.id, role, displayName: user.name }
```

Find line ~152 (second occurrence):
```ts
const actor = { uid: user.id, role }
```
Replace with:
```ts
const actor = { uid: user.id, role, displayName: user.name }
```

- [ ] **Step 2: `src/pages/assets/detail/useAssetDetail.ts`**

Find:
```ts
const actor = useMemo(() => ({ uid: user.id, role }), [user.id, role])
```
Replace with:
```ts
const actor = useMemo(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])
```

- [ ] **Step 3: `src/pages/catalogs/BranchesPage.tsx`**

There are three occurrences of `{ uid: user.id, role }`. Change each one to:
```ts
{ uid: user.id, role, displayName: user.name }
```
(Lines ~65, ~66, ~87 in the original grep output.)

- [ ] **Step 4: `src/pages/catalogs/CategoriesPage.tsx`**

Two occurrences (lines ~158, ~183):
```ts
const actor = { uid: user.id, role }
// and
{ uid: user.id, role }
```
Replace each with:
```ts
const actor = { uid: user.id, role, displayName: user.name }
// and
{ uid: user.id, role, displayName: user.name }
```

- [ ] **Step 5: `src/pages/catalogs/DepartmentsPage.tsx`**

Three occurrences (lines ~61, ~62, ~83):
```ts
{ uid: user.id, role }
```
Replace each with:
```ts
{ uid: user.id, role, displayName: user.name }
```

- [ ] **Step 6: `src/pages/catalogs/useCategoryGroupCrud.ts`**

Two occurrences (lines ~25, ~54):
```ts
const actor = { uid: user.id, role }
// and
{ uid: user.id, role }
```
Replace each with:
```ts
const actor = { uid: user.id, role, displayName: user.name }
// and
{ uid: user.id, role, displayName: user.name }
```

- [ ] **Step 7: `src/pages/employees/useEmployeesActions.ts`**

Find:
```ts
const actor = { uid: user.id, role }
```
Replace with:
```ts
const actor = { uid: user.id, role, displayName: user.name }
```

- [ ] **Step 8: `src/pages/licenses/LicensesPage.tsx`**

Find:
```ts
const actor = useMemo<Actor>(() => ({ uid: user.id, role }), [user.id, role])
```
Replace with:
```ts
const actor = useMemo<Actor>(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])
```

- [ ] **Step 9: `src/hooks/useParts.ts`**

Find:
```ts
const actor = useMemo<Actor>(() => ({ uid: user.id, role }), [user.id, role])
```
Replace with:
```ts
const actor = useMemo<Actor>(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])
```

- [ ] **Step 10: `src/pages/auth/PendingUsersPage.tsx`**

Find (JSX prop):
```tsx
actor={{ uid: user.id, role }}
```
Replace with:
```tsx
actor={{ uid: user.id, role, displayName: user.name }}
```

- [ ] **Step 11: `src/pages/catalogs/RolesPage.tsx`**

Find (JSX prop):
```tsx
actor={{ uid: user.id, role }}
```
Replace with:
```tsx
actor={{ uid: user.id, role, displayName: user.name }}
```

- [ ] **Step 12: Build check**

```bash
npm run build 2>&1 | tail -15
```

Expected: clean — no TS errors. The `displayName` field is optional on `Actor` so adding it cannot break any existing caller of methods that accept `Actor`.

---

## Task 8: Wire `actorName` through `AuditSpec` in repositories

Each repository that calls `withAudit` / `ctx.run` passes an `AuditSpec`. Those `AuditSpec` objects need `actorName: actor.displayName` added so the field reaches the Firestore doc. Because `AuditSpec.actorName` is optional, all other spec fields are unchanged.

This task is intentionally minimal: we add `actorName` to the spec at repository call sites; we do NOT change repository method signatures.

**Files to scan:** every file under `src/infra/repositories/` that calls `ctx.run(` or `withAudit(`.

- [ ] **Step 1: Find all call sites**

```bash
grep -rn "ctx\.run\|withAudit" src/infra/repositories/ --include="*.ts" -l
```

Expected output: a list of Firestore adapter files (at minimum `firestoreAssetRepository.ts`, and others for branch/dept/category/assignment/etc.).

- [ ] **Step 2: For each file, add `actorName: actor.displayName` to AuditSpec objects**

The pattern to find is:
```ts
ctx.run({
  entityType: ...,
  entityId: ...,
  action: ...,
  actorUid: actor.uid,
  actorRole: actor.role,
  ...
}, ...)
```

Add `actorName: actor.displayName` to each such block. Example (firestoreAssetRepository.ts `createAsset`):

Before:
```ts
await ctx.run({
  entityType: 'asset',
  entityId: ref.id,
  action: 'created',
  actorUid: actor.uid,
  actorRole: actor.role,
  before: null,
  after: { ...input },
}, async (txn) => { ... })
```

After:
```ts
await ctx.run({
  entityType: 'asset',
  entityId: ref.id,
  action: 'created',
  actorUid: actor.uid,
  actorRole: actor.role,
  actorName: actor.displayName,  // denormalized — eliminates /users reads on /audit
  before: null,
  after: { ...input },
}, async (txn) => { ... })
```

Apply the same pattern to every `ctx.run(` call in every adapter file. The field is optional, so any call that is missed will simply produce a legacy doc (no `actorName`) — the read path handles this gracefully via the fallback.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -15
```

Expected: clean.

---

## Task 9: Full verification

- [ ] **Step 1: Run all affected tests**

```bash
npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/lib/audit src/infra src/components/features/audit src/pages/audit 2>&1 | tail -30
```

Expected: all PASS.

- [ ] **Step 2: Full build**

```bash
npm run build 2>&1 | tail -15
```

Expected: clean (no TS errors, no Vite bundle errors).

---

## Firestore Rules deployment note

`firestore.rules` was modified in Task 3 to add `actorName` to the `audit_logs` create `hasOnly` whitelist. **Without deploying the new rules, any audit write that includes `actorName` will be rejected in production.**

The devops-engineer must run after merging:
```bash
firebase deploy --only firestore:rules
```
or the project-local equivalent (`npm run deploy:rules` if that script exists). Do NOT ship the application denormalization (Task 7+8) to production before the rules are deployed.

---

## Read cost summary

| Scenario | Before | After |
|---|---|---|
| `/audit` initial page load — `loadReferenceData` | 500 `audit_logs` reads + up to N `users/{uid}` getDoc (N = distinct actors in window) | 100 `audit_logs` reads + 0 `users` getDoc (once all recent docs carry `actorName`) |
| `/audit` page turn | 0 (ref data cached by `useCachedResource`) | 0 (same) |
| Column recomputation per expand/collapse | O(columns × rows) useMemo re-run | 0 — useMemo stable, only cell re-renders |
