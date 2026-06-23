# License Block — Mandatory Display (No Empty State) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the asset-detail license block always render a license card (matching the prototype layout), removing the "Лицензия не привязана" / "Добавить лицензию" empty state entirely, with OEM-type displaying «OEM» and legacy/missing-license doc falling back to a default «OEM» display card.

**Architecture:** Three display states replace the old "no-license" empty state: (1) Retail license — shows product name + key + «Копировать» button; (2) OEM license — shows product name + literal «OEM» text (no copy); (3) Legacy/no license doc — shows a static default card with «OEM» (display-only, no data write). TechSpecsCard visibility logic is updated so it always shows the license section for hasOemLicense categories. All tests for the attach/empty states are replaced with tests covering the three new display states.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, shadcn/ui, react-i18next (ru only), vitest + @testing-library/react

---

## Current State Summary

**Files to change:**
- `src/components/features/assets/detail/LicenseBlock.tsx` — primary component rebuild
- `src/components/features/assets/detail/TechSpecsCard.tsx` — update `showLicenseSection` visibility logic
- `src/pages/AssetDetailPage.tsx` — update condition guarding TechSpecsCard render  
- `src/locales/ru/assets.json` — add `detail.license.oemKey` key (`"OEM"`); remove or keep `none`/`add` (keep for safety — i18n keys are cheap)
- `src/pages/AssetDetailPage.license.test.tsx` — update/replace license tests

**Key existing facts:**
- `LicenseBlock` already has the correct bound-license card (MS logo SVG + name + chip + key line + Копировать button) — this layout is KEPT as-is for Retail.
- OEM currently shows `t('detail.license.builtIn')` = «Встроен в BIOS» — this must change to literal «OEM» text.
- The "no license" branches (lines 198–236 in LicenseBlock.tsx) render either `null`, a muted text span, or the attach panel — ALL three must be replaced with a single default «OEM» display card.
- `TechSpecsCard.showLicenseSection` only renders the license section when `licenses.length > 0 || hasAttachAffordance`. For the legacy fallback (no license doc, hasOemLicense category), neither condition is true → license section is hidden. This must change.
- `AssetDetailPage` guards the whole `TechSpecsCard` with `caps?.hasSpecs || canManageLicense || licenses.length > 0`. Must add `caps?.hasOemLicense` to ensure the specs card (and license section) renders for hasOemLicense categories even when no license is attached yet.

---

## File Map

| File | Change |
|---|---|
| `src/components/features/assets/detail/LicenseBlock.tsx` | Rebuild: remove empty/attach states; add OEM key display; add legacy fallback card |
| `src/components/features/assets/detail/TechSpecsCard.tsx` | Update `showLicenseSection` — always show for hasOemLicense cap |
| `src/pages/AssetDetailPage.tsx` | Pass `caps` down; update TechSpecsCard guard condition |
| `src/locales/ru/assets.json` | Add `detail.license.oemKey: "OEM"` |
| `src/pages/AssetDetailPage.license.test.tsx` | Update tests: remove attach/empty-state tests; add 3 display-state tests |

---

## Task 1: Add i18n key `detail.license.oemKey`

**Files:**
- Modify: `src/locales/ru/assets.json`

- [ ] **Step 1: Read the license section and add the new key**

Open `src/locales/ru/assets.json`. Find the `"detail.license"` object (around line 279). Add one key immediately after `"builtIn"`:

```json
"oemKey": "OEM",
```

The block should look like:
```json
"license": {
  "none": "Лицензия не привязана",
  "builtIn": "Встроен в BIOS",
  "oemKey": "OEM",
  "oem": "OEM",
  "retail": "Retail",
  ...
}
```

Note: `"oem"` is the chip label (already «OEM»), `"oemKey"` is the key-position text. We add a dedicated key so semantics are clear, even though the value is the same string.

- [ ] **Step 2: Verify JSON is still valid**

Run:
```
npx --yes json-validator src/locales/ru/assets.json
```
Or simply run `npm run typecheck` in Task 5 — a malformed JSON will surface there.

---

## Task 2: Rebuild `LicenseBlock.tsx`

**Files:**
- Modify: `src/components/features/assets/detail/LicenseBlock.tsx`

