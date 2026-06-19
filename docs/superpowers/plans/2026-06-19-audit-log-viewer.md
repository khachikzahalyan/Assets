# Audit Log Viewer (/audit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Super-Admin audit browser at `/audit` that surfaces the immutable `audit_logs` trail end-to-end — a dense, read-only, filterable, cursor-paginated table with before/after diff inspection, fully i18n'd (ru/en/hy).

**Architecture:** Read-only ports-and-adapters, mirroring the established `AssignmentRepository` pattern. A new `AuditLogRepository` read port (NO write methods — audit_logs is immutable; entries are only ever created inside `withAudit()`) with `InMemoryAuditLogRepository` (tests/dev) and `FirestoreAuditLogRepository` (production) adapters. Query supports filter by entityType / action / actor / date-range, sort by `at` desc, and **cursor-based pagination** (unlike AssetsPage's full-fetch + UI-slice — audit_logs grows unbounded). A `useAuditLogs` hook drives the `AuditPage`, which mirrors `AssetsPage`'s PageHeader + SectionCard + filter-bar + table composition. Diff display reuses the visual language of `AssetHistory`. Route is super_admin-gated (already in nav config); we only un-stub it.

**Tech Stack:** React 19 + Vite + TypeScript (strict) + Firebase v9 modular + i18next (ru/en/hy) + Vitest + @testing-library/react. Dark/orange theme. Date format DD/Mon/YYYY. Repo-factory pattern (pages import no Firebase directly).

**Read-authorization decision (LOCKED):** This page is `super_admin`-only at the route level. `routeRoles('audit')` already resolves to `['super_admin']` via `src/config/access.ts` (derived from `nav.ts`). The existing firestore.rules `/audit_logs` read rule already grants `isAnyAdmin()` full read + employees a self-scoped read; we do NOT change those rules. Whether asset_admin/tech_admin should get a scoped viewer is a **deferred owner decision** (see "Deferred decisions"), NOT built here.

**Security invariants (do NOT violate):**
- NO write/update/delete methods on the repository or in rules. audit_logs immutability is the system's hard invariant.
- Display before/after payloads AS-IS. License keys etc. are masked at write time. Do NOT attempt to unmask. Do NOT add any reveal affordance.
- Route-level super_admin gate + existing rules read-scoping are the two enforcement layers.

---

## File Structure

**Domain (Task 1 — domain-modeler):**
- Create `src/domain/audit/AuditLogRepository.ts` — read port: `AuditLogQuery`, `AuditLogPage`, `AuditLogRepository`, `AuditLogReferenceData`, `ActorRef`.
- Modify `src/domain/audit/index.ts` — export the new port file.

**Infra (Task 2-3 — firebase-engineer):**
- Create `src/infra/repositories/inMemoryAuditLogRepository.ts` — `InMemoryAuditLogRepository` (filters + sort + emulated cursor paging over an in-memory `AuditLog[]`).
- Create `src/infra/repositories/inMemoryAuditLogRepository.test.ts` — adapter unit tests.
- Create `src/infra/repositories/firestoreAuditLogRepository.ts` — `FirestoreAuditLogRepository` (Firestore query + cursor + reference data).
- Modify `src/infra/repositories/index.ts` — export both adapters.
- Modify `firestore.indexes.json` — composite indexes for the filter combinations.

**Hook (Task 4 — react-ui-engineer):**
- Create `src/hooks/useAuditLogs.ts` — fetches a page + reference data; exposes cursor next/prev navigation.
- Modify `src/hooks/index.ts` — export the hook.

**UI components (Task 5-7 — react-ui-engineer):**
- Create `src/components/features/audit/index.ts` — barrel.
- Create `src/components/features/audit/auditFormat.ts` — `formatAuditTs` (DD/Mon/YYYY + HH:MM), `resolveActorName`, entity-link resolver, diff computation helper.
- Create `src/components/features/audit/auditFormat.test.ts` — pure-function tests.
- Create `src/components/features/audit/AuditFilterBar.tsx` — entityType / action / actor / date-range / search controls.
- Create `src/components/features/audit/AuditTable.tsx` — dense table; expandable rows revealing before/after diff.
- Create `src/components/features/audit/AuditDiff.tsx` — before/after key-by-key diff renderer (masked-safe, display-as-is).

**Page (Task 8 — react-ui-engineer):**
- Create `src/pages/AuditPage.tsx` — composition root (lazy Firestore repo, test-injectable).
- Modify `src/pages/index.ts` — export `AuditPage`.
- Modify `src/config/routes.tsx` — wire `/audit` to `AuditPage` (remove from stub).
- Modify `src/config/nav.ts` — remove `'audit'` from `PHASE_STUB_ROUTES`.

**i18n (Task 9 — i18n-engineer):**
- Create `src/locales/ru/audit.json`, `src/locales/en/audit.json`, `src/locales/hy/audit.json`.
- (nav `items.audit` already exists in all three locales — verify only.)

**Tests (Task 10 — test-engineer, after each implementer + final):**
- Create `src/pages/AuditPage.test.tsx` — component test against InMemory repo.
- Rules tests: append an `audit_logs` read-scoping describe block to the existing rules test (CI-only; Java unavailable locally — author, do not run).

---

## Task 1: Domain read port (domain-modeler)

**Files:**
- Create: `src/domain/audit/AuditLogRepository.ts`
- Modify: `src/domain/audit/index.ts`
- Test: `src/domain/audit/AuditLogRepository.test-d.ts` (type-level only — optional compile check)

- [ ] **Step 1: Write the port file**

`src/domain/audit/AuditLogRepository.ts`:

```typescript
import type { AuditLog, AuditEntityType, AuditAction } from './types'
import type { Role } from '@/config/roles'

/** A filterable, sorted, cursor-paginated query over the immutable audit trail. */
export interface AuditLogQuery {
  /** Filter by entity type, or 'all' for no filter. */
  entityType: AuditEntityType | 'all'
  /** Filter by action, or 'all' for no filter. */
  action: AuditAction | 'all'
  /** Filter by exact actor uid, or 'all' for no filter. */
  actorUid: string | 'all'
  /** Inclusive lower bound (ISO date or datetime), or null for no bound. */
  fromDate: string | null
  /** Inclusive upper bound (ISO date or datetime), or null for no bound. */
  toDate: string | null
  /** Free-text contains match over entityId + actorUid (client-side narrowing). */
  search: string
  /** Page size. */
  pageSize: number
}

/** An opaque cursor token. The repository owns its encoding; callers treat it as a black box. */
export type AuditCursor = string

/** One page of results plus the cursor to fetch the NEXT page (null if last page). */
export interface AuditLogPage {
  rows: AuditLog[]
  /** Cursor for the next page; null when there are no more rows. */
  nextCursor: AuditCursor | null
}

/** A resolvable actor: uid plus a best-effort display name. */
export interface ActorRef {
  uid: string
  displayName: string | null
}

/** Reference data to render the table + populate filter dropdowns without N+1 reads. */
export interface AuditLogReferenceData {
  /** Distinct actors seen, for the actor filter + name resolution (uid -> displayName). */
  actors: ActorRef[]
}

/**
 * READ-ONLY port for the immutable audit trail. There are intentionally NO
 * create/update/delete methods: audit_logs entries are only ever appended inside
 * withAudit() transactions, and the collection is immutable in firestore.rules
 * (allow update, delete: if false). Adding a write method here would be a
 * security FAIL.
 *
 * Implementations: firestoreAuditLogRepository (production),
 * inMemoryAuditLogRepository (tests/dev).
 */
export interface AuditLogRepository {
  /** Fetch one page of audit entries matching the query, sorted by `at` DESC.
   *  Pass `cursor = null` for the first page. */
  listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage>
  /** Load reference data (distinct actors with display names) for filters + name resolution. */
  loadReferenceData(): Promise<AuditLogReferenceData>
}

/** Re-export for convenience at call sites that build queries. */
export type { Role }
```

- [ ] **Step 2: Export from barrel**

Modify `src/domain/audit/index.ts` — append:

```typescript
export * from './AuditLogRepository'
```

(Verify current content first; it should already export `./types`. The full file becomes:)

```typescript
export * from './types'
export * from './AuditLogRepository'
```

- [ ] **Step 3: Typecheck**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add src/domain/audit/
git commit -m "feat(audit): add read-only AuditLogRepository port"
```

**Non-goals:** No write methods. No adapter. No UI.

---

## Task 2: InMemory adapter + tests (firebase-engineer)

**Files:**
- Create: `src/infra/repositories/inMemoryAuditLogRepository.ts`
- Create: `src/infra/repositories/inMemoryAuditLogRepository.test.ts`
- Modify: `src/infra/repositories/index.ts`

- [ ] **Step 1: Write the failing test**

`src/infra/repositories/inMemoryAuditLogRepository.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { InMemoryAuditLogRepository } from './inMemoryAuditLogRepository'
import type { AuditLog } from '@/domain/audit'

function log(over: Partial<AuditLog>): AuditLog {
  return {
    id: over.id ?? 'al_x',
    entityType: over.entityType ?? 'asset',
    entityId: over.entityId ?? 'a_1',
    action: over.action ?? 'created',
    actorUid: over.actorUid ?? 'u_1',
    actorRole: over.actorRole ?? 'super_admin',
    before: over.before ?? null,
    after: over.after ?? null,
    comment: over.comment ?? null,
    at: over.at ?? '2026-06-01T10:00:00.000Z',
  }
}

const seed: AuditLog[] = [
  log({ id: 'al_1', entityType: 'asset', action: 'created', actorUid: 'u_1', at: '2026-06-01T10:00:00.000Z' }),
  log({ id: 'al_2', entityType: 'asset', action: 'updated', actorUid: 'u_2', at: '2026-06-02T10:00:00.000Z' }),
  log({ id: 'al_3', entityType: 'employee', action: 'created', actorUid: 'u_1', at: '2026-06-03T10:00:00.000Z' }),
  log({ id: 'al_4', entityType: 'assignment', action: 'assigned', actorUid: 'u_2', at: '2026-06-04T10:00:00.000Z' }),
]

const Q = {
  entityType: 'all' as const, action: 'all' as const, actorUid: 'all' as const,
  fromDate: null, toDate: null, search: '', pageSize: 10,
}

describe('InMemoryAuditLogRepository', () => {
  it('returns all rows sorted by at DESC on first page', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs(Q, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_4', 'al_3', 'al_2', 'al_1'])
    expect(page.nextCursor).toBeNull()
  })

  it('filters by entityType', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, entityType: 'asset' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_2', 'al_1'])
  })

  it('filters by action', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, action: 'created' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_1'])
  })

  it('filters by actorUid', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, actorUid: 'u_1' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_1'])
  })

  it('filters by inclusive date range', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs(
      { ...Q, fromDate: '2026-06-02T00:00:00.000Z', toDate: '2026-06-03T23:59:59.999Z' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_2'])
  })

  it('narrows by free-text search over entityId + actorUid', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, search: 'u_2' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_4', 'al_2'])
  })

  it('paginates with an opaque cursor', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const p1 = await repo.listAuditLogs({ ...Q, pageSize: 2 }, null)
    expect(p1.rows.map(r => r.id)).toEqual(['al_4', 'al_3'])
    expect(p1.nextCursor).not.toBeNull()
    const p2 = await repo.listAuditLogs({ ...Q, pageSize: 2 }, p1.nextCursor)
    expect(p2.rows.map(r => r.id)).toEqual(['al_2', 'al_1'])
    expect(p2.nextCursor).toBeNull()
  })

  it('loads distinct actors as reference data', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const ref = await repo.loadReferenceData()
    expect(ref.actors.map(a => a.uid).sort()).toEqual(['u_1', 'u_2'])
  })

  it('uses injected actor display names when provided', async () => {
    const repo = new InMemoryAuditLogRepository([...seed], { u_1: 'Khach', u_2: 'Anna' })
    const ref = await repo.loadReferenceData()
    const byUid = Object.fromEntries(ref.actors.map(a => [a.uid, a.displayName]))
    expect(byUid['u_1']).toBe('Khach')
    expect(byUid['u_2']).toBe('Anna')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryAuditLogRepository.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the adapter**

`src/infra/repositories/inMemoryAuditLogRepository.ts`:

```typescript
import type {
  AuditLog, AuditLogRepository, AuditLogQuery, AuditLogPage,
  AuditCursor, AuditLogReferenceData,
} from '@/domain/audit'

/**
 * In-memory READ-ONLY adapter for tests/dev. There are NO mutation methods:
 * audit_logs is immutable. The constructor seeds the store; nothing else writes.
 *
 * Cursor encoding: the index (as a string) of the first row of the NEXT page,
 * computed over the FILTERED+SORTED set. Opaque to callers.
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  constructor(
    private readonly logs: AuditLog[],
    /** Optional uid -> displayName map for actor name resolution. */
    private readonly actorNames: Record<string, string> = {},
  ) {}

  async listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage> {
    const filtered = this.logs
      .filter(l => query.entityType === 'all' || l.entityType === query.entityType)
      .filter(l => query.action === 'all' || l.action === query.action)
      .filter(l => query.actorUid === 'all' || l.actorUid === query.actorUid)
      .filter(l => query.fromDate == null || l.at >= query.fromDate)
      .filter(l => query.toDate == null || l.at <= query.toDate)
      .filter(l => {
        const s = query.search.trim().toLowerCase()
        if (s === '') return true
        return l.entityId.toLowerCase().includes(s) || l.actorUid.toLowerCase().includes(s)
      })
      // at DESC, id DESC tie-breaker for stable ordering
      .sort((a, b) => {
        const t = b.at.localeCompare(a.at)
        return t !== 0 ? t : b.id.localeCompare(a.id)
      })

    const start = cursor == null ? 0 : Number.parseInt(cursor, 10)
    const safeStart = Number.isFinite(start) && start > 0 ? start : 0
    const end = safeStart + query.pageSize
    const rows = filtered.slice(safeStart, end)
    const nextCursor: AuditCursor | null = end < filtered.length ? String(end) : null
    return { rows, nextCursor }
  }

  async loadReferenceData(): Promise<AuditLogReferenceData> {
    const uids = Array.from(new Set(this.logs.map(l => l.actorUid)))
    const actors = uids.map(uid => ({ uid, displayName: this.actorNames[uid] ?? null }))
    return { actors }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryAuditLogRepository.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Export from barrel**

Modify `src/infra/repositories/index.ts` — add after the user-repo exports:

```typescript
export * from './inMemoryAuditLogRepository'
export * from './firestoreAuditLogRepository'
```

(The `firestoreAuditLogRepository` export will resolve once Task 3 lands. If running typecheck between tasks 2 and 3, add only the inMemory line in Task 2 and the firestore line in Task 3. To keep typecheck green at Task 2's commit, add ONLY the inMemory export now:)

```typescript
export * from './inMemoryAuditLogRepository'
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck`
Expected: PASS.

```bash
git add src/infra/repositories/inMemoryAuditLogRepository.ts src/infra/repositories/inMemoryAuditLogRepository.test.ts src/infra/repositories/index.ts
git commit -m "feat(audit): InMemoryAuditLogRepository read adapter + tests"
```

**Non-goals:** No Firestore. No write methods.

---

## Task 3: Firestore adapter + indexes (firebase-engineer)

**Files:**
- Create: `src/infra/repositories/firestoreAuditLogRepository.ts`
- Modify: `src/infra/repositories/index.ts`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Write the adapter**

`src/infra/repositories/firestoreAuditLogRepository.ts`:

```typescript
import {
  collection, getDocs, query as fsQuery, where, orderBy, limit,
  startAfter, getDoc, doc, type Firestore, type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type {
  AuditLog, AuditLogRepository, AuditLogQuery, AuditLogPage,
  AuditCursor, AuditLogReferenceData,
} from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAuditLog(id: string, d: Record<string, unknown>): AuditLog {
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
}

/**
 * Production READ-ONLY adapter. NO mutation methods exist — audit_logs is
 * immutable. We rely on Firestore-side filtering for the equality/range
 * predicates and on the cursor (startAfter) for pagination. Free-text `search`
 * is applied client-side over the returned page (it cannot be expressed as a
 * Firestore predicate); operators rely on the structured filters for narrowing.
 *
 * Cursor encoding: `<atIso>|<docId>` of the last returned doc. We re-derive the
 * startAfter snapshot by reading that doc. Opaque to callers.
 */
export class FirestoreAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Firestore) {}

  async listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage> {
    const constraints: QueryConstraint[] = []
    if (query.entityType !== 'all') constraints.push(where('entityType', '==', query.entityType))
    if (query.action !== 'all') constraints.push(where('action', '==', query.action))
    if (query.actorUid !== 'all') constraints.push(where('actorUid', '==', query.actorUid))
    if (query.fromDate != null) constraints.push(where('at', '>=', query.fromDate))
    if (query.toDate != null) constraints.push(where('at', '<=', query.toDate))
    constraints.push(orderBy('at', 'desc'))

    // Cursor: read the anchor doc and startAfter it.
    if (cursor != null) {
      const sepIdx = cursor.lastIndexOf('|')
      const anchorId = sepIdx >= 0 ? cursor.slice(sepIdx + 1) : cursor
      const anchorSnap = await getDoc(doc(this.db, 'audit_logs', anchorId))
      if (anchorSnap.exists()) constraints.push(startAfter(anchorSnap))
    }

    // Over-fetch by 1 to detect whether a next page exists.
    constraints.push(limit(query.pageSize + 1))

    const snap = await getDocs(fsQuery(collection(this.db, 'audit_logs'), ...constraints))
    let docs: QueryDocumentSnapshot[] = snap.docs
    const hasMore = docs.length > query.pageSize
    if (hasMore) docs = docs.slice(0, query.pageSize)

    let rows = docs.map(d => toAuditLog(d.id, d.data() as Record<string, unknown>))

    // Client-side free-text narrowing over the page (entityId + actorUid).
    const s = query.search.trim().toLowerCase()
    if (s !== '') {
      rows = rows.filter(r =>
        r.entityId.toLowerCase().includes(s) || r.actorUid.toLowerCase().includes(s))
    }

    const last = docs[docs.length - 1]
    const nextCursor: AuditCursor | null =
      hasMore && last ? `${toIso((last.data() as Record<string, unknown>).at)}|${last.id}` : null

    return { rows, nextCursor }
  }

  async loadReferenceData(): Promise<AuditLogReferenceData> {
    // Distinct actors: read a bounded recent window and dedupe by uid, resolving
    // display names from /users where readable. This is best-effort: the filter
    // dropdown is a convenience, not an exhaustive index.
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
}
```

- [ ] **Step 2: Add the firestore export to the barrel**

Modify `src/infra/repositories/index.ts` — ensure both lines are present (inMemory added in Task 2):

```typescript
export * from './inMemoryAuditLogRepository'
export * from './firestoreAuditLogRepository'
```

- [ ] **Step 3: Add composite indexes**

Modify `firestore.indexes.json` — append these objects to the `indexes` array (the single-field `entityType` / `action` / `actorUid` + `at` combos, plus the broadest filter combos used by the UI). Add inside the existing `"indexes": [ ... ]` array, before the closing `]`:

```json
,
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "entityType", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "action", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "actorUid", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "entityType", "order": "ASCENDING" },
      { "fieldPath": "action", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "entityType", "order": "ASCENDING" },
      { "fieldPath": "actorUid", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "action", "order": "ASCENDING" },
      { "fieldPath": "actorUid", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "audit_logs", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "entityType", "order": "ASCENDING" },
      { "fieldPath": "action", "order": "ASCENDING" },
      { "fieldPath": "actorUid", "order": "ASCENDING" },
      { "fieldPath": "at", "order": "DESCENDING" }
    ]}
