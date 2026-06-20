# Settings — `/settings/auth` OAuth-domain editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Super-Admin Settings page whose Authentication panel edits the `/settings/auth.allowedEmailDomains` list that the `beforeCreate` Cloud Function reads to allow/deny every sign-up, with audited writes, fail-closed safety, and ru/en/hy i18n.

**Architecture:** Ports-and-adapters mirroring `CategoryRepository`: a `src/domain/settings/` port + pure validation helpers, an InMemory adapter (tests) and a Firestore adapter (prod) whose write goes through the `withAudit` chokepoint with a `{ merge: true }` set so untouched fields are preserved. A super-admin-gated `SettingsPage` replaces the current StubPage; one `AuthSettingsPanel` edits the domain list with dirty-gating, inline validation, a fail-closed banner, and an escalated danger-confirm on empty-list saves. Rules add an explicit `/settings/auth` block.

**Tech Stack:** React 19 + Vite + TypeScript (strict), Firebase modular SDK v9+, i18next (ru/en/hy), Vitest + Testing Library, `@firebase/rules-unit-testing`.

**Enforcement-point invariant:** `functions/src/auth/beforeCreate.ts` reads ONLY `allowedEmailDomains` (a `string[]`). The editor MUST write that exact field/type. `emailLinkActionUrl`/`googleClientId` are preserved by merge-write but NOT edited (the function ignores them).

---

## Dispatch order (orchestrator)
1. **Task 1–2 → domain-modeler** (domain types, validation, port; audit entity type)
2. **Task 3 → firebase-engineer** (InMemory + Firestore adapters)
3. **Task 4 → firebase-engineer** (firestore.rules + rules tests)
4. **Task 5–6 → react-ui-engineer** (page + panel + route un-stub)
5. **Task 7 → i18n-engineer** (settings namespace ru/en/hy)
6. **Task 8 → test-engineer** (shape-tie test) — and test-engineer runs after EVERY task.

---

### Task 1: Domain types + validation helpers (pure, no Firebase)

**Files:**
- Create: `src/domain/settings/types.ts`
- Create: `src/domain/settings/validation.ts`
- Test: `src/domain/settings/validation.test.ts`

- [ ] **Step 1: Write `src/domain/settings/types.ts`**

```ts
/** Shape of the /settings/auth Firestore doc, normalized for app use.
 *  allowedEmailDomains is the ONLY field beforeCreate reads. The other fields
 *  are preserved across writes (merge) but not edited by the UI. */
export interface AuthSettings {
  allowedEmailDomains: string[]
  emailLinkActionUrl?: string
  googleClientId?: string
  updatedAt?: string
  updatedBy?: string
}
```

- [ ] **Step 2: Write the failing test `validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeDomain, isValidDomain, dedupeDomains } from './validation'

describe('normalizeDomain', () => {
  it('lowercases, trims, strips @ / scheme / www / path', () => {
    expect(normalizeDomain('  @Example.COM ')).toBe('example.com')
    expect(normalizeDomain('https://www.Foo.io/login')).toBe('foo.io')
    expect(normalizeDomain('Sub.Bar.co.uk')).toBe('sub.bar.co.uk')
  })
})

describe('isValidDomain', () => {
  it('accepts real domains', () => {
    expect(isValidDomain('example.com')).toBe(true)
    expect(isValidDomain('sub.bar.co.uk')).toBe(true)
  })
  it('rejects junk', () => {
    for (const bad of ['', '   ', 'nope', 'a@b.com', 'foo .com', 'foo..com', '.com', 'foo.', 'http://x']) {
      expect(isValidDomain(bad)).toBe(false)
    }
  })
})

describe('dedupeDomains', () => {
  it('case-insensitive de-dupe, stable order', () => {
    expect(dedupeDomains(['a.com', 'A.com', 'b.com', 'a.com'])).toEqual(['a.com', 'b.com'])
  })
})
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run src/domain/settings/validation.test.ts`) — "normalizeDomain is not a function".

- [ ] **Step 4: Write `src/domain/settings/validation.ts`**

```ts
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/

/** Reduce arbitrary user text to a bare lowercase host. */
export function normalizeDomain(input: string): string {
  let s = (input ?? '').trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/^@/, '')
  s = s.replace(/^www\./, '')
  s = s.split(/[/?#]/)[0] ?? s   // drop any path/query/hash
  return s
}

/** Conservative domain check on an ALREADY-normalized host. */
export function isValidDomain(input: string): boolean {
  const s = normalizeDomain(input)
  if (!s) return false
  return DOMAIN_RE.test(s)
}

/** Case-insensitive de-dupe (input assumed normalized), stable first-seen order. */
export function dedupeDomains(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of list) {
    const key = d.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}
```

