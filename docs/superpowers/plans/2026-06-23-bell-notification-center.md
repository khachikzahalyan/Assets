# Bell Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role-gated bell notification center to the AMS top bar that lists temporary holds (Стажёр / Аудит) needing return, with an unread badge counting `dueSoon` + `overdue` holds.

**Architecture:** A pure domain builder (`buildHoldNotifications`) turns `Asset[]` into a sorted notification list reusing the existing `temporaryHoldStatus` helper. A `useHoldNotifications` hook wires the existing `AssetRepository` (mount + on-open refresh). A portaled `NotificationBell` component renders the bell + badge + popover (mobile bottom sheet), mounted in `TopBar` and gated to `super_admin` / `asset_admin`. Read-only — no audit, no rules change.

**Tech Stack:** React 19 + TS (strict), Vitest + @testing-library/react, i18next (ru authoritative + en + hy), lucide-react icons, ReactDOM.createPortal.

**Branch:** `feat/employees-prototype-parity` (do NOT merge). Commit incrementally.

---

## File Structure

- Create: `src/domain/asset/holdNotifications.ts` — pure builder + `HoldNotification` type.
- Create: `src/domain/asset/holdNotifications.test.ts` — builder/sort/count unit tests.
- Modify: `src/domain/asset/index.ts` — re-export the new module.
- Create: `src/hooks/useHoldNotifications.ts` — repo-wired hook (mount + on-open refresh).
- Modify: `src/hooks/index.ts` — re-export the hook.
- Create: `src/components/common/NotificationBell.tsx` — bell + badge + portaled popover.
- Create: `src/components/common/NotificationBell.test.tsx` — render / badge / empty / role-gate / item / navigate tests.
- Modify: `src/components/common/TopBar.tsx` — render `<NotificationBell>` role-gated, left of LanguageToggle.
- Modify: `src/components/ui/icon.tsx` — register the `bell` lucide icon.
- Modify: `src/components/features/employees/DestPicker.tsx` — relax the «Временно» return-date floor (allow past dates, keep +7 default).
- Create: `src/locales/ru/notifications.json` + `src/locales/en/notifications.json` + `src/locales/hy/notifications.json` — new namespace.
- Modify: `src/lib/i18n/index.ts` — register the `notifications` namespace (confirm pattern; may be auto-loaded).

---

## Task 1: `bell` icon registration

**Files:**
- Modify: `src/components/ui/icon.tsx`

- [ ] **Step 1: Add the import.** In the lucide-react import block (near `BatteryMedium`), add `Bell,`.

- [ ] **Step 2: Register in REGISTRY.** Add `bell: Bell,` to the `REGISTRY` object (place it near `mail`).

- [ ] **Step 3: Verify build of the file compiles** (deferred to Task 8 full run). Commit.

```bash
git add src/components/ui/icon.tsx
git commit -m "feat(icon): register bell icon"
```

---

## Task 2: `buildHoldNotifications` pure domain builder (TDD)

**Files:**
- Create: `src/domain/asset/holdNotifications.ts`
- Test: `src/domain/asset/holdNotifications.test.ts`
- Modify: `src/domain/asset/index.ts`

The builder reuses `temporaryHoldStatus` (from `./temporaryHold`) and operates on `Asset` (from `./types`). A notification is produced ONLY when the asset's assignment is a temporary hold whose status is `dueSoon` or `overdue`. `active` holds and non-holds are excluded. Sort: `overdue` before `dueSoon`; within the same status, earlier `expiresAt` first; tie-break by `invCode` ascending for stability.

The asset display title mirrors existing format logic: prefer `brand + model`, fall back to `type`, then `invCode`. Keep it dependency-free (no i18n in the domain layer — the component localizes role labels + status phrasing).

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, it, expect } from 'vitest'
import { buildHoldNotifications, type HoldNotification } from './holdNotifications'
import type { Asset } from './types'