```

NOTE: the existing `entityId + at DESC` audit_logs index stays (used by per-entity asset history). Validate the JSON parses (no trailing comma errors).

- [ ] **Step 4: Validate JSON + typecheck + build**

Run: `cd C:/Users/DELL/Desktop/assets-crm && node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('json ok')" && npm run typecheck`
Expected: `json ok` then typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infra/repositories/firestoreAuditLogRepository.ts src/infra/repositories/index.ts firestore.indexes.json
git commit -m "feat(audit): FirestoreAuditLogRepository read adapter + composite indexes"
```

**Non-goals:** No write methods. No emulator run (Java unavailable). Date range + equality filters cannot be combined arbitrarily in one Firestore query beyond the composite indexes provided; the range on `at` plus equality filters is covered by the indexes above.

---

## Task 4: useAuditLogs hook (react-ui-engineer)

**Files:**
- Create: `src/hooks/useAuditLogs.ts`
- Modify: `src/hooks/index.ts`

- [ ] **Step 1: Write the hook**

`src/hooks/useAuditLogs.ts`:

```typescript
import { useEffect, useState, useCallback, useRef } from 'react'
import type {
  AuditLog, AuditLogQuery, AuditCursor, AuditLogReferenceData, AuditLogRepository,
} from '@/domain/audit'