- [ ] **Step 5: Run — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add src/domain/settings/types.ts src/domain/settings/validation.ts src/domain/settings/validation.test.ts
git commit -m "feat(settings): auth-settings domain types + domain validation helpers"
```

---

### Task 2: Repository port + audit entity type + barrel

**Files:**
- Create: `src/domain/settings/AuthSettingsRepository.ts`
- Create: `src/domain/settings/index.ts`
- Modify: `src/domain/audit/types.ts` (add `'settings'` to `AuditEntityType`)

- [ ] **Step 1: Write `AuthSettingsRepository.ts`**

```ts
import type { AuthSettings } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface AuthSettingsRepository {
  /** Returns a normalized doc. MISSING doc → fail-closed default { allowedEmailDomains: [] }. */
  getAuthSettings(): Promise<AuthSettings>
  /** Writes a normalized+deduped domain list via withAudit (one audit row, merge write). */
  updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>>
}
```

- [ ] **Step 2: Write `src/domain/settings/index.ts`**

```ts
export * from './types'
export * from './validation'
export * from './AuthSettingsRepository'
```

- [ ] **Step 3: Modify `src/domain/audit/types.ts:3-5`** — add `'settings'`:

```ts
export type AuditEntityType =
  | 'asset' | 'assignment' | 'upgrade' | 'license' | 'server_license' | 'employee' | 'user'
  | 'branch' | 'department' | 'category' | 'asset_status' | 'settings'
```

- [ ] **Step 4: Typecheck** — `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings/AuthSettingsRepository.ts src/domain/settings/index.ts src/domain/audit/types.ts
git commit -m "feat(settings): AuthSettingsRepository port + 'settings' audit entity type"
```

---

### Task 3: InMemory + Firestore adapters

**Files:**
- Create: `src/infra/repositories/inMemoryAuthSettingsRepository.ts`
- Create: `src/infra/repositories/firestoreAuthSettingsRepository.ts`
- Test: `src/infra/repositories/inMemoryAuthSettingsRepository.test.ts`
- Modify: `src/infra/repositories/index.ts` (export both)

- [ ] **Step 1: Write the failing test `inMemoryAuthSettingsRepository.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryAuthSettingsRepository } from './inMemoryAuthSettingsRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const actor = { uid: 'u_super', role: 'super_admin' as const }

describe('InMemoryAuthSettingsRepository', () => {
  it('get returns fail-closed default when no doc', async () => {
    const repo = new InMemoryAuthSettingsRepository()
    expect((await repo.getAuthSettings()).allowedEmailDomains).toEqual([])
  })

  it('update normalizes + dedupes + writes one audit row', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: [] }, inMemoryAuditContext(store))
    const r = await repo.updateAllowedDomains(['  @A.com', 'a.com', 'B.io'], actor)
    expect(r.value.allowedEmailDomains).toEqual(['a.com', 'b.io'])
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityType: 'settings', action: 'updated' })
  })

  it('merge preserves untouched fields', async () => {
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['x.com'], emailLinkActionUrl: 'https://app/finish' })
    const r = await repo.updateAllowedDomains(['y.com'], actor)
    expect(r.value.emailLinkActionUrl).toBe('https://app/finish')
    expect(r.value.allowedEmailDomains).toEqual(['y.com'])
  })

  it('allows empty list (fail-closed save)', async () => {
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['z.com'] })
    const r = await repo.updateAllowedDomains([], actor)
    expect(r.value.allowedEmailDomains).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/infra/repositories/inMemoryAuthSettingsRepository.test.ts`).

- [ ] **Step 3: Write `inMemoryAuthSettingsRepository.ts`**

```ts
import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