const base: Asset = {
  id: 'a0', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
  invCode: '450/001', serial: null, statusId: 'st_assigned',
  assignment: null, branchId: 'br-1', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// fixed "now" = 2026-06-23 local midnight reference
const NOW = new Date(2026, 5, 23)

function tempAsset(over: Partial<Asset>, expiresAt: string, tempKind: 'audit' | 'intern' = 'intern'): Asset {
  return { ...base, ...over, assignment: { mode: 'temporary', isTemporary: true, tempKind, expiresAt } }
}

describe('buildHoldNotifications', () => {
  it('excludes non-holds and active holds', () => {
    const assets: Asset[] = [
      { ...base, id: 'plain', assignment: { mode: 'employee', employeeId: 'e1' } },
      tempAsset({ id: 'active' }, '2026-12-31'), // far future → active
    ]
    expect(buildHoldNotifications(assets, NOW)).toEqual([])
  })

  it('includes dueSoon and overdue holds', () => {
    const assets: Asset[] = [
      tempAsset({ id: 'soon', invCode: '450/002' }, '2026-06-24'), // tomorrow → dueSoon
      tempAsset({ id: 'late', invCode: '450/003' }, '2026-06-20'), // past → overdue
    ]
    const out = buildHoldNotifications(assets, NOW)
    expect(out.map(n => n.assetId)).toEqual(['late', 'soon']) // overdue first
    expect(out[0]!.hold).toBe('overdue')
    expect(out[1]!.hold).toBe('dueSoon')
  })

  it('sorts overdue by earliest expiresAt first, then invCode', () => {
    const assets: Asset[] = [
      tempAsset({ id: 'b', invCode: '450/010' }, '2026-06-19'),
      tempAsset({ id: 'a', invCode: '450/009' }, '2026-06-18'),
      tempAsset({ id: 'c', invCode: '450/008' }, '2026-06-19'),
    ]
    const out = buildHoldNotifications(assets, NOW)
    expect(out.map(n => n.assetId)).toEqual(['a', 'c', 'b']) // 18th, then 19th tie broken by invCode 008<010
  })

  it('carries title (brand+model), invCode, tempKind, expiresAt, hold', () => {
    const out = buildHoldNotifications([tempAsset({ id: 'x' }, '2026-06-20', 'audit')], NOW)
    const n = out[0] as HoldNotification
    expect(n).toMatchObject({
      assetId: 'x', title: 'Dell Latitude', invCode: '450/001',
      tempKind: 'audit', expiresAt: '2026-06-20', hold: 'overdue',
    })
  })

  it('falls back to type then invCode for title', () => {
    const furn = tempAsset({ id: 'f', brand: null, model: null, type: 'Стол', invCode: '460/001' }, '2026-06-20')
    const noName = tempAsset({ id: 'g', brand: null, model: null, type: null, invCode: '470/001' }, '2026-06-20')
    const out = buildHoldNotifications([furn, noName], NOW)
    expect(out.find(n => n.assetId === 'f')!.title).toBe('Стол')
    expect(out.find(n => n.assetId === 'g')!.title).toBe('470/001')
  })
})
```

- [ ] **Step 2: Run, verify it fails** (module not found).

Run: `npx vitest run src/domain/asset/holdNotifications.test.ts`
Expected: FAIL — cannot find `./holdNotifications`.

- [ ] **Step 3: Implement the builder.**

```ts
import type { Asset } from './types'
import { temporaryHoldStatus, type TemporaryHoldStatus } from './temporaryHold'

export interface HoldNotification {
  assetId: string
  title: string
  invCode: string
  tempKind: 'audit' | 'intern' | 'staff' | null
  expiresAt: string
  /** 'dueSoon' | 'overdue' — 'active' holds are never emitted. */
  hold: Exclude<TemporaryHoldStatus, 'active'>
}

function assetTitle(a: Asset): string {
  const name = [a.brand, a.model].filter(Boolean).join(' ').trim()
  if (name) return name
  if (a.type) return a.type
  return a.invCode
}

const ORDER: Record<Exclude<TemporaryHoldStatus, 'active'>, number> = { overdue: 0, dueSoon: 1 }

/**
 * Builds the sorted bell-notification list. PURE — no Firebase, no i18n.
 * Emits one entry per asset whose assignment is a temporary hold currently
 * 'dueSoon' or 'overdue'. Sort: overdue before dueSoon; then earliest
 * expiresAt; then invCode (stable tie-break).
 */
export function buildHoldNotifications(assets: Asset[], now: Date = new Date()): HoldNotification[] {
  const out: HoldNotification[] = []
  for (const a of assets) {
    const hold = temporaryHoldStatus(a.assignment, now)
    if (hold !== 'dueSoon' && hold !== 'overdue') continue
    const expiresAt = a.assignment?.expiresAt
    if (!expiresAt) continue
    out.push({
      assetId: a.id,
      title: assetTitle(a),
      invCode: a.invCode,
      tempKind: a.assignment?.tempKind ?? null,
      expiresAt,
      hold,
    })
  }
  out.sort((x, y) => {
    if (ORDER[x.hold] !== ORDER[y.hold]) return ORDER[x.hold] - ORDER[y.hold]
    if (x.expiresAt !== y.expiresAt) return x.expiresAt < y.expiresAt ? -1 : 1
    return x.invCode < y.invCode ? -1 : x.invCode > y.invCode ? 1 : 0
  })
  return out
}
```

- [ ] **Step 4: Re-export.** Add to `src/domain/asset/index.ts`:

```ts
export * from './holdNotifications'
```

- [ ] **Step 5: Run, verify pass.**

Run: `npx vitest run src/domain/asset/holdNotifications.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit.**

```bash
git add src/domain/asset/holdNotifications.ts src/domain/asset/holdNotifications.test.ts src/domain/asset/index.ts
git commit -m "feat(domain): buildHoldNotifications pure builder for the bell"
```

---

## Task 3: `useHoldNotifications` hook

**Files:**
- Create: `src/hooks/useHoldNotifications.ts`
- Modify: `src/hooks/index.ts`

Mirrors `useAssets`'s repo-fetch pattern but builds notifications and exposes a `reload`. Refresh model: fetch on mount; the component calls `reload()` when the panel opens. No `onSnapshot` (documented open decision). Reuses `AssetListQuery` with `group:'all', statusId:'all'`.

- [ ] **Step 1: Implement.**

```ts
import { useEffect, useState, useCallback, useMemo } from 'react'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { AssetListQuery } from '@/domain/asset'
import { buildHoldNotifications, type HoldNotification } from '@/domain/asset'

const HOLD_QUERY: AssetListQuery = {
  group: 'all', statusId: 'all', branchId: 'all', search: '', sort: 'updated_desc',
}

export interface UseHoldNotificationsResult {
  notifications: HoldNotification[]
  count: number
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Loads temporary-hold notifications for the bell. Fetches on mount; call
 * reload() (e.g. on panel open) to refresh. Read-only — no audit writes.
 *
 * @param repository MUST be a stable reference (memoize via useMemo).
 */
export function useHoldNotifications(repository: AssetRepository): UseHoldNotificationsResult {
  const [notifications, setNotifications] = useState<HoldNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const assets = await repository.listAssets(HOLD_QUERY)
        if (!active) return
        setNotifications(buildHoldNotifications(assets, new Date()))
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [repository, tick])

  const count = useMemo(() => notifications.length, [notifications])
  return { notifications, count, loading, error, reload }
}
```

- [ ] **Step 2: Re-export.** Add to `src/hooks/index.ts`:

```ts
export * from './useHoldNotifications'
```

- [ ] **Step 3: Commit.**

```bash
git add src/hooks/useHoldNotifications.ts src/hooks/index.ts
git commit -m "feat(hooks): useHoldNotifications (mount + on-open refresh)"
```

---

## Task 4: i18n — `notifications` namespace (ru authoritative + en + hy)

**Files:**
- Create: `src/locales/ru/notifications.json`
- Create: `src/locales/en/notifications.json`
- Create: `src/locales/hy/notifications.json`
- Modify (if needed): `src/lib/i18n/index.ts`

Keys (Tier-1 UI chrome). Status lines use interpolation `{{date}}` (DD.MM short).

- [ ] **Step 1: Write `ru/notifications.json`.**

```json
{
  "bellTooltip": "Уведомления",
  "title": "Уведомления",
  "subtitle": "Временные выдачи к возврату",
  "empty": "Нет активов к возврату",
  "emptyHint": "Здесь появятся временные выдачи, которые пора вернуть.",
  "dueSoon": "Надо вернуть — до {{date}}",
  "overdue": "Просрочено — {{date}}",
  "kindAudit": "Аудит",
  "kindIntern": "Стажёр",
  "kindTemp": "Временно"
}
```

- [ ] **Step 2: Write `en/notifications.json`.**

```json
{
  "bellTooltip": "Notifications",
  "title": "Notifications",
  "subtitle": "Temporary hand-outs to return",
  "empty": "No assets to return",
  "emptyHint": "Temporary hand-outs that are due appear here.",
  "dueSoon": "Return by {{date}}",
  "overdue": "Overdue — {{date}}",
  "kindAudit": "Audit",
  "kindIntern": "Intern",
  "kindTemp": "Temporary"
}
```

- [ ] **Step 3: Write `hy/notifications.json`.**

```json
{
  "bellTooltip": "Ծանուցումներ",
  "title": "Ծանուցումներ",
  "subtitle": "Վերադարձման ենթակա ժամանակավոր տրամադրումներ",
  "empty": "Վերադարձման ակտիվներ չկան",
  "emptyHint": "Ժամկետը լրացած ժամանակավոր տրամադրումները կհայտնվեն այստեղ։",
  "dueSoon": "Վերադարձնել մինչև {{date}}",
  "overdue": "Ժամկետանց — {{date}}",
  "kindAudit": "Աուդիտ",
  "kindIntern": "Պրակտիկանտ",
  "kindTemp": "Ժամանակավոր"
}
```

- [ ] **Step 4: Register the namespace in `src/lib/i18n/index.ts` (CONFIRMED: namespaces are explicitly enumerated).** Three edits, following the existing `parts` namespace as the model:
  1. Add imports: `import ruNotifications from '@/locales/ru/notifications.json'`, `import enNotifications from '@/locales/en/notifications.json'`, `import hyNotifications from '@/locales/hy/notifications.json'` (place each next to the matching `…Parts` import).
  2. Add `notifications: ruNotifications` to `resources.ru`, `notifications: enNotifications` to `resources.en`, `notifications: hyNotifications` to `resources.hy`.
  3. Add `'notifications'` to the `ns: [...]` array in `i18n.init`.

- [ ] **Step 5: Commit.**

```bash
git add src/locales/ru/notifications.json src/locales/en/notifications.json src/locales/hy/notifications.json src/lib/i18n/index.ts
git commit -m "feat(i18n): notifications namespace (ru/en/hy)"
```

---

## Task 5: `NotificationBell` component (TDD)

**Files:**
- Create: `src/components/common/NotificationBell.tsx`
- Test: `src/components/common/NotificationBell.test.tsx`

The component:
- Renders a bell `<button>` (theme: `inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#94A3B8] hover:bg-[#22272E] transition-colors`, `title` from `notifications:bellTooltip`).
- Badge: when `count > 0`, an absolutely-positioned pill (`bg-[#F97316] text-white` orange theme token) showing `count` (cap display at `99+`). No badge when 0.
- Popover: portaled to `document.body` (escape topbar clipping), positioned via `useLayoutEffect` + `getBoundingClientRect`. Desktop → anchored top-right under the bell (`position:fixed`, right-aligned, `width:340`). Mobile (`matchMedia('(max-width: 768px)')`) → bottom sheet (`left:8,right:8,bottom:8`). Same outside-click + Escape close pattern as `ProfileMenu`/`DestPicker`. Theme tokens identical to ProfileMenu dropdown (`bg-[#22272E]`/`bg-[#1B1F24]`, `ring-[#2A2F36]`, `anim-fade-slide-in`).
- Refreshes via `reload()` when opening.
- Header: title + subtitle. Body: list or empty state.
- Each item: a `<button>` row → `onSelect(assetId)` (the component takes an `onSelect` prop so it's testable without a router; TopBar passes a navigate callback). Row content: asset title (bold) + invCode (mono muted), role label chip (Стажёр/Аудит/Временно), status line colored amber (`text-amber-300`) for dueSoon / rose (`text-rose-400`) for overdue.

The component takes an injectable `repository` prop (default `FirestoreAssetRepository(db())` via `useMemo`) so tests pass an in-memory/stub repo — mirroring `AssetsPage`'s composition-root pattern.

Date formatting: `formatShort(iso)` → `DD.MM` from the `YYYY-MM-DD` part (module-scope pure helper).

- [ ] **Step 1: Write the failing test.**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { NotificationBell } from './NotificationBell'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { Asset, AssetReferenceData } from '@/domain/asset'

// i18n test harness — CONFIRMED pattern from DestPicker.test.tsx / app-shell.test.tsx:
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { beforeAll } from 'vitest'
beforeAll(async () => { await i18n.changeLanguage('ru') })
// Wrap every render() in <I18nextProvider i18n={i18n}>…</I18nextProvider>.

const base: Asset = {
  id: 'a0', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
  invCode: '450/001', serial: null, statusId: 'st_assigned',
  assignment: null, branchId: 'br-1', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
function temp(id: string, expiresAt: string, tempKind: 'audit' | 'intern', invCode: string): Asset {
  return { ...base, id, invCode, assignment: { mode: 'temporary', isTemporary: true, tempKind, expiresAt } }
}

const EMPTY_REF: AssetReferenceData = { statuses: [], branches: [], departments: [], categories: [], employees: [] }

function stubRepo(assets: Asset[]): AssetRepository {
  return {
    listAssets: vi.fn().mockResolvedValue(assets),
    loadReferenceData: vi.fn().mockResolvedValue(EMPTY_REF),
    listAssetsForEmployee: vi.fn().mockResolvedValue([]),
    loadSelfServiceRefData: vi.fn().mockResolvedValue({ statuses: [], categories: [], branches: [], departments: [] }),
  }
}

describe('NotificationBell', () => {
  it('shows a badge with the dueSoon+overdue count', async () => {
    // far-future hold = active (no badge), plus one overdue
    const repo = stubRepo([
      temp('overdue1', '2000-01-01', 'intern', '450/002'),
      temp('active1', '2999-01-01', 'audit', '450/003'),
    ])
    render(<NotificationBell repository={repo} onSelect={() => {}} />)
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })

  it('renders no badge when there are zero holds', async () => {
    const repo = stubRepo([])
    const { container } = render(<NotificationBell repository={repo} onSelect={() => {}} />)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    // badge pill carries a data-testid; assert absent
    expect(container.querySelector('[data-testid="bell-badge"]')).toBeNull()
  })

  it('opens the panel and shows an empty state when no holds', async () => {
    const repo = stubRepo([])
    render(<NotificationBell repository={repo} onSelect={() => {}} />)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /уведомления|notifications/i }))
    expect(await screen.findByText(/нет активов к возврату|no assets to return/i)).toBeInTheDocument()
  })

  it('lists overdue before dueSoon and calls onSelect with the assetId', async () => {
    const onSelect = vi.fn()
    const repo = stubRepo([
      temp('soon1', '2099-... ', 'intern', '450/004'), // replaced below with a real dueSoon date at runtime
    ])
    // Build dueSoon/overdue relative to today so the test is date-stable:
    const today = new Date()
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7)
    const repo2 = stubRepo([
      temp('soon1', iso(tomorrow), 'intern', '450/004'),
      temp('late1', iso(lastWeek), 'audit', '450/005'),
    ])
    render(<NotificationBell repository={repo2} onSelect={onSelect} />)
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /уведомления|notifications/i }))
    const items = await screen.findAllByTestId('bell-item')
    expect(items).toHaveLength(2)
    // first item is overdue (late1)
    fireEvent.click(items[0]!)
    expect(onSelect).toHaveBeenCalledWith('late1')
  })
})
```

> **Step 0 note (CONFIRMED):** The harness is `<I18nextProvider i18n={i18n}>` from `@/lib/i18n` with `beforeAll(async () => { await i18n.changeLanguage('ru') })` — copied verbatim from `DestPicker.test.tsx`. The default test locale is `ru`, so matchers can use the Russian strings (`/Уведомления/`, `/Нет активов к возврату/`). Wrap EVERY `render()` in the provider. This component depends on the `notifications` namespace, which Task 4 registers — Task 5 must run AFTER Task 4.

- [ ] **Step 2: Run, verify it fails.**

Run: `npx vitest run src/components/common/NotificationBell.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `NotificationBell.tsx`.** Use the ProfileMenu/DestPicker portal pattern. Sketch (the implementer fills theme details to match ProfileMenu exactly):