export interface UseAuditLogsResult {
  rows: AuditLog[]
  ref: AuditLogReferenceData | null
  loading: boolean
  error: Error | null
  /** True when there is a next page to fetch. */
  hasNext: boolean
  /** True when not on the first page (a prev page exists). */
  hasPrev: boolean
  /** 1-based page number for display. */
  page: number
  next: () => void
  prev: () => void
  reload: () => void
}

/**
 * Cursor-paginated audit fetch. Maintains a stack of cursors so prev() can walk
 * back. The query is serialised so changing any filter resets to page 1.
 *
 * @param repository MUST be a stable reference (useMemo / singleton).
 */
export function useAuditLogs(
  repository: AuditLogRepository,
  query: AuditLogQuery,
): UseAuditLogsResult {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [ref, setRef] = useState<AuditLogReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  // Cursor stack: cursorStack[i] is the cursor used to fetch page i+1.
  // Page 1 uses null. We store the NEXT cursor of each fetched page to advance.
  const [cursorStack, setCursorStack] = useState<(AuditCursor | null)[]>([null])
  const [nextCursor, setNextCursor] = useState<AuditCursor | null>(null)

  const queryKey = JSON.stringify(query)
  const prevQueryKey = useRef(queryKey)

  // Reset pagination when the query changes.
  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey
      setCursorStack([null])
    }
  }, [queryKey])

  const reload = useCallback(() => setTick(t => t + 1), [])

  const currentCursor = cursorStack[cursorStack.length - 1] ?? null

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const [page, refData] = await Promise.all([
          repository.listAuditLogs(query, currentCursor),
          repository.loadReferenceData(),
        ])
        if (!active) return
        setRows(page.rows)
        setNextCursor(page.nextCursor)
        setRef(refData)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, queryKey, currentCursor, tick])

  const next = useCallback(() => {
    if (nextCursor != null) setCursorStack(s => [...s, nextCursor])
  }, [nextCursor])

  const prev = useCallback(() => {
    setCursorStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  return {
    rows, ref, loading, error,
    hasNext: nextCursor != null,
    hasPrev: cursorStack.length > 1,
    page: cursorStack.length,
    next, prev, reload,
  }
}
```

- [ ] **Step 2: Export from barrel**

Modify `src/hooks/index.ts` — append:

```typescript
export * from './useAuditLogs'
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck`
Expected: PASS.

```bash
git add src/hooks/useAuditLogs.ts src/hooks/index.ts
git commit -m "feat(audit): useAuditLogs cursor-pagination hook"
```

**Non-goals:** No UI. No direct Firebase import (consumes the port).

---

## Task 5: auditFormat pure helpers + tests (react-ui-engineer)

**Files:**
- Create: `src/components/features/audit/auditFormat.ts`
- Create: `src/components/features/audit/auditFormat.test.ts`
- Create: `src/components/features/audit/index.ts`

- [ ] **Step 1: Write the failing test**

`src/components/features/audit/auditFormat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatAuditTs, resolveActorName, computeDiff, entityLink } from './auditFormat'
import type { AuditLog } from '@/domain/audit'