export class InMemoryAuthSettingsRepository implements AuthSettingsRepository {
  private doc: AuthSettings
  constructor(
    initial: AuthSettings = { allowedEmailDomains: [] },
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {
    this.doc = { ...initial, allowedEmailDomains: [...initial.allowedEmailDomains] }
  }

  async getAuthSettings(): Promise<AuthSettings> {
    return { ...this.doc, allowedEmailDomains: [...this.doc.allowedEmailDomains] }
  }

  async updateAllowedDomains(domains: string[], actor: Actor) {
    const before = [...this.doc.allowedEmailDomains]
    const next = dedupeDomains(domains.map(normalizeDomain).filter(Boolean))
    return withAudit(this.audit,
      {
        entityType: 'settings', entityId: 'auth', action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { allowedEmailDomains: before },
        after: { allowedEmailDomains: next },
      },
      async () => {
        this.doc = { ...this.doc, allowedEmailDomains: next, updatedBy: actor.uid, updatedAt: new Date().toISOString() }
        return { value: { ...this.doc, allowedEmailDomains: [...next] } }
      },
    )
  }
}
```

- [ ] **Step 4: Write `firestoreAuthSettingsRepository.ts`**

```ts
import { doc, getDoc, serverTimestamp, type Firestore, type Transaction } from 'firebase/firestore'
import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import { firestoreAuditContext, withAudit } from '@/lib/audit'

function toAuthSettings(d: Record<string, unknown> | undefined): AuthSettings {
  const raw = d?.allowedEmailDomains
  const allowedEmailDomains = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  const out: AuthSettings = { allowedEmailDomains }
  if (typeof d?.emailLinkActionUrl === 'string') out.emailLinkActionUrl = d.emailLinkActionUrl
  if (typeof d?.googleClientId === 'string') out.googleClientId = d.googleClientId
  return out
}

export class FirestoreAuthSettingsRepository implements AuthSettingsRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async getAuthSettings(): Promise<AuthSettings> {
    const snap = await getDoc(doc(this.db, 'settings', 'auth'))
    return toAuthSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
  }

  async updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>> {
    const before = await this.getAuthSettings()
    const next = dedupeDomains(domains.map(normalizeDomain).filter(Boolean))
    const ref = doc(this.db, 'settings', 'auth')
    const r = await withAudit(this.audit,
      {
        entityType: 'settings', entityId: 'auth', action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { allowedEmailDomains: before.allowedEmailDomains },
        after: { allowedEmailDomains: next },
      },
      async (txn) => {
        ;(txn as unknown as Transaction).set(ref,
          { allowedEmailDomains: next, updatedBy: actor.uid, updatedAt: serverTimestamp() },
          { merge: true })
        return { value: undefined as unknown as void }
      },
    )
    const readback = await this.getAuthSettings()
    return { value: readback, auditId: r.auditId }
  }
}
```

- [ ] **Step 5: Modify `src/infra/repositories/index.ts`** — add exports:

```ts
export * from './inMemoryAuthSettingsRepository'
export * from './firestoreAuthSettingsRepository'
```

- [ ] **Step 6: Run tests + typecheck — expect PASS.**

- [ ] **Step 7: Commit**

```bash
git add src/infra/repositories/inMemoryAuthSettingsRepository.ts src/infra/repositories/firestoreAuthSettingsRepository.ts src/infra/repositories/inMemoryAuthSettingsRepository.test.ts src/infra/repositories/index.ts
git commit -m "feat(settings): InMemory + Firestore AuthSettings adapters (withAudit, merge write)"
```

---

### Task 4: firestore.rules `/settings/auth` block + rules tests

**Files:**
- Modify: `firestore.rules:250-254` (replace the generic `/settings/{doc}` block)
- Test: `firestore-rules-tests/settings.test.ts` (follow the existing rules-test harness location/pattern — confirm where current rules tests live and co-locate)

- [ ] **Step 1: Replace the `/settings` block in `firestore.rules`** with:

```
    // ---- /settings/auth — OAuth allowed-domain doc (super only) ----
    // Read+write super_admin only. allowedEmailDomains, when present, must be a list
    // (rules can't deep-validate each element; the repo + beforeCreate enforce that).
    // beforeCreate reads this via Admin SDK and bypasses rules.
    match /settings/auth {
      allow read: if isSuperAdmin();
      allow write: if isSuperAdmin()
        && (!('allowedEmailDomains' in request.resource.data)
            || request.resource.data.allowedEmailDomains is list);
    }

    // ---- /settings/{doc} — any other settings doc, super only ----
    match /settings/{doc} {
      allow read: if isSuperAdmin();
      allow write: if isSuperAdmin();
    }