```tsx
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import { useHoldNotifications } from '@/hooks'
import type { HoldNotification } from '@/domain/asset'

export interface NotificationBellProps {
  /** Injectable for tests; defaults to the Firestore repo. */
  repository?: AssetRepository
  /** Called with the assetId when a notification row is clicked. */
  onSelect: (assetId: string) => void
}

interface Pos { top?: number; bottom?: number; left?: number; right?: number; width: number | string }

const pad = (n: number) => String(n).padStart(2, '0')
function formatShort(iso: string): string {
  const [datePart] = iso.split('T')
  const [, m, d] = (datePart ?? '').split('-')
  return d && m ? `${d}.${m}` : iso
}

function kindLabel(k: HoldNotification['tempKind'], t: (key: string) => string): string {
  if (k === 'audit') return t('kindAudit')
  if (k === 'intern') return t('kindIntern')
  return t('kindTemp')
}

export function NotificationBell({ repository, onSelect }: NotificationBellProps) {
  const { t } = useTranslation('notifications')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const defaultRepo = useMemo<AssetRepository>(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const { notifications, count, reload } = useHoldNotifications(repo)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) { setPos({ left: 8, right: 8, bottom: 8, width: 'auto' }); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right), width: 340 })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    updatePos()
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  const toggle = () => {
    setOpen(o => {
      const next = !o
      if (next) reload()
      return next
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={t('bellTooltip')}
        aria-label={t('bellTooltip')}
        className="relative inline-flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] max-md:w-11 max-md:h-11 rounded-lg text-[#94A3B8] hover:bg-[#22272E] transition-colors"
      >
        <Icon name="bell" size={18} />
        {count > 0 && (
          <span
            data-testid="bell-badge"
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-[#F97316] text-white text-[10px] font-bold leading-none"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', zIndex: 200, width: pos.width,
            ...(pos.top !== undefined ? { top: pos.top } : {}),
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
            ...(pos.left !== undefined ? { left: pos.left } : {}),
            ...(pos.right !== undefined ? { right: pos.right } : {}),
          }}
          className="bg-[#22272E] border border-[#2A2F36] rounded-xl anim-fade-slide-in overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-[#2A2F36]">
            <div className="text-[13px] font-semibold text-[#F8FAFC]">{t('title')}</div>
            <div className="text-[11px] text-[#64748B]">{t('subtitle')}</div>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <Icon name="check-check" size={20} className="text-[#64748B]" />
              <div className="text-[13px] text-[#94A3B8]">{t('empty')}</div>
              <div className="text-[11px] text-[#64748B] max-w-[240px]">{t('emptyHint')}</div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-1">
              {notifications.map((n) => {
                const overdue = n.hold === 'overdue'
                const statusText = overdue
                  ? t('overdue', { date: formatShort(n.expiresAt) })
                  : t('dueSoon', { date: formatShort(n.expiresAt) })
                return (
                  <button
                    key={n.assetId}
                    type="button"
                    data-testid="bell-item"
                    onClick={() => { setOpen(false); onSelect(n.assetId) }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#1B1F24] transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-[#F8FAFC] truncate">{n.title}</span>
                      <span className="text-[11px] font-mono text-[#64748B] shrink-0">{n.invCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#94A3B8]">{kindLabel(n.tempKind, t)}</span>
                      <span className={`text-[12px] font-medium ${overdue ? 'text-rose-400' : 'text-amber-300'}`}>
                        {statusText}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass.**

Run: `npx vitest run src/components/common/NotificationBell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/components/common/NotificationBell.tsx src/components/common/NotificationBell.test.tsx
git commit -m "feat(common): NotificationBell with badge + portaled popover"
```

---

## Task 6: Mount in TopBar, role-gated

**Files:**
- Modify: `src/components/common/TopBar.tsx`

Render the bell ONLY for `super_admin` / `asset_admin`, left of the LanguageToggle. Wire `onSelect` → `navigate('/assets/:id')`. TopBar currently takes no `navigate` — use `useNavigate()` from react-router-dom (TopBar already runs inside the router via ShellLayout; confirm by checking it renders under `<RequireAuth>`/`<ShellLayout>`).

- [ ] **Step 1: Edit `TopBar.tsx`.**

```tsx
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs } from './Breadcrumbs'
import { LanguageToggle } from './LanguageToggle'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'