describe('formatAuditTs', () => {
  it('formats as DD/Mon/YYYY HH:MM', () => {
    const out = formatAuditTs('2026-06-04T09:05:00.000Z')
    // Locale-stable assertion: contains a 2-digit day, a 3-letter month, the year.
    expect(out).toMatch(/\d{2}\/[A-Za-zА-Яа-я]{3}\/2026/)
    expect(out).toMatch(/\d{2}:\d{2}/)
  })
  it('returns the raw string on parse failure', () => {
    expect(formatAuditTs('not-a-date')).toBe('not-a-date')
  })
})

describe('resolveActorName', () => {
  const actors = [{ uid: 'u_1', displayName: 'Khach' }, { uid: 'u_2', displayName: null }]
  it('returns display name when known', () => {
    expect(resolveActorName('u_1', actors)).toBe('Khach')
  })
  it('falls back to uid when no display name', () => {
    expect(resolveActorName('u_2', actors)).toBe('u_2')
    expect(resolveActorName('u_unknown', actors)).toBe('u_unknown')
  })
})

describe('computeDiff', () => {
  it('lists added, removed, and changed keys', () => {
    const before = { statusId: 'st_warehouse', brand: 'Dell' }
    const after = { statusId: 'st_assigned', model: 'XPS' }
    const diff = computeDiff(before, after)
    const byKey = Object.fromEntries(diff.map(d => [d.key, d]))
    expect(byKey['statusId']).toEqual({ key: 'statusId', before: 'st_warehouse', after: 'st_assigned', kind: 'changed' })
    expect(byKey['brand']).toEqual({ key: 'brand', before: 'Dell', after: undefined, kind: 'removed' })
    expect(byKey['model']).toEqual({ key: 'model', before: undefined, after: 'XPS', kind: 'added' })
  })
  it('handles null before (create) and null after (delete)', () => {
    expect(computeDiff(null, { a: 1 }).map(d => d.kind)).toEqual(['added'])
    expect(computeDiff({ a: 1 }, null).map(d => d.kind)).toEqual(['removed'])
    expect(computeDiff(null, null)).toEqual([])
  })
  it('stringifies nested object values stably', () => {
    const diff = computeDiff({ assignment: null }, { assignment: { mode: 'employee', employeeId: 'e1' } })
    expect(diff[0]!.kind).toBe('changed')
    expect(typeof diff[0]!.after).toBe('string')
    expect(diff[0]!.after).toContain('employee')
  })
})

