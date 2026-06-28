# Barcode Scanner (mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **TESTING PHASE — NO GIT.** Do NOT `git add` / `git commit` / `git push`. Owner instruction (2026-06-28). Each task ends with a **verification checkpoint** (run tests/typecheck) instead of a commit.

**Goal:** Add a «Сканировать» nav item under the «Система» group that opens a `/scan` page; the page reads an asset's Code 128 / QR sticker with the phone camera, resolves it by `invCode`, and navigates to the existing Asset Detail page.

**Architecture:** A dedicated route-level `ScanPage` hosts `@yudiel/react-qr-scanner`'s `<Scanner>` (native `BarcodeDetector` on Android, ZXing-C++ WASM fallback on iOS). On a single detection it calls the already-present `AssetWriteRepository.findByInvCode(code)` and either `navigate('/assets/:id')` (found) or shows a toast (not found). Nav/route wiring follows the project's single-source-of-truth pattern (`config/nav.ts` → `config/access.ts`).

**Tech Stack:** React 19, TypeScript (strict), Vite, react-router-dom v7, react-i18next, Tailwind + shadcn/ui, Firebase/Firestore (repository pattern), vitest + @testing-library/react.

---

## Pre-req status (done, verify only)

- `AssetWriteRepository.findByInvCode` + Firestore/InMemory impls + tests already exist in the working tree
  (uncommitted). Verified 2026-06-28: `npx vitest run src/infra/repositories/inMemoryAssetRepository.test.ts`
  → 9/9 pass; `npx tsc --noEmit` → exit 0. **No repository task in this plan.**

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/config/nav.ts` | Add `'scan'` to `RouteId`; add NavItem to `system` group | Modify |
| `src/locales/{ru,en,hy}/nav.json` | `items.scan` label | Modify |
| `src/locales/{ru,en,hy}/scan.json` | ScanPage strings (title, hint, resolving, not-found, errors) | Create |
| `src/lib/i18n/index.ts` | Register `'scan'` namespace | Modify |
| `src/pages/scan/ScanPage.tsx` | The `/scan` page: scanner + resolve flow | Create |
| `src/pages/scan/ScanPage.test.tsx` | Component tests (mocked scanner + injected repo) | Create |
| `src/pages/index.ts` | Barrel export `ScanPage` | Modify |
| `src/config/routes.tsx` | `/scan` route under `RoleGate` | Modify |
| `src/config/access.test.tsx` *(or existing nav/access test)* | `routeRoles('scan')` resolves to 3 roles | Modify/Create |

---

## Task 1: Nav item + RouteId + access

**Files:**
- Modify: `src/config/nav.ts`
- Test: `src/config/access.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

Create/append `src/config/access.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { routeRoles } from './access'

describe('routeRoles(scan)', () => {
  it('allows super_admin, asset_admin, tech_admin', () => {
    expect(routeRoles('scan').sort()).toEqual(['asset_admin', 'super_admin', 'tech_admin'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/access.test.tsx`
Expected: FAIL — `routeRoles('scan')` returns `[]` (and/or TS error: `'scan'` not assignable to `RouteId`).

- [ ] **Step 3: Add `'scan'` to the `RouteId` union**

In `src/config/nav.ts`, edit the union (around lines 3-6):

```ts
export type RouteId =
  | 'dashboard' | 'assets' | 'assignments' | 'repairs' | 'licenses' | 'parts'
  | 'employees' | 'branches' | 'departments' | 'categories' | 'statuses' | 'roles'
  | 'audit' | 'settings' | 'my-assets' | 'my-acts' | 'profile' | 'pending-users'
  | 'scan'
```

- [ ] **Step 4: Add the NavItem to the `system` group**

In `ADMIN_NAV`, the `system` group (around lines 43-47), add `scan` as the FIRST item:

```ts
  { id: 'system', labelKey: 'groups.system', items: [
    { id: 'scan',          labelKey: 'items.scan',          icon: 'scan-line', allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'pending-users', labelKey: 'items.pending-users', icon: 'user-plus', allow: ['super_admin'] },
    { id: 'audit',    labelKey: 'items.audit',    icon: 'history',  allow: ['super_admin'] },
    { id: 'settings', labelKey: 'items.settings', icon: 'settings', allow: ['super_admin'] },
  ]},
```

(`routeRoles('scan')` is derived from this automatically by `config/access.ts` — no edit there.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/config/access.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify the icon name exists**

Run: `grep -rn "scan-line\|scan_line\|ScanLine" src/components/ui/icon.tsx`
Expected: a match. If `scan-line` is NOT registered in the icon map, add it (lucide `ScanLine`) following the existing entries in `icon.tsx`. If you prefer an already-present icon, use `camera` instead in Step 4.

- [ ] **Checkpoint:** `npx tsc --noEmit` → exit 0. (No commit — testing phase.)

---

## Task 2: i18n — nav label + scan namespace

**Files:**
- Modify: `src/locales/ru/nav.json`, `src/locales/en/nav.json`, `src/locales/hy/nav.json`
- Create: `src/locales/ru/scan.json`, `src/locales/en/scan.json`, `src/locales/hy/scan.json`
- Modify: `src/lib/i18n/index.ts`

- [ ] **Step 1: Add `items.scan` to each `nav.json`**

In the `items` object of each file add:

- `ru/nav.json`: `"scan": "Сканировать"`
- `en/nav.json`: `"scan": "Scan"`
- `hy/nav.json`: `"scan": "Սկան"`

- [ ] **Step 2: Create the `scan` namespace files**

`src/locales/ru/scan.json`:
```json
{
  "title": "Сканировать актив",
  "hint": "Наведите камеру на штрих-код или QR-код",
  "resolving": "Поиск актива…",
  "notFound": "Актив с кодом «{{code}}» не найден",
  "permissionDenied": "Нет доступа к камере. Разрешите доступ и повторите.",
  "cameraError": "Не удалось запустить камеру",
  "retry": "Повторить"
}
```

`src/locales/en/scan.json`:
```json
{
  "title": "Scan asset",
  "hint": "Point the camera at the barcode or QR code",
  "resolving": "Looking up asset…",
  "notFound": "No asset found for code “{{code}}”",
  "permissionDenied": "No camera access. Allow it and try again.",
  "cameraError": "Could not start the camera",
  "retry": "Retry"
}
```

`src/locales/hy/scan.json`:
```json
{
  "title": "Սկանավորել ակտիվը",
  "hint": "Ուղղեք տեսախցիկը շտրիխ կամ QR կոդին",
  "resolving": "Ակտիվի որոնում…",
  "notFound": "«{{code}}» կոդով ակտիվ չի գտնվել",
  "permissionDenied": "Տեսախցիկի հասանելիություն չկա։ Թույլատրեք և կրկնեք։",
  "cameraError": "Չհաջողվեց գործարկել տեսախցիկը",
  "retry": "Կրկնել"
}
```

- [ ] **Step 3: Register the `scan` namespace + bundle the resources**

In `src/lib/i18n/index.ts`: (a) import the three `scan.json` files following the existing import style for other namespaces; (b) add them to the `resources` object under each locale (`ru`, `en`, `hy`) following the existing pattern; (c) add `'scan'` to the `ns: [...]` array (around line 77).

- [ ] **Step 4: Verify resources load**

Run: `npx vitest run` (or the existing i18n/locale-coverage test if present)
Expected: no missing-key/namespace failures introduced.

- [ ] **Checkpoint:** `npx tsc --noEmit` → exit 0.

---

## Task 3: Install the scanner library

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install @yudiel/react-qr-scanner`
Expected: adds `@yudiel/react-qr-scanner` to `dependencies` (pulls `barcode-detector` transitively).

- [ ] **Step 2: Confirm the exported API matches this plan**

Run: `grep -rn "export" node_modules/@yudiel/react-qr-scanner/dist/index.d.ts | grep -iE "Scanner|IDetectedBarcode|useDevices"`
Expected: `Scanner` component + `IDetectedBarcode` type exported. If prop names differ from this plan (e.g. `onScan` signature, `formats`, `paused`, `constraints`, `onError`), note the actual names — Task 4 must use the installed version's exact API.

- [ ] **Checkpoint:** `npm run build` is NOT required yet; just ensure `npx tsc --noEmit` still exits 0.

---

## Task 4: `ScanPage` + route wiring

**Files:**
- Create: `src/pages/scan/ScanPage.tsx`
- Create: `src/pages/scan/ScanPage.test.tsx`
- Modify: `src/pages/index.ts`
- Modify: `src/config/routes.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/scan/ScanPage.test.tsx`. Mock the scanner so the test can fire a detection, inject a fake repo, and wrap in the providers ScanPage needs.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AssetWriteRepository } from '@/domain/asset/AssetRepository'
import type { Asset } from '@/domain/asset/types'

// --- mock the camera library: expose a hook to fire onScan from tests ---
let fireScan: (raw: string) => void = () => {}
vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: { onScan: (codes: { rawValue: string }[]) => void }) => {
    fireScan = (raw: string) => props.onScan([{ rawValue: raw }])
    return <div data-testid="scanner-mock" />
  },
}))

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateSpy,
}))

const toastSpy = vi.fn()
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: toastSpy }) }))

import { ScanPage } from './ScanPage'

const ASSET: Asset = {
  id: 'a_005', categoryId: 'cat_lap', brand: 'Dell', model: 'Latitude', invCode: 'LAP/00123',
  serial: 'SN1', statusId: 'st_assigned', assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-06-01T00:00:00.000Z',
}
function repoWith(found: Asset | null): AssetWriteRepository {
  return { findByInvCode: vi.fn(async () => found) } as unknown as AssetWriteRepository
}

beforeEach(() => { navigateSpy.mockClear(); toastSpy.mockClear() })

describe('ScanPage', () => {
  it('found: navigates to the asset detail page', async () => {
    render(<MemoryRouter><ScanPage repository={repoWith(ASSET)} /></MemoryRouter>)
    fireScan('LAP/00123')
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets/a_005'))
  })

  it('not found: shows a toast and does not navigate', async () => {
    render(<MemoryRouter><ScanPage repository={repoWith(null)} /></MemoryRouter>)
    fireScan('NOPE/00000')
    await waitFor(() => expect(toastSpy).toHaveBeenCalled())
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('fires resolution only once even if onScan fires twice rapidly', async () => {
    const repo = repoWith(ASSET)
    render(<MemoryRouter><ScanPage repository={repo} /></MemoryRouter>)
    fireScan('LAP/00123'); fireScan('LAP/00123')
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1))
    expect(repo.findByInvCode).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/scan/ScanPage.test.tsx`
Expected: FAIL — `ScanPage` does not exist.

- [ ] **Step 3: Implement `ScanPage`**

Create `src/pages/scan/ScanPage.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Scanner } from '@yudiel/react-qr-scanner'
import { db } from '@/lib/firebase'
import { FirestoreAssetRepository } from '@/infra/repositories/firestoreAssetRepository'
import type { AssetWriteRepository } from '@/domain/asset/AssetRepository'
import { PageHeader } from '@/components/ui/page-header'
import { SectionCard } from '@/components/ui/section-card'
import { useToast } from '@/contexts/ToastContext'

export interface ScanPageProps {
  /** Test seam — production builds the Firestore repo lazily. */
  repository?: AssetWriteRepository
}

export function ScanPage({ repository }: ScanPageProps) {
  const { t } = useTranslation(['scan', 'nav'])
  const navigate = useNavigate()
  const { showToast } = useToast()

  const defaultRepo = useMemo<AssetWriteRepository>(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false) // guards against multiple onScan fires per detection

  async function handleScan(codes: { rawValue: string }[]) {
    const code = codes[0]?.rawValue?.trim()
    if (!code || busy.current) return
    busy.current = true
    setResolving(true)
    try {
      const asset = await repo.findByInvCode(code)
      if (asset) {
        navigate(`/assets/${asset.id}`)
        return // keep busy=true; we're leaving the page
      }
      showToast(t('notFound', { ns: 'scan', code }))
    } catch {
      showToast(t('cameraError', { ns: 'scan' }))
    } finally {
      // re-enable scanning only when we stayed on the page (not found / error)
      busy.current = false
      setResolving(false)
    }
  }

  return (
    <div>
      <PageHeader icon="scan-line" title={t('title', { ns: 'scan' })} />
      <SectionCard noHeader>
        {error ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-text-secondary text-sm">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold"
            >
              {t('retry', { ns: 'scan' })}
            </button>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="relative overflow-hidden rounded-xl bg-black aspect-square">
              <Scanner
                formats={['code_128', 'qr_code']}
                onScan={handleScan}
                onError={() => setError(t('permissionDenied', { ns: 'scan' }))}
                paused={resolving}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-text-secondary">
              {resolving ? t('resolving', { ns: 'scan' }) : t('hint', { ns: 'scan' })}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
```

> NOTE: If Task 3 Step 2 revealed different prop names for `<Scanner>` (e.g. `onScan` returns objects without `rawValue`, or `formats` uses different format strings), adapt this JSX and the test's mock to the installed API. The `code_128` / `qr_code` format strings are the @yudiel v2 names.

- [ ] **Step 4: Export from the pages barrel**

In `src/pages/index.ts` add (near the other asset/page exports):

```ts
export * from './scan/ScanPage'
```

- [ ] **Step 5: Wire the route**

In `src/config/routes.tsx`: add `ScanPage` to the `@/pages` import list, then add this route inside `<ShellLayout>` (e.g. just before the `/settings` route):

```tsx
          <Route
            path="/scan"
            element={
              <RoleGate roles={routeRoles('scan')}>
                <ScanPage />
              </RoleGate>
            }
          />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/pages/scan/ScanPage.test.tsx`
Expected: PASS (all 3 cases).

- [ ] **Checkpoint:** `npx tsc --noEmit` → exit 0; `npx vitest run` → no new failures.

---

## Task 5: Manual verification (real camera)

- [ ] **Step 1:** Run `npm run dev`, open the app on a phone (or desktop webcam) over HTTPS/localhost.
- [ ] **Step 2:** Log in as `super_admin` (or `asset_admin`/`tech_admin`) → confirm «Система → Сканировать» appears in the navbar and opens `/scan`.
- [ ] **Step 3:** Grant camera permission; point at a Code 128 of a known `invCode`. Confirm it navigates to that asset's detail page with full history.
- [ ] **Step 4:** Scan an unknown code → confirm the «не найден» toast and that scanning resumes.
- [ ] **Step 5:** Deny camera permission → confirm the friendly error + retry, no blank screen.
- [ ] **Step 6 (iOS):** Repeat Step 3 on an iPhone (Safari) to confirm the WASM fallback path works.

---

## Self-review notes

- **Spec coverage:** nav item (T1), route+page+resolve+navigate+not-found (T4), iOS support (library choice, verified manually T5), i18n ru/en/hy (T2), access roles (T1), reuse of existing AssetDetailPage (T4 navigates, builds no modal), repo method (pre-req, verified). ✔
- **No commits:** intentional — testing phase. Re-add commit steps when the owner lifts the freeze.
- **Library API risk:** Task 3 Step 2 + the NOTE in T4 Step 3 force reconciliation with the installed package's exact API, so the plan can't silently drift from reality.