```

- [ ] **Step 2: Locate the existing rules-test harness** (search for `@firebase/rules-unit-testing` usages). Write `settings.test.ts` mirroring that harness:

```ts
// super_admin can read + write /settings/auth with a list field
// asset_admin / tech_admin / employee / anon are DENIED read AND write
// a scalar allowedEmailDomains write is rejected
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
// ... (use the project's existing setup helper for an initialized test env + seeded /users role docs)
```

The test bodies assert (using the project's auth-context helpers):
- `assertSucceeds` super_admin `getDoc('settings/auth')` and `setDoc('settings/auth', { allowedEmailDomains: ['a.com'] })`.
- `assertFails` for asset_admin/tech_admin/employee/anon on both read and write.
- `assertFails` super_admin `setDoc('settings/auth', { allowedEmailDomains: 'a.com' })` (scalar, not a list).

- [ ] **Step 3: Note for CI** — Java/emulator is unavailable locally; rules tests run in CI. Document in the commit body that local run is skipped.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules firestore-rules-tests/settings.test.ts
git commit -m "feat(settings): explicit /settings/auth rules block + rules tests (super-only, list guard)"
```

---

### Task 5: SettingsPage + un-stub route

**Files:**
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/index.ts` (export `SettingsPage`)
- Modify: `src/config/nav.ts:80-83` (remove `'settings'` from `PHASE_STUB_ROUTES`)
- Modify: `src/config/routes.tsx` (add real `/settings` route + import)
- Test: `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Write `SettingsPage.tsx`** — thin page composing the panel, repo injectable like `CategoriesPage`:

```tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, SectionCard } from '@/components/ui'
import { AuthSettingsPanel } from '@/components/features/settings'
import type { AuthSettingsRepository } from '@/domain/settings'
import { FirestoreAuthSettingsRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface SettingsPageProps { repository?: AuthSettingsRepository }

export function SettingsPage({ repository }: SettingsPageProps) {
  const { t } = useTranslation('settings')
  const defaultRepo = useMemo<AuthSettingsRepository>(
    () => new FirestoreAuthSettingsRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="settings" title={t('title')} />
      <SectionCard title={t('auth.title')} subtitle={t('auth.subtitle')}>
        <AuthSettingsPanel repository={repo} />
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 2: Export from `src/pages/index.ts`** — `export * from './SettingsPage'` (match existing export style).

- [ ] **Step 3: Remove `'settings'`** from `PHASE_STUB_ROUTES` in `src/config/nav.ts` (leaving `['assignments','repairs','parts','roles']`).

- [ ] **Step 4: Wire the route in `routes.tsx`** — add `SettingsPage` to the `@/pages` import and add, beside the other routes:

```tsx
          <Route path="/settings" element={
            <RoleGate roles={routeRoles('settings')}><SettingsPage /></RoleGate>
          } />
```

- [ ] **Step 5: Write `SettingsPage.test.tsx`** — renders with an InMemory repo + a super_admin AuthProvider seam, asserts the auth panel + current domains render. (Use the project's existing render helper; inject `repository={new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['acme.com'] })}` and `AuthProvider initialRole="super_admin"`.)

- [ ] **Step 6: Run tests + typecheck + build.**

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsPage.tsx src/pages/index.ts src/config/nav.ts src/config/routes.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat(settings): SettingsPage + real /settings route (un-stub)"
```

---

### Task 6: AuthSettingsPanel (the editor)

**Files:**
- Create: `src/components/features/settings/AuthSettingsPanel.tsx`
- Create: `src/components/features/settings/index.ts`
- Test: `src/components/features/settings/AuthSettingsPanel.test.tsx`

- [ ] **Step 1: Write `AuthSettingsPanel.test.tsx`** (failing) covering: renders current domains; add valid domain; reject invalid + duplicate inline; remove a domain; Save disabled until dirty; non-empty Save → standard confirm → repo called with normalized list; empty list → fail-closed banner + escalated danger confirm (type-to-confirm token) → repo called with `[]`; save error surfaces. Use `InMemoryAuthSettingsRepository` + `userEvent`.

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Write `AuthSettingsPanel.tsx`** with: load (LoadingState) / error (ErrorState+retry) / ready; working-list state seeded from load; add input with `normalizeDomain`+`isValidDomain`+dup check (inline `t()` errors); removable rows; dirty = `JSON.stringify(working) !== JSON.stringify(saved)`; persistent fail-closed banner when `working.length === 0`; `ConfirmDialog` (reuse existing dialog primitive) for non-empty save summarizing the list; an escalated danger confirm for empty save requiring a typed token (e.g. type `DISABLE`); on confirm `await repo.updateAllowedDomains(working, { uid: user.id, role })`, then re-read + reset dirty; surface errors. All strings via `useTranslation('settings')`. Use existing UI primitives (`Btn`, `Icon`, `Chip`, `EmptyState`, `LoadingState`, `ErrorState`, and the project's confirm-dialog component — reuse `ConfirmDeleteDialog`'s pattern or the shared dialog).

- [ ] **Step 4: Write `src/components/features/settings/index.ts`** — `export * from './AuthSettingsPanel'`.