describe('entityLink', () => {
  it('links asset entities to /assets/:id', () => {
    const log = { entityType: 'asset', entityId: 'a_1' } as AuditLog
    expect(entityLink(log)).toBe('/assets/a_1')
  })
  it('links employee entities to /employees/:id', () => {
    const log = { entityType: 'employee', entityId: 'e_1' } as AuditLog
    expect(entityLink(log)).toBe('/employees/e_1')
  })
  it('returns null for entity types without a detail page', () => {
    const log = { entityType: 'category', entityId: 'c_1' } as AuditLog
    expect(entityLink(log)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/audit/auditFormat.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the helpers**

`src/components/features/audit/auditFormat.ts`:

```typescript
import type { AuditLog, ActorRef } from '@/domain/audit'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** DD/Mon/YYYY HH:MM — the AMS-standard timestamp format. Returns the raw input on parse failure. */
export function formatAuditTs(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = MONTHS[d.getMonth()] ?? '???'
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mon}/${yyyy} ${hh}:${mm}`
}

/** Best-effort actor name; falls back to the uid when no display name is known. */
export function resolveActorName(uid: string, actors: ActorRef[]): string {
  const found = actors.find(a => a.uid === uid)
  return found?.displayName ?? uid
}

export type DiffKind = 'added' | 'removed' | 'changed'
export interface DiffRow {
  key: string
  before: string | undefined
  after: string | undefined
  kind: DiffKind
}

function stringify(v: unknown): string | undefined {
  if (v === undefined) return undefined
  if (v === null) return 'null'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

/**
 * Key-by-key diff of two snapshot maps. Values are stringified for display.
 * Display-as-is: any masked secret stays masked (masking happens at write time).
 */
export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffRow[] {
  const keys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])).sort()

  const rows: DiffRow[] = []
  for (const key of keys) {
    const hasB = before != null && key in before
    const hasA = after != null && key in after
    const b = hasB ? stringify(before![key]) : undefined
    const a = hasA ? stringify(after![key]) : undefined
    if (hasB && hasA) {
      if (b !== a) rows.push({ key, before: b, after: a, kind: 'changed' })
    } else if (hasA) {
      rows.push({ key, before: undefined, after: a, kind: 'added' })
    } else {
      rows.push({ key, before: b, after: undefined, kind: 'removed' })
    }
  }
  return rows
}

/** Detail-page link for an entity, or null when no detail page exists. */
export function entityLink(log: Pick<AuditLog, 'entityType' | 'entityId'>): string | null {
  switch (log.entityType) {
    case 'asset': return `/assets/${log.entityId}`
    case 'employee': return `/employees/${log.entityId}`
    case 'user': return `/employees/${log.entityId}` // users share the employee uid space
    // assignment / upgrade / license entities have no standalone detail route;
    // branch / department / category / asset_status are catalog rows without :id routes.
    default: return null
  }
}
```

- [ ] **Step 4: Write the barrel**

`src/components/features/audit/index.ts`:

```typescript
export * from './auditFormat'
export * from './AuditFilterBar'
export * from './AuditTable'
export * from './AuditDiff'
```

(Note: AuditFilterBar/AuditTable/AuditDiff land in Tasks 6-7. To keep typecheck green at THIS commit, export only `./auditFormat` now and add the rest in their tasks.)

```typescript
export * from './auditFormat'
```

- [ ] **Step 5: Run test + typecheck + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/audit/auditFormat.test.ts && npm run typecheck`
Expected: PASS.

```bash
git add src/components/features/audit/auditFormat.ts src/components/features/audit/auditFormat.test.ts src/components/features/audit/index.ts
git commit -m "feat(audit): auditFormat pure helpers (ts/name/diff/link) + tests"
```

**Non-goals:** No unmask logic. No React components yet.

---

## Task 6: AuditDiff + AuditFilterBar components (react-ui-engineer)

**Files:**
- Create: `src/components/features/audit/AuditDiff.tsx`
- Create: `src/components/features/audit/AuditFilterBar.tsx`
- Modify: `src/components/features/audit/index.ts`

- [ ] **Step 1: Write AuditDiff**

`src/components/features/audit/AuditDiff.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { computeDiff } from './auditFormat'
import type { AuditLog } from '@/domain/audit'

export interface AuditDiffProps {
  log: AuditLog
}

/**
 * Renders a key-by-key before/after diff of an audit entry. Values are shown
 * AS-IS (masked secrets stay masked — masking happens at write time). There is
 * deliberately no reveal affordance.
 */
export function AuditDiff({ log }: AuditDiffProps) {
  const { t } = useTranslation('audit')
  const rows = computeDiff(log.before, log.after)

  return (
    <div className="bg-[#111315] border border-[#2A2F36] rounded-lg p-3 space-y-2">
      {log.comment && (
        <p className="text-[12px] text-[#94A3B8]">
          <span className="text-[#64748B]">{t('diff.comment')}: </span>{log.comment}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-[12px] text-[#64748B]">{t('diff.noChanges')}</p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[#64748B] text-left">
              <th className="font-medium pb-1 pr-3">{t('diff.field')}</th>
              <th className="font-medium pb-1 pr-3">{t('diff.before')}</th>
              <th className="font-medium pb-1">{t('diff.after')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="align-top border-t border-[#2A2F36]">
                <td className="py-1 pr-3 font-mono text-[#94A3B8] whitespace-nowrap">{r.key}</td>
                <td className="py-1 pr-3 font-mono text-[#F87171] break-all">{r.before ?? '—'}</td>
                <td className="py-1 font-mono text-[#34D399] break-all">{r.after ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write AuditFilterBar**

`src/components/features/audit/AuditFilterBar.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Select, Icon, Btn } from '@/components/ui'
import type { SelectOption } from '@/components/ui/select'
import type { AuditLogQuery, AuditLogReferenceData } from '@/domain/audit'
import { AUDIT_ACTIONS } from '@/domain/audit'

const ENTITY_TYPES = [
  'asset', 'assignment', 'upgrade', 'license', 'employee', 'user',
  'branch', 'department', 'category', 'asset_status',
] as const

export interface AuditFilterBarProps {
  query: AuditLogQuery
  onChange: (patch: Partial<AuditLogQuery>) => void
  ref: AuditLogReferenceData
}

function isDirty(q: AuditLogQuery): boolean {
  return q.entityType !== 'all' || q.action !== 'all' || q.actorUid !== 'all'
    || q.fromDate != null || q.toDate != null || q.search.trim() !== ''
}

export function AuditFilterBar({ query, onChange, ref: refData }: AuditFilterBarProps) {
  const { t } = useTranslation('audit')

  const entityOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allEntities') },
    ...ENTITY_TYPES.map(e => ({ value: e, label: t(`entity.${e}`) })),
  ]
  const actionOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allActions') },
    ...AUDIT_ACTIONS.map(a => ({ value: a, label: t(`action.${a}`) })),
  ]
  const actorOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allActors') },
    ...refData.actors.map(a => ({ value: a.uid, label: a.displayName ?? a.uid })),
  ]

  // <input type="date"> uses YYYY-MM-DD; convert to/from ISO bounds.
  const fromDateInput = query.fromDate ? query.fromDate.slice(0, 10) : ''
  const toDateInput = query.toDate ? query.toDate.slice(0, 10) : ''

  const dirty = isDirty(query)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
            <Icon name="search" size={13} />
          </span>
          <input
            type="search"
            value={query.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full h-9 pl-8 pr-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
          />
        </div>
        <div className="w-44">
          <Select value={query.entityType} onChange={v => onChange({ entityType: v as AuditLogQuery['entityType'] })} options={entityOptions} />
        </div>
        <div className="w-44">
          <Select value={query.action} onChange={v => onChange({ action: v as AuditLogQuery['action'] })} options={actionOptions} />
        </div>
        <div className="w-44">
          <Select value={query.actorUid} onChange={v => onChange({ actorUid: v })} options={actorOptions} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
          {t('filters.from')}
          <input
            type="date"
            value={fromDateInput}
            onChange={e => onChange({ fromDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })}
            aria-label={t('filters.from')}
            className="h-9 px-2 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#F97316] transition-all duration-150"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
          {t('filters.to')}
          <input
            type="date"
            value={toDateInput}
            onChange={e => onChange({ toDate: e.target.value ? `${e.target.value}T23:59:59.999Z` : null })}
            aria-label={t('filters.to')}
            className="h-9 px-2 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#F97316] transition-all duration-150"
          />
        </label>
        {dirty && (
          <Btn variant="ghost" size="sm" onClick={() => onChange({
            entityType: 'all', action: 'all', actorUid: 'all', fromDate: null, toDate: null, search: '',
          })}>
            <Icon name="x" size={13} />
            {t('filters.reset')}
          </Btn>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update barrel**

`src/components/features/audit/index.ts`:

```typescript
export * from './auditFormat'
export * from './AuditDiff'
export * from './AuditFilterBar'
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck`
Expected: PASS.

```bash
git add src/components/features/audit/AuditDiff.tsx src/components/features/audit/AuditFilterBar.tsx src/components/features/audit/index.ts
git commit -m "feat(audit): AuditDiff + AuditFilterBar components"
```

**Non-goals:** No table yet. No reveal affordance in the diff.

---

## Task 7: AuditTable component (react-ui-engineer)

**Files:**
- Create: `src/components/features/audit/AuditTable.tsx`
- Modify: `src/components/features/audit/index.ts`

- [ ] **Step 1: Write AuditTable**

`src/components/features/audit/AuditTable.tsx`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Chip } from '@/components/ui'
import { AuditDiff } from './AuditDiff'
import { formatAuditTs, resolveActorName, entityLink } from './auditFormat'
import type { AuditLog, AuditLogReferenceData } from '@/domain/audit'

export interface AuditTableProps {
  rows: AuditLog[]
  ref: AuditLogReferenceData
}

export function AuditTable({ rows, ref: refData }: AuditTableProps) {
  const { t } = useTranslation('audit')
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[#64748B] border-b border-[#2A2F36]">
            <th className="font-semibold py-2 pr-3 w-8"></th>
            <th className="font-semibold py-2 pr-3 whitespace-nowrap">{t('col.time')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.actor')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.role')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.entity')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.action')}</th>
            <th className="font-semibold py-2">{t('col.entityId')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(log => {
            const isOpen = expanded === log.id
            const link = entityLink(log)
            return (
              <>
                <tr
                  key={log.id}
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="text-[12.5px] border-b border-[#2A2F36] hover:bg-[#1A1D21] cursor-pointer transition-colors duration-100"
                >
                  <td className="py-2 pr-3 text-[#64748B]">
                    <Icon name="chevron-right" size={13} className={isOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                  </td>
                  <td className="py-2 pr-3 text-[#94A3B8] whitespace-nowrap font-mono text-[12px]">{formatAuditTs(log.at)}</td>
                  <td className="py-2 pr-3 text-[#F8FAFC]">{resolveActorName(log.actorUid, refData.actors)}</td>
                  <td className="py-2 pr-3 text-[#94A3B8]">{t(`role.${log.actorRole}`, { defaultValue: log.actorRole })}</td>
                  <td className="py-2 pr-3"><Chip>{t(`entity.${log.entityType}`, { defaultValue: log.entityType })}</Chip></td>
                  <td className="py-2 pr-3 text-[#94A3B8]">{t(`action.${log.action}`, { defaultValue: log.action })}</td>
                  <td className="py-2 font-mono text-[12px]">
                    {link ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); navigate(link) }}
                        className="text-[#FB923C] hover:underline"
                      >
                        {log.entityId}
                      </button>
                    ) : (
                      <span className="text-[#64748B]">{log.entityId}</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${log.id}-diff`} className="border-b border-[#2A2F36] bg-[#15181C]">
                    <td colSpan={7} className="py-2 px-3">
                      <AuditDiff log={log} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

NOTE on keys: the Fragment-less `<>...</>` returns two sibling rows. React needs a stable key on the outermost element of the map. Wrap each pair in `<Fragment key={log.id}>` to satisfy the linter. Import `Fragment` from 'react' and use it:

```tsx
import { Fragment, useState } from 'react'
// ...
{rows.map(log => {
  // ...
  return (
    <Fragment key={log.id}>
      <tr onClick={...}> ... </tr>
      {isOpen && <tr> ... </tr>}
    </Fragment>
  )
})}
```

(Remove the inner `key` props on the two `<tr>` when using the Fragment key.)

VERIFY: `Chip` is exported from `@/components/ui` (confirmed: `src/components/ui/chip.tsx` + `index.ts`). If `Chip` requires a specific prop API, fall back to a styled `<span>` matching the chip visual: `inline-flex items-center h-6 px-2 rounded-md text-[11px] bg-[#22272E] text-[#94A3B8] border border-[#2A2F36]`.

- [ ] **Step 2: Update barrel**

`src/components/features/audit/index.ts`:

```typescript
export * from './auditFormat'
export * from './AuditDiff'
export * from './AuditFilterBar'
export * from './AuditTable'
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck`
Expected: PASS.

```bash
git add src/components/features/audit/AuditTable.tsx src/components/features/audit/index.ts
git commit -m "feat(audit): AuditTable with expandable diff rows"
```

**Non-goals:** No page composition. No pagination controls here (the page owns them).

---

## Task 8: AuditPage + routing (react-ui-engineer)

**Files:**
- Create: `src/pages/AuditPage.tsx`
- Modify: `src/pages/index.ts`
- Modify: `src/config/routes.tsx`
- Modify: `src/config/nav.ts`

- [ ] **Step 1: Write AuditPage**

`src/pages/AuditPage.tsx`:

```tsx
import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { AuditFilterBar, AuditTable } from '@/components/features/audit'
import { useAuditLogs } from '@/hooks'
import type { AuditLogQuery } from '@/domain/audit'
import type { AuditLogRepository } from '@/domain/audit'
import { FirestoreAuditLogRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 20

const DEFAULT_QUERY: AuditLogQuery = {
  entityType: 'all', action: 'all', actorUid: 'all',
  fromDate: null, toDate: null, search: '', pageSize: PAGE_SIZE,
}

export interface AuditPageProps {
  repository?: AuditLogRepository
}

export function AuditPage({ repository }: AuditPageProps) {
  const { t } = useTranslation(['audit', 'nav'])

  const defaultRepo = useMemo<AuditLogRepository>(
    () => new FirestoreAuditLogRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [query, setQuery] = useState<AuditLogQuery>({ ...DEFAULT_QUERY })

  const handleQueryChange = useCallback((patch: Partial<AuditLogQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
  }, [])

  const { rows, ref, loading, error, hasNext, hasPrev, page, next, prev, reload } =
    useAuditLogs(repo, query)

  function renderBody() {
    if (loading) return <LoadingState rows={8} />
    if (error) return <ErrorState onRetry={reload} />
    if (rows.length === 0) {
      return (
        <EmptyState
          icon="history"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }
    return (
      <>
        {ref && <AuditTable rows={rows} ref={ref} />}
        <div className="flex items-center justify-between pt-4 border-t border-[#2A2F36] mt-2">
          <span className="text-[12px] text-[#64748B]">{t('pagination.page', { page })}</span>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" size="sm" disabled={!hasPrev} onClick={prev}>
              <Icon name="chevron-right" size={13} className="rotate-180" />
            </Btn>
            <Btn variant="secondary" size="sm" disabled={!hasNext} onClick={next}>
              <Icon name="chevron-right" size={13} />
            </Btn>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="history" title={t('items.audit', { ns: 'nav' })} />
      <SectionCard noHeader>
        <div className="space-y-4">
          {ref && <AuditFilterBar query={query} onChange={handleQueryChange} ref={ref} />}
          {!ref && !error && <div className="h-9 rounded-lg anim-skeleton w-full" />}
          {renderBody()}
        </div>
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 2: Export from pages barrel**

Modify `src/pages/index.ts` — append:

```typescript
export * from './AuditPage'
```

- [ ] **Step 3: Remove 'audit' from PHASE_STUB_ROUTES**

Modify `src/config/nav.ts` — change `PHASE_STUB_ROUTES`:

```typescript
export const PHASE_STUB_ROUTES: RouteId[] = [
  'assignments', 'repairs', 'parts',
  'roles', 'settings',
  'licenses',
]
```

(removed `'audit'`)

- [ ] **Step 4: Wire the route**

Modify `src/config/routes.tsx`:
1. Add `AuditPage` to the import from `@/pages` (the destructured list at top).
2. Add the route inside `<ShellLayout>` (after the `/statuses` route, before the `/my-assets` route):

```tsx
          <Route path="/audit" element={
            <RoleGate roles={routeRoles('audit')}><AuditPage /></RoleGate>
          } />
```

- [ ] **Step 5: Typecheck + build**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AuditPage.tsx src/pages/index.ts src/config/nav.ts src/config/routes.tsx
git commit -m "feat(audit): AuditPage + super_admin-gated /audit route (un-stub)"
```

**Non-goals:** No i18n strings yet (Task 9). Page will render raw keys until locales land — that's fine for this commit; tests come after i18n.

---

## Task 9: i18n locales (i18n-engineer)

**Files:**
- Create: `src/locales/ru/audit.json`
- Create: `src/locales/en/audit.json`
- Create: `src/locales/hy/audit.json`

- [ ] **Step 1: Write ru/audit.json**

`src/locales/ru/audit.json`:

```json
{
  "search": "Поиск по ID объекта или пользователю…",
  "col": {
    "time": "Время", "actor": "Пользователь", "role": "Роль",
    "entity": "Объект", "action": "Действие", "entityId": "ID объекта"
  },
  "entity": {
    "asset": "Актив", "assignment": "Выдача", "upgrade": "Апгрейд", "license": "Лицензия",
    "employee": "Сотрудник", "user": "Пользователь", "branch": "Филиал",
    "department": "Отдел", "category": "Категория", "asset_status": "Статус актива"
  },
  "action": {
    "created": "Создано", "updated": "Обновлено", "status_changed": "Статус изменён",
    "assigned": "Выдано", "returned": "Возвращено", "transferred": "Перемещено",
    "upgrade_added": "Апгрейд добавлен", "disposed": "Списано",
    "sent_to_repair": "Отправлено в ремонт", "repair_completed": "Ремонт завершён",
    "terminated": "Уволен", "reactivated": "Восстановлен",
    "role_assigned": "Роль назначена", "deleted": "Удалено"
  },
  "role": {
    "super_admin": "Супер Админ", "asset_admin": "Админ активов",
    "tech_admin": "Тех. Админ", "employee": "Сотрудник"
  },
  "filters": {
    "allEntities": "Все объекты", "allActions": "Все действия", "allActors": "Все пользователи",
    "from": "С", "to": "По", "reset": "Сбросить"
  },
  "diff": {
    "field": "Поле", "before": "Было", "after": "Стало",
    "comment": "Комментарий", "noChanges": "Нет изменений полей"
  },
  "pagination": { "page": "Страница {{page}}" },
  "empty": {
    "title": "Записей нет",
    "desc": "Записи журнала аудита появятся здесь по мере изменений в системе."
  }
}
```

- [ ] **Step 2: Write en/audit.json**

`src/locales/en/audit.json`:

```json
{
  "search": "Search by entity ID or actor…",
  "col": {
    "time": "Time", "actor": "Actor", "role": "Role",
    "entity": "Entity", "action": "Action", "entityId": "Entity ID"
  },
  "entity": {
    "asset": "Asset", "assignment": "Assignment", "upgrade": "Upgrade", "license": "License",
    "employee": "Employee", "user": "User", "branch": "Branch",
    "department": "Department", "category": "Category", "asset_status": "Asset status"
  },
  "action": {
    "created": "Created", "updated": "Updated", "status_changed": "Status changed",
    "assigned": "Assigned", "returned": "Returned", "transferred": "Transferred",
    "upgrade_added": "Upgrade added", "disposed": "Disposed",
    "sent_to_repair": "Sent to repair", "repair_completed": "Repair completed",
    "terminated": "Terminated", "reactivated": "Reactivated",
    "role_assigned": "Role assigned", "deleted": "Deleted"
  },
  "role": {
    "super_admin": "Super Admin", "asset_admin": "Asset Admin",
    "tech_admin": "Tech Admin", "employee": "Employee"
  },
  "filters": {
    "allEntities": "All entities", "allActions": "All actions", "allActors": "All actors",
    "from": "From", "to": "To", "reset": "Reset"
  },
  "diff": {
    "field": "Field", "before": "Before", "after": "After",
    "comment": "Comment", "noChanges": "No field changes"
  },
  "pagination": { "page": "Page {{page}}" },
  "empty": {
    "title": "No entries",
    "desc": "Audit log entries will appear here as changes are made in the system."
  }
}
```

- [ ] **Step 3: Write hy/audit.json**

`src/locales/hy/audit.json`:

```json
{
  "search": "Որոնել ըստ օբյեկտի ID-ի կամ օգտատիրոջ…",
  "col": {
    "time": "Ժամ", "actor": "Օգտատեր", "role": "Դեր",
    "entity": "Օբյեկտ", "action": "Գործողություն", "entityId": "Օբյեկտի ID"
  },
  "entity": {
    "asset": "Ակտիվ", "assignment": "Հանձնում", "upgrade": "Արդիականացում", "license": "Լիցենզիա",
    "employee": "Աշխատակից", "user": "Օգտատեր", "branch": "Մասնաճյուղ",
    "department": "Բաժին", "category": "Կատեգորիա", "asset_status": "Ակտիվի կարգավիճակ"
  },
  "action": {
    "created": "Ստեղծված", "updated": "Թարմացված", "status_changed": "Կարգավիճակը փոխված",
    "assigned": "Հանձնված", "returned": "Վերադարձված", "transferred": "Տեղափոխված",
    "upgrade_added": "Արդիականացում ավելացված", "disposed": "Դուրս գրված",
    "sent_to_repair": "Ուղարկված նորոգման", "repair_completed": "Նորոգումն ավարտված",
    "terminated": "Աշխատանքից ազատված", "reactivated": "Վերականգնված",
    "role_assigned": "Դեր նշանակված", "deleted": "Ջնջված"
  },
  "role": {
    "super_admin": "Սուպեր Ադմին", "asset_admin": "Ակտիվների Ադմին",
    "tech_admin": "Տեխ. Ադմին", "employee": "Աշխատակից"
  },
  "filters": {
    "allEntities": "Բոլոր օբյեկտները", "allActions": "Բոլոր գործողությունները", "allActors": "Բոլոր օգտատերերը",
    "from": "Սկսած", "to": "Մինչև", "reset": "Զրոյացնել"
  },
  "diff": {
    "field": "Դաշտ", "before": "Նախկինում", "after": "Հետո",
    "comment": "Մեկնաբանություն", "noChanges": "Դաշտերի փոփոխություններ չկան"
  },
  "pagination": { "page": "Էջ {{page}}" },
  "empty": {
    "title": "Գրառումներ չկան",
    "desc": "Աուդիտի մատյանի գրառումները կհայտնվեն այստեղ համակարգում փոփոխությունների հետ։"
  }
}
```

- [ ] **Step 4: Register the namespace**

Check `src/lib/i18n/index.ts` (or wherever namespaces are registered). If namespaces are auto-loaded via `import.meta.glob` or an explicit resources map, add `audit` for all three locales following the EXACT pattern used by `assets.json`. If resources are listed explicitly, add:

```typescript
// ru resources object:  audit: ruAudit,
// en resources object:  audit: enAudit,
// hy resources object:  audit: hyAudit,
```

with matching `import ruAudit from '@/locales/ru/audit.json'` etc. VERIFY how `assets` is wired and mirror it exactly. If a `ns: [...]` allowlist exists in the init config, add `'audit'` to it.

- [ ] **Step 5: Typecheck + build + commit**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck && npm run build`
Expected: both PASS.

```bash
git add src/locales/ru/audit.json src/locales/en/audit.json src/locales/hy/audit.json src/lib/i18n/
git commit -m "feat(audit): ru/en/hy locale namespace for audit viewer"
```

**Non-goals:** No new nav key (items.audit already exists in all three). Verify it renders.

---

## Task 10: Page component test + rules test (test-engineer)

**Files:**
- Create: `src/pages/AuditPage.test.tsx`
- Modify: the existing firestore rules test file (locate via glob; append an audit_logs read-scoping describe).

- [ ] **Step 1: Write AuditPage component test**

`src/pages/AuditPage.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuditPage } from './AuditPage'
import { InMemoryAuditLogRepository } from '@/infra/repositories'
import type { AuditLog } from '@/domain/audit'

function log(over: Partial<AuditLog>): AuditLog {
  return {
    id: over.id ?? 'al_x', entityType: over.entityType ?? 'asset',
    entityId: over.entityId ?? 'a_1', action: over.action ?? 'created',
    actorUid: over.actorUid ?? 'u_1', actorRole: over.actorRole ?? 'super_admin',
    before: over.before ?? null, after: over.after ?? null,
    comment: over.comment ?? null, at: over.at ?? '2026-06-01T10:00:00.000Z',
  }
}

const seed: AuditLog[] = [
  log({ id: 'al_1', entityType: 'asset', action: 'created', actorUid: 'u_1', at: '2026-06-01T10:00:00.000Z', after: { brand: 'Dell', statusId: 'st_warehouse' } }),
  log({ id: 'al_2', entityType: 'employee', action: 'updated', actorUid: 'u_2', at: '2026-06-02T10:00:00.000Z', before: { status: 'active' }, after: { status: 'terminated' } }),
]

function renderPage(logs = seed, names: Record<string, string> = { u_1: 'Khach', u_2: 'Anna' }) {
  const repo = new InMemoryAuditLogRepository(logs, names)
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuditPage repository={repo} />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('AuditPage', () => {
  it('renders audit rows newest-first', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())
    const rows = screen.getAllByRole('row')
    // header + 2 data rows (diff rows hidden until expanded)
    expect(rows.length).toBeGreaterThanOrEqual(3)
  })

  it('expands a row to show before/after diff', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Khach')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Anna'))
    await waitFor(() => {
      // diff shows changed status value
      expect(screen.getByText(/terminated/)).toBeInTheDocument()
    })
  })

  it('shows empty state when no entries', async () => {
    renderPage([])
    await waitFor(() => expect(screen.getByText(i18n.t('empty.title', { ns: 'audit' }))).toBeInTheDocument())
  })

  it('filters by entity type via the filter bar', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())
    // Both rows present initially
    expect(screen.getByText('Khach')).toBeInTheDocument()
    // Note: Select interaction depends on the Select API; if it's a native <select>,
    // use fireEvent.change on the combobox. Adjust to the actual Select test pattern
    // used in AssetsPage.test.tsx (mirror it exactly).
  })
})
```

VERIFY against `src/pages/AssetsPage.test.tsx`: mirror its exact i18n provider setup, Select-interaction helper, and `waitFor` idioms. If `AssetsPage.test.tsx` imports a test-utils render wrapper, use the same. Adjust the filter test's Select interaction to match.

- [ ] **Step 2: Run the page test**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/pages/AuditPage.test.tsx`
Expected: PASS.