The three new display states:
1. **Retail license** (`lic` exists, `lic.type !== 'OEM'`): MS logo + name + Retail chip + key line + Копировать (gated: canCopy && hasKey===true). No changes from existing code.
2. **OEM license** (`lic` exists, `lic.type === 'OEM'`): MS logo + name + OEM chip + `«OEM»` text in key position. No copy button. Change: replace `t('detail.license.builtIn')` («Встроен в BIOS») with `t('detail.license.oemKey')` («OEM»).
3. **Legacy / no license doc** (`!lic`): Default display card. MS logo + «Windows» as default product name + «OEM» text in key position. Static, read-only. No copy, no attach button. This replaces ALL the old "no license" branches.

The `LicenseAttachPanel`, `AttachChoice`, `onAttach`, `canManage`, `pool`, `busy` props are **removed** from `LicenseBlock` — the attach flow lives in the Licenses module, not here.

- [ ] **Step 1: Write the new LicenseBlock.tsx**

Replace the entire file content at `src/components/features/assets/detail/LicenseBlock.tsx` with:

```tsx
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import { Chip, Btn, Icon } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { revealLicenseKey } from '@/lib/licenses/revealKey'

// ---------------------------------------------------------------------------
// Public type — kept for backward-compat exports (TechSpecsCard / tests)
// ---------------------------------------------------------------------------

export type AttachChoice =
  | { kind: 'existing'; licenseId: string }
  | { kind: 'new-key'; rawKey: string }
  | { kind: 'oem-digital' }

// ---------------------------------------------------------------------------
// Props — attach props removed; block is always display-only.
// onAttach / canManage / pool / busy are kept as optional no-ops so callers
// do not need an immediate signature change, but are not used.
// ---------------------------------------------------------------------------

interface LicenseBlockProps {
  asset: Asset
  licenses: WorkstationLicense[]
  /** @deprecated No longer used — license management lives in the Licenses module */
  canManage?: boolean
  /** @deprecated No longer used */
  onAttach?: (choice: AttachChoice) => Promise<void> | void
  /** @deprecated No longer used */
  pool?: { id: string; name: string; vendor: string | null }[]
  /** @deprecated No longer used */
  busy?: boolean
}

// ---------------------------------------------------------------------------
// Microsoft logo SVG — shared by all three display states
// ---------------------------------------------------------------------------

function MsLogo() {
  return (
    <div className="w-11 h-11 rounded-lg bg-[#0F1620] border border-[#2A2F36] inline-flex items-center justify-center shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
        <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
        <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
        <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LicenseBlock({
  asset,
  licenses,
  // deprecated props accepted but unused
  canManage: _canManage,
  onAttach: _onAttach,
  pool: _pool,
  busy: _busy,
}: LicenseBlockProps) {
  const { t } = useTranslation('assets')
  const { role } = useAuth()

  // Copy / reveal state for the bound-license Retail card
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  // null = probing, true = key exists, false = key absent
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
  }, [])

  const lic = licenses.filter(l => l.assignedToAssetId === asset.id)[0]

  // ---------------------------------------------------------------------------
  // Lazy probe: for a non-OEM bound license, attempt one reveal on mount when
  // the current user has copy access (super_admin / tech_admin).
  // ---------------------------------------------------------------------------
  const canCopyForProbe = role === 'super_admin' || role === 'tech_admin'

  useEffect(() => {
    if (!lic || lic.type === 'OEM' || !canCopyForProbe) {
      if (lic && lic.type !== 'OEM') setHasKey(true)
      return
    }

    let cancelled = false

    async function probe() {
      try {
        const key = await revealLicenseKey('licenses', lic!.id)
        if (!cancelled) {
          setRevealedKey(key)
          setHasKey(true)
        }
      } catch {
        if (!cancelled) {
          setHasKey(false)
        }
      }
    }

    void probe()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lic?.id, canCopyForProbe])

  async function handleCopy() {
    if (!lic) return
    setCopyError(false)
    try {
      const key = revealedKey ?? await revealLicenseKey('licenses', lic.id)
      if (!revealedKey) setRevealedKey(key)
      await navigator.clipboard.writeText(key)
      setCopied(true)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyError(true)
    }
  }

  // ---- STATE 1 & 2: Bound license (Retail or OEM) -------------------------
  if (lic) {
    const isOem = lic.type === 'OEM'
    const canCopy = role === 'super_admin' || role === 'tech_admin'

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#111315] border border-[#2A2F36]">
          <MsLogo />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[15.5px] font-semibold text-[#F8FAFC] truncate leading-tight">{lic.name}</span>
              {isOem
                ? <Chip color="indigo">{t('detail.license.oem')}</Chip>
                : <Chip color="blue">{t('detail.license.retail')}</Chip>
              }
            </div>
            {isOem
              ? (
                // STATE 2: OEM → literal «OEM» in key position (not «Встроен в BIOS»)
                <span className="text-[13px] text-[#94A3B8] italic">{t('detail.license.oemKey')}</span>
              )
              : (
                // STATE 1: Retail → key line
                <div>
                  {copyError && (
                    <p className="mt-0.5 text-[11px] text-[#FDA4AF]">{t('detail.license.copyFailed')}</p>
                  )}
                  {!copyError && revealedKey !== null && (
                    <p className="mt-0.5 text-[13.5px] font-mono text-[#CBD5E1] tracking-wider truncate select-all">{revealedKey}</p>
                  )}
                  {!copyError && hasKey === false && revealedKey === null && (
                    <p className="mt-0.5 text-[13px] text-[#64748B] italic">{t('detail.license.keyAbsent')}</p>
                  )}
                </div>
              )
            }
          </div>

          {/* Copy button — super_admin OR tech_admin, non-OEM, key confirmed present */}
          {!isOem && canCopy && hasKey === true && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? t('detail.license.copied') : t('detail.license.copy')}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 max-md:h-11 px-3 rounded-lg text-[12.5px] font-medium border transition-colors ${
                copied
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#22272E] border-[#2A2F36] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3A4048]'
              }`}
            >
              <Icon name={copied ? 'check' : 'copy'} size={13} />
              {copied ? t('detail.license.copied') : t('detail.license.copy')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- STATE 3: No license doc (legacy asset) — default display card --------
  // Display-only; does NOT write any data. Never shows attach button.
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-[#111315] border border-[#2A2F36]">
        <MsLogo />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15.5px] font-semibold text-[#F8FAFC] truncate leading-tight">Windows</span>
            <Chip color="indigo">{t('detail.license.oem')}</Chip>
          </div>
          <span className="text-[13px] text-[#94A3B8] italic">{t('detail.license.oemKey')}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file was written correctly**

Read back lines 1–10 to confirm the import block is intact, and lines 195–220 to confirm the legacy fallback renders (no attach button).

---

## Task 3: Update `TechSpecsCard.tsx` — always show license section for hasOemLicense

**Files:**
- Modify: `src/components/features/assets/detail/TechSpecsCard.tsx`

The current guard:
```ts
const hasAttachAffordance = Boolean(onAttachLicense && canManageLicense)
const showLicenseSection = licenses.length > 0 || hasAttachAffordance
```

Problem: for a legacy asset with no license doc, `licenses.length === 0` and `hasAttachAffordance` is false (we removed attach affordances from LicenseBlock). The section is hidden. We need to show it whenever the category has OEM license capability.

Solution: pass `hasOemLicenseCap` (boolean) from `AssetDetailPage` into `TechSpecsCard`, and use it in the `showLicenseSection` guard.

- [ ] **Step 1: Add `hasOemLicenseCap` prop to TechSpecsCard**

In `TechSpecsCard.tsx`, find the `TechSpecsCardProps` interface. Add the new prop:

```ts
interface TechSpecsCardProps {
  asset: Asset
  licenses: WorkstationLicense[]
  copyEnabled?: boolean
  partsNote?: boolean
  /** Pass true when the asset category has hasOemLicense capability. */
  hasOemLicenseCap?: boolean
  canManageLicense?: boolean
  onAttachLicense?: (choice: AttachChoice) => Promise<void> | void
  licensePool?: { id: string; name: string; vendor: string | null }[]
  licenseBusy?: boolean
}
```

- [ ] **Step 2: Use `hasOemLicenseCap` in the `showLicenseSection` guard**

In the `TechSpecsCard` function body, find:
```ts
const hasAttachAffordance = Boolean(onAttachLicense && canManageLicense)
const showLicenseSection = licenses.length > 0 || hasAttachAffordance
```

Replace with:
```ts
const hasAttachAffordance = Boolean(onAttachLicense && canManageLicense)
const showLicenseSection = licenses.length > 0 || hasAttachAffordance || Boolean(hasOemLicenseCap)
```

Also destructure the new prop in the function signature (add `hasOemLicenseCap = false`):
```ts
export function TechSpecsCard({
  asset,
  licenses,
  copyEnabled = true,
  partsNote = true,
  hasOemLicenseCap = false,
  canManageLicense = false,
  onAttachLicense,
  licensePool,
  licenseBusy = false,
}: TechSpecsCardProps) {
```

- [ ] **Step 3: Update `showEmptyPlaceholder` guard**

The existing guard:
```ts
const showEmptyPlaceholder = lines.length === 0 && licenses.length === 0 && !hasAttachAffordance
```

Update to:
```ts
const showEmptyPlaceholder = lines.length === 0 && licenses.length === 0 && !hasAttachAffordance && !hasOemLicenseCap
```

This prevents the "Нет характеристик" placeholder from appearing for an asset that has no specs yet but does have OEM license capability.

---

## Task 4: Update `AssetDetailPage.tsx` — pass `hasOemLicenseCap` and fix TechSpecsCard guard

**Files:**
- Modify: `src/pages/AssetDetailPage.tsx`

Two changes needed:

1. The condition guarding when `TechSpecsCard` is rendered (line ~407):
   ```tsx
   {(caps?.hasSpecs || canManageLicense || licenses.length > 0) ? (
   ```
   Must include `caps?.hasOemLicense` so that a legacy asset with hasOemLicense category (but no license doc and no specs) still renders the TechSpecsCard:
   ```tsx
   {(caps?.hasSpecs || canManageLicense || licenses.length > 0 || caps?.hasOemLicense) ? (
   ```

2. Pass `hasOemLicenseCap={Boolean(caps?.hasOemLicense)}` to `TechSpecsCard`:
   ```tsx
   <TechSpecsCard
     asset={asset}
     licenses={licenses}
     hasOemLicenseCap={Boolean(caps?.hasOemLicense)}
     canManageLicense={canManageLicense}
     onAttachLicense={onAttachLicense}
     licensePool={licensePool}
     licenseBusy={busy}
   />
   ```

- [ ] **Step 1: Update the TechSpecsCard render guard**

In `AssetDetailPage.tsx`, find the line (around 407):
```tsx
{(caps?.hasSpecs || canManageLicense || licenses.length > 0) ? (
```

Change it to:
```tsx
{(caps?.hasSpecs || canManageLicense || licenses.length > 0 || caps?.hasOemLicense) ? (
```

- [ ] **Step 2: Pass `hasOemLicenseCap` to TechSpecsCard**

Find the `<TechSpecsCard` JSX block. Add the new prop:
```tsx
<TechSpecsCard
  asset={asset}
  licenses={licenses}
  hasOemLicenseCap={Boolean(caps?.hasOemLicense)}
  canManageLicense={canManageLicense}
  onAttachLicense={onAttachLicense}
  licensePool={licensePool}
  licenseBusy={busy}
/>
```

---

## Task 5: Update tests in `AssetDetailPage.license.test.tsx`

**Files:**
- Modify: `src/pages/AssetDetailPage.license.test.tsx`

**Changes required:**

Tests to REMOVE (assert behaviors we're deleting):
- `ATTACH NEW KEY` (test `a`) — was testing "Добавить лицензию" flow → remove
- `ATTACH EXISTING` (test `b`) — same → remove
- `ATTACH OEM-DIGITAL` (test `c`) — same → remove
- `BOUND OEM: «Встроен в BIOS»` (test `d2`) — OEM now shows «OEM», not «Встроен в BIOS» → update
- `PERMISSION: asset_admin` (test `e`) — assert no «Добавить лицензию» → keep but rephrase

Tests to KEEP (display card assertions):
- `BOUND RETAIL (key exists)` (test `d`) — Retail shows key + «Копировать» → keep as-is
- `BOUND RETAIL (no key)` (test `d1`) — probe throws → «Ключ не задан» shown → keep as-is

Tests to ADD:
- `BOUND OEM (updated)` — OEM license shows «OEM» text (not «Встроен в BIOS»), no «Копировать»
- `LEGACY NO LICENSE DOC` — asset with hasOemLicense category but no license doc bound → default card renders «OEM» text, no «Добавить лицензию» button
- `PERMISSION: asset_admin` — update: assert no «Добавить лицензию» button AND a legacy asset with OEM category still renders the OEM default card

- [ ] **Step 1: Remove ATTACH tests a, b, c (lines 188–352)**

Delete the three test blocks:
- `ATTACH NEW KEY` (it block starting line 188)
- `ATTACH EXISTING` (it block starting line 241)
- `ATTACH OEM-DIGITAL` (it block starting line 318)

These three together test the attach panel flow which no longer lives in LicenseBlock.

- [ ] **Step 2: Update the BOUND OEM test (was «Встроен в BIOS», now «OEM»)**

Find the test:
```ts
it('BOUND OEM: an OEM-digital license renders «Встроен в BIOS» + OEM chip, no «Копировать», no «Открепить»', ...
```

Update it:
```ts
it('BOUND OEM: an OEM-digital license renders «OEM» text in key position, no «Копировать», no «Открепить»', async () => {
  const store    = createInMemoryAuditStore()
  const auditCtx = inMemoryAuditContext(store)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
  const assetRepo   = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

  const { value: asset } = await assetRepo.createAsset(
    {
      categoryId: 'cat_laptop', brand: 'Dell', model: 'OptiPlex',
      invCode: '450/LIC4', serial: 'SN-LIC4',
      assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  await licenseRepo.createLicense(
    {
      name: 'OEM — Dell OptiPlex', type: 'OEM', isReusable: false,
      assign: { to: 'device', assetId: asset.id },
    },
    { uid: 'u1', role: 'asset_admin' },
  )

  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={makeAuth('super_admin')}>
        <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
          <Routes>
            <Route
              path="/assets/:id"
              element={
                <AssetDetailPage
                  repository={assetRepo}
                  licenseRepository={licenseRepo}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )

  await waitFor(() => screen.getByText(/450\/LIC4/))

  // Wait for license section to render
  await waitFor(() => screen.getByText('OEM — Dell OptiPlex'))

  // OEM-digital shows «OEM» in the key position (NOT «Встроен в BIOS»)
  // Find at least one element with exact text «OEM» (the chip label also says «OEM»,
  // so use getAllByText and assert length >= 1)
  expect(screen.getAllByText('OEM').length).toBeGreaterThanOrEqual(1)
  // «Встроен в BIOS» must NOT appear
  expect(screen.queryByText(/Встроен в BIOS/i)).toBeNull()
  // No copy button
  expect(screen.queryByRole('button', { name: /Копировать/i })).toBeNull()
  // No attach button
  expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
}, 20000)
```

- [ ] **Step 3: Add LEGACY NO LICENSE DOC test**

Add this test after the updated BOUND OEM test:

```ts
it('LEGACY (no license doc): hasOemLicense category with no license bound → renders default OEM card, NO «Добавить лицензию»', async () => {
  // Asset has hasOemLicense category but no license attached yet (legacy / pre-coupling scenario)
  const { asset } = await seedAndRender({ role: 'super_admin' })
  // seedAndRender creates asset on cat_laptop (hasOemLicense=true) with no license seeded

  await waitFor(() => screen.getByText(/450\/LIC1/))

  // The license block must render the default OEM card — showing «OEM» text
  // (could be the chip label, the key-position text, or both)
  const oemTexts = await screen.findAllByText('OEM')
  expect(oemTexts.length).toBeGreaterThanOrEqual(1)

  // No «Добавить лицензию» button — the attach flow is gone from this block
  expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
  // No «Лицензия не привязана» text — the empty state is removed
  expect(screen.queryByText(/Лицензия не привязана/i)).toBeNull()
}, 20000)
```

- [ ] **Step 4: Update PERMISSION asset_admin test**

The existing test (test `e`) only asserts no «Добавить лицензию». Update to also assert the OEM default card IS shown (the block is no longer hidden for asset_admin read-only role):

```ts
it('PERMISSION: asset_admin role — no «Добавить лицензию» button; default OEM card renders (read-only)', async () => {
  await seedAndRender({ role: 'asset_admin' })

  await waitFor(() => screen.getByText(/450\/LIC1/))

  // No attach button — asset_admin cannot manage licenses
  expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
  // No detach button
  expect(screen.queryByRole('button', { name: /Открепить/i })).toBeNull()
  // The default OEM card renders (license section IS shown even for read-only role)
  const oemTexts = await screen.findAllByText('OEM')
  expect(oemTexts.length).toBeGreaterThanOrEqual(1)
}, 15000)
```

- [ ] **Step 5: Update PERMISSION employee test similarly**

```ts
it('PERMISSION: employee role — no «Добавить лицензию» button; default OEM card renders (read-only)', async () => {
  await seedAndRender({ role: 'employee' })

  await waitFor(() => screen.getByText(/450\/LIC1/))

  expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
  // Default OEM card renders
  const oemTexts = await screen.findAllByText('OEM')
  expect(oemTexts.length).toBeGreaterThanOrEqual(1)
}, 15000)
```

---

## Task 6: Typecheck + Build + Full Test Run

- [ ] **Step 1: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0 with no errors. If TypeScript errors appear, they will likely be:
- TechSpecsCard missing `hasOemLicenseCap` prop → verify Task 3 Step 1 was applied
- `LicenseBlock` deprecated props being passed in TechSpecsCard → they are optional, TypeScript should accept

- [ ] **Step 2: Run build**

```
cd C:/Users/DELL/Desktop/assets-crm && npm run build
```

Expected: exit 0. Last lines should include `✓ built in X.Xs`.

- [ ] **Step 3: Run full test suite**

```
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run 2>&1 | tail -30
```

Expected: no new test failures beyond the known baseline (~130 files / ~1441 tests). If `AssetDetailPage.license.test.tsx` fails, read the failure message and fix.

- [ ] **Step 4: If a test fails in isolation, run it alone**

```
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run src/pages/AssetDetailPage.license.test.tsx 2>&1 | tail -40
```

---

## Task 7: Verify the three display states in your head

Walk through the rendered output for each state mentally:

**State 1 — Retail license (`lic.type !== 'OEM'`, key exists):**
- MS 4-square logo shown
- `lic.name` (e.g., «Windows 11 Pro») shown as bold heading
- «Retail» chip shown in blue
- Full key revealed via probe → displayed in monospace
- «Копировать» button shown (super_admin/tech_admin only)
- No «Добавить лицензию» button

**State 2 — OEM license (`lic.type === 'OEM'`):**
- MS 4-square logo shown
- `lic.name` shown as bold heading
- «OEM» chip shown in indigo
- Italic «OEM» text in key position (NOT «Встроен в BIOS»)
- No «Копировать» button
- No «Добавить лицензию» button

**State 3 — Legacy / no license doc (`!lic`):**
- MS 4-square logo shown
- «Windows» as default product name (bold heading)
- «OEM» chip shown in indigo
- Italic «OEM» text in key position
- No «Копировать» button
- No «Добавить лицензию» button
- No «Лицензия не привязана» text

---

## Self-Review Checklist

**Spec coverage:**
- [x] License is mandatory — no "no license" scenario → State 3 (legacy fallback) always renders
- [x] Prototype card layout: MS logo + product name + key line + Копировать → matched in State 1
- [x] Retail → key + Копировать → State 1
- [x] OEM → «OEM» (not «Встроен в BIOS») → State 2
- [x] Legacy / no license doc → default «OEM» card (display-only) → State 3
- [x] No «Добавить лицензию» anywhere on asset detail → all attach branches removed
- [x] Copy/reveal gated to super_admin/tech_admin → unchanged (canCopy logic kept)
- [x] No Cloud Functions for copy/reveal → revealLicenseKey reads Firestore directly, unchanged
- [x] RUSSIAN ONLY — only `src/locales/ru/assets.json` touched → ✓
- [x] No Firebase SDK imports in component → no direct imports added
- [x] Tests: remove attach assertions, add Retail/OEM/Legacy display state assertions → Task 5

**Potential issues:**
- `seedAndRender` in the test file originally expected no license doc AND showed «Добавить лицензию». After removing attach tests a/b/c, `seedAndRender` is still used for the LEGACY and PERMISSION tests — it creates an asset with no license, which is exactly the legacy state. No changes to `seedAndRender` needed.
- The `onPersistOemSecret` param in `seedAndRender` signature is no longer exercised by any test. Leave it in place — TypeScript will not complain about an optional unused param, and removing it would break the helper's type signature unnecessarily.