- [ ] **Step 5: Run tests + typecheck + build — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add src/components/features/settings/
git commit -m "feat(settings): AuthSettingsPanel — domain editor, dirty-gating, fail-closed danger confirm"
```

---

### Task 7: i18n — `settings` namespace (ru/en/hy)

**Files:**
- Create: `src/locales/ru/settings.json`, `src/locales/en/settings.json`, `src/locales/hy/settings.json`
- Modify: the i18next resource registry (wherever namespaces are registered — match how `categories.json` is wired)

- [ ] **Step 1: Add keys** for: `title`, `auth.title`, `auth.subtitle`, `auth.currentDomains`, `auth.addPlaceholder`, `auth.add`, `auth.remove`, `auth.empty`, `failClosed.banner`, `validation.invalid`, `validation.duplicate`, `validation.empty`, `save`, `saved`, `saveFailed`, `confirm.title`, `confirm.body` (with `{{list}}`), `confirm.ok`, `confirm.cancel`, `dangerConfirm.title`, `dangerConfirm.body`, `dangerConfirm.tokenLabel`, `dangerConfirm.token` (the literal token, e.g. `DISABLE` — same token across locales), `dangerConfirm.ok`, `loading.error`. Russian is the primary audience; provide real ru/en/hy translations (not English placeholders).

- [ ] **Step 2: Register the namespace** the same way `categories` is registered; confirm `useTranslation('settings')` resolves in a render test.

- [ ] **Step 3: Run tests — expect PASS.**

- [ ] **Step 4: Commit**

```bash
git add src/locales/*/settings.json <registry file>
git commit -m "feat(settings): settings i18n namespace (ru/en/hy)"
```

---

### Task 8: Shape-tie test (editor write shape ⇔ function read shape)

**Files:**
- Create: `src/domain/settings/shape-tie.test.ts`

- [ ] **Step 1: Write the test** — assert the field name + element type the editor writes match what the function consumes. Since the function lives in the `functions/` workspace (separate tsconfig), tie via a shared literal + a structural assertion rather than a cross-workspace import:

```ts
import { describe, it, expectTypeOf } from 'vitest'
import type { AuthSettings } from './types'

// The field beforeCreate reads. If this name/type ever drifts from the function,
// update BOTH the function reader and this constant — the comment is the contract.
const ENFORCED_FIELD = 'allowedEmailDomains' as const

describe('shape-tie: editor write shape ⇔ beforeCreate read shape', () => {
  it('AuthSettings carries allowedEmailDomains: string[]', () => {
    expectTypeOf<AuthSettings[typeof ENFORCED_FIELD]>().toEqualTypeOf<string[]>()
  })
})
```

(If `expectTypeOf` is not configured, assert at runtime that a constructed `AuthSettings` has `allowedEmailDomains` as an array of strings.)

- [ ] **Step 2: Run — expect PASS.**

- [ ] **Step 3: Final verification — `npm run typecheck && npx vitest run && npm run build`.**

- [ ] **Step 4: Commit**

```bash
git add src/domain/settings/shape-tie.test.ts
git commit -m "test(settings): tie editor write shape to beforeCreate read shape"
```

---

## Verification (Phase 6)
- `npm run typecheck` — clean
- `npx vitest run` (or `npm test -- --run`) — 731 baseline + new tests, all green
- `npm run build` — succeeds
- Rules tests authored for CI (Java unavailable locally).

## Rollback
All work is on `feat/settings-auth-domains`. Each task is its own commit; revert any single commit or abandon the branch. The only production-rules change is the `/settings/auth` block (additive + a list-shape guard); reverting restores the prior generic `/settings/{doc}` rule.

## Self-review notes
- Spec coverage: §2 shape → Tasks 1,3,8; §3 fail-closed → Tasks 3,6; §4 arch → Tasks 1–3; §5 validation → Task 1; §6 UI → Tasks 5,6; §7 rules → Task 4; §8 testing → every task + Task 8; §9 forks → encoded as decisions (no emailLinkActionUrl editor; escalated empty-save confirm; super-only rules).
- Type consistency: `AuthSettings`, `AuthSettingsRepository`, `updateAllowedDomains`, `getAuthSettings`, `normalizeDomain`/`isValidDomain`/`dedupeDomains`, `entityType:'settings'`/`action:'updated'` used consistently across all tasks.
- No placeholders: all code steps carry real code; the only "match existing pattern" pointers are the rules-test harness location and the i18n registry file, which the implementer confirms against the live repo.