- [ ] **Step 3: Author the rules test (CI-only)**

Locate the rules test: `cd C:/Users/DELL/Desktop/assets-crm && ls src/**/*rules*.test.* firestore*.test.* tests/**/*rules* 2>/dev/null` (or glob `**/*rules*.test.ts`). Append a describe block asserting:
- super_admin can read audit_logs (any entry).
- asset_admin and tech_admin can read audit_logs (rules grant isAnyAdmin()).
- a plain employee CANNOT read an audit_logs entry whose `entityType != 'assignment'` or whose `after.assignedToEmployeeId != their uid`.
- an employee CAN read an `entityType == 'assignment'` entry where `after.assignedToEmployeeId == their uid`.
- NO ONE (including super_admin) can update or delete an audit_logs entry.

Mirror the EXACT harness setup (initializeTestEnvironment, assertSucceeds/assertFails) from the existing rules test. Do NOT run it (Java/emulator unavailable locally); it is authored for CI.

- [ ] **Step 4: Run full suite + typecheck + build**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck && npx vitest run && npm run build`
Expected: typecheck PASS; all tests PASS (≥ 274 + new); build PASS. Capture the test count.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AuditPage.test.tsx <rules-test-file>
git commit -m "test(audit): AuditPage component tests + audit_logs read-scoping rules tests"
```