export interface TopBarProps {
  breadcrumbs: string[]
  customContent?: ReactNode
  onOpenSidebar: () => void
}

export function TopBar({ breadcrumbs, customContent, onOpenSidebar }: TopBarProps) {
  const { t } = useTranslation('common')
  const { role } = useAuth()
  const navigate = useNavigate()
  const canManageReturns = role === 'super_admin' || role === 'asset_admin'

  return (
    <div className="app-shell-topbar flex items-center gap-3 px-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="ams-hamburger lg:hidden inline-flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] max-md:w-11 max-md:h-11 rounded-lg text-[#94A3B8] hover:bg-[#22272E] transition-colors"
        title={t('actions.openMenu')}
        aria-label={t('actions.openMenu')}
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="flex-1 min-w-0">
        {customContent != null ? customContent : <Breadcrumbs items={breadcrumbs} />}
      </div>

      <div className="flex items-center gap-2">
        {canManageReturns && (
          <NotificationBell onSelect={(assetId) => navigate(`/assets/${assetId}`)} />
        )}
        <LanguageToggle />
        <ProfileMenu />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check `app-shell.test.tsx`** still passes (TopBar now uses `useNavigate`/`useAuth` — the shell tests already render under a router + AuthProvider; if a TopBar-isolated test exists, it may need a Router/Auth wrapper). Run:

`npx vitest run src/components/common/app-shell.test.tsx`
Expected: PASS. If it fails because TopBar is rendered without a Router, wrap the render in `<MemoryRouter>` in that test (follow the existing wrapper).

- [ ] **Step 3: Commit.**

```bash
git add src/components/common/TopBar.tsx
git commit -m "feat(topbar): mount role-gated NotificationBell"
```

---

## Task 7: Relax «Временно» return-date floor in DestPicker

**Files:**
- Modify: `src/components/features/employees/DestPicker.tsx`

Currently the return date is floored at `todayISO` (lines ~428-434): the `DatePicker` has `min={todayISO}`, the `onChange` guard rejects `v < todayISO`, and the confirm button is disabled when `returnDate < todayISO`. Relax to allow past dates while keeping the +7 default.

- [ ] **Step 1: Remove the `min` floor and the past-date guards.** Change the `DatePicker` usage:

```tsx
<DatePicker
  id="dest-return-date"
  value={returnDate}
  onChange={(v) => setReturnDate(v)}
  placeholder={t('dest.returnDatePlaceholder')}
/>
```

(Drop the `min={todayISO}` prop and the `if (v && v < todayISO) return` guard.)

And the confirm button:

```tsx
<button
  type="button"
  disabled={!tempKind || !returnDate}
  ...
>
```

(Drop `|| returnDate < todayISO`.)

- [ ] **Step 2: Remove now-unused `todayISO`** if nothing else references it. Search the file: if `todayISO` has no remaining uses, delete its declaration (`const todayISO = todayISODate()`). If `todayISODate` import/helper becomes unused, leave the module-scope helper (it's harmless) but remove the local const to satisfy `noUnusedLocals`.

- [ ] **Step 3: Run the DestPicker test.**

Run: `npx vitest run src/components/features/employees/DestPicker.test.ts`
Expected: PASS. If a test asserted the min floor / disabled-on-past behavior, UPDATE it to assert the new behavior (past date selectable, confirm enabled with a past date + tempKind). Add one test: choosing a past date keeps confirm enabled and commits `expiresAt` in the past.

- [ ] **Step 4: Commit.**

```bash
git add src/components/features/employees/DestPicker.tsx src/components/features/employees/DestPicker.test.ts
git commit -m "feat(destpicker): allow past return dates for temporary holds (keep +7 default)"
```

> **Open-decision note:** If `AssetCreateForm`'s QuickAssignment has its OWN temporary date picker with a `min` floor (separate from DestPicker), do NOT touch it in this plan — flag it in the report. The brief scopes the relax to the «Временно» flow reached via the Employee Detail Drawer (DestPicker).

---

## Task 8: Full verification

- [ ] **Step 1: Scoped typecheck of touched files.** The pre-existing untracked `parts/*` workstream breaks the full build — verify only this feature's files compile. Run a scoped tsc:

```bash
cd /c/Users/DELL/Desktop/assets-crm
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "holdNotifications|useHoldNotifications|NotificationBell|TopBar|icon.tsx|DestPicker" || echo "No type errors in touched files"
```

Expected: `No type errors in touched files` (or empty grep). If `tsconfig.app.json` doesn't exist, use the project's typecheck script name (`npm run typecheck` / `tsc -b`) and grep the same way.

- [ ] **Step 2: Run the new + adjacent test suites.**

```bash
npx vitest run src/domain/asset/holdNotifications.test.ts src/components/common/NotificationBell.test.tsx src/components/common/app-shell.test.tsx src/components/features/employees/DestPicker.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Full test suite (record pre-existing failures separately).**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: no NEW failures attributable to this feature. Pre-existing `parts/*` breakage is documented, not fixed.

- [ ] **Step 4: Manual smoke (dev server already running on :5173).** As `super_admin`: bell visible with a badge if any hold is overdue/dueSoon; open → list sorted overdue-first; click → navigates to `/assets/:id`. Switch dev role to `employee`: bell absent. Open Employee drawer → «Временно» → confirm a past date is selectable and commits.

---

## Self-Review

- **Spec coverage:** Bell (T1,T5,T6) · badge count = dueSoon+overdue (T2,T5) · panel + portal/bottom-sheet (T5) · item content title/invCode/role/status/navigate (T5,T6) · newest-most-urgent-first (T2) · data via AssetRepository.listAssets + reuse temporaryHoldStatus (T2,T3) · refresh on mount+open (T3,T5) · role gate super_admin/asset_admin (T6) · past-date relax keep +7 (T7) · i18n ru+en+hy (T4) · tests for builder/badge/panel/empty/role/navigate (T2,T5) · scoped tsc (T8). All covered.
- **Placeholders:** Step 0 note flags the i18n-test-harness import as the one thing the implementer must resolve from a sibling test (cannot be hardcoded blind). The Task-5 test's first `temp('soon1', '2099-...')` line is intentionally replaced by the date-stable block right below it — implementer uses `repo2`.
- **Type consistency:** `HoldNotification` shape identical across T2/T3/T5. `temporaryHoldStatus` / `TemporaryHoldStatus` names match the existing `temporaryHold.ts`. `AssetRepository` method set matches the port (T5 stub implements all 4 read methods).
- **Scope:** Single cohesive feature, one plan. No rules/audit changes (read-only) → security-reviewer only if a new read path leaks (it doesn't; assets admins already read).