**Non-goals:** No emulator execution locally.

---

## Self-Review checklist (run before dispatch handoff)

**Spec coverage:**
- Read port (no writes) ✓ Task 1. InMemory + Firestore adapters ✓ Tasks 2-3. Query filters (entityType/action/actor/date-range) ✓ port + both adapters. Sort by `at` desc ✓. Cursor pagination ✓ port + adapters + hook. Composite indexes ✓ Task 3. Viewer page (super_admin route) ✓ Task 8 (route already gated to super_admin via access.ts). Dense table with timestamp DD/Mon/YYYY, actor→name, role, entityType, action, entity id/link, before/after diff ✓ Tasks 5-8. Filters + search + pagination + empty/loading/error ✓ Task 8. i18n ru/en/hy ✓ Task 9. Entity links ✓ Task 5/7. Masked display-as-is ✓ (no unmask anywhere). Read auth: super_admin-only route confirmed; deferred decision noted. No rules change to write/immutability ✓.

**Placeholder scan:** All code blocks complete. Rules-test step references "mirror the existing harness" — acceptable because it's test-engineer's job to match the existing file, and the assertions are enumerated.

**Type consistency:** `AuditLogQuery` fields (entityType/action/actorUid/fromDate/toDate/search/pageSize) consistent across port, adapters, hook, filter bar, page. `AuditCursor` opaque string consistent. `AuditLogPage { rows, nextCursor }` consistent. `ActorRef { uid, displayName }` consistent. `computeDiff` / `formatAuditTs` / `resolveActorName` / `entityLink` signatures consistent between Task 5 definition and Task 6/7 usage.

---

## Deferred decisions (owner)

1. **Scoped admin viewer:** Should `asset_admin` / `tech_admin` get a (read-scoped) audit view? Rules already permit them to READ audit_logs; only the route gate blocks them. Building a scoped view is out of scope here — flagged, not built.
2. **Actor reference exhaustiveness:** `loadReferenceData` reads a bounded recent window (500) for the actor dropdown. If the org needs the full historical actor list in the filter, a denormalised `/audit_actors` index would be the follow-up.
3. **Server-side free-text search:** `search` narrows client-side over the fetched page only. Full-collection text search would need an external index (Algolia/Typesense) — Phase 2+.
4. **Date-range + equality filter matrix:** Firestore allows the provided composite combos; very exotic filter+range mixes may prompt a console "create index" link in production — monitor after first deploy.
