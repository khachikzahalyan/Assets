# Asset Barcode (generate + print) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **TESTING PHASE — NO GIT.** Do NOT `git add` / `git commit` / `git push`. Each task ends with a **verification checkpoint** (tests/typecheck), NOT a commit. A subagent previously committed and made out-of-scope edits — after EACH implementer, the controller runs full `git status` + `git diff`, reverts stray files (`git restore`), and surgically strips creep. Keep every brief tightly scoped.

**Goal:** Generate a unique numeric `barcode` for every asset at creation, print a Code 128 label immediately after «Создать» (and on demand from the detail page), and make `/scan` resolve assets by that barcode.

**Architecture:** A new optional `Asset.barcode` field generated atomically inside the write repository (with triple invCode/serial/barcode uniqueness). Labels render Code 128 via `jsbarcode` in a `Barcode128` component, composed into an `AssetLabel`, printed through a portal-based `LabelPrintHost` + `@media print` CSS. `AssetCreatePage` triggers the print after create; `AssetDetailPage` offers reprint; `ScanPage` resolves barcode-first.

**Tech Stack:** React 19, TS strict, Vite, Firebase/Firestore (repository pattern), react-i18next, Tailwind/shadcn, jsbarcode, vitest + @testing-library/react.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/domain/asset/types.ts` | add optional `barcode?: string \| null` to `Asset` | Modify |
| `src/domain/asset/barcode.ts` | `generateBarcodeCandidate()` + `allocateUniqueBarcode()` | Create |
| `src/domain/asset/barcode.test.ts` | unit tests for the helpers | Create |
| `src/domain/asset/AssetRepository.ts` | add `isBarcodeTaken` + `findByBarcode` to `AssetWriteRepository` | Modify |
| `src/infra/repositories/firestoreAssetRepository.ts` | impl methods + map barcode + generate in `createAsset` | Modify |
| `src/infra/repositories/inMemoryAssetRepository.ts` | impl methods + generate in `createAsset` | Modify |
| `src/infra/repositories/inMemoryAssetRepository.test.ts` | barcode tests | Modify |
| `src/components/features/assets/label/Barcode128.tsx` | Code 128 SVG renderer | Create |
| `src/components/features/assets/label/Barcode128.test.tsx` | renderer test | Create |
| `src/components/features/assets/label/AssetLabel.tsx` | one printable label | Create |
| `src/components/features/assets/label/LabelPrintHost.tsx` | portal + `window.print()` orchestration | Create |
| `src/index.css` | `@media print` rules for the label root | Modify |
| `src/pages/assets/AssetCreatePage.tsx` | trigger print after single/group create | Modify |
| `src/pages/assets/AssetDetailPage.tsx` | «Печать наклейки» reprint action | Modify |
| `src/pages/scan/ScanPage.tsx` | barcode-first resolution | Modify |
| `src/pages/scan/ScanPage.test.tsx` | barcode-first test | Modify |
| `src/locales/{ru,en,hy}/assets.json` | label i18n keys | Modify |
| `package.json` / `package-lock.json` | `jsbarcode` + `@types/jsbarcode` | Modify |

---

## Task 1: Domain — `barcode` field, generator helper, repo signatures

**Files:** Modify `src/domain/asset/types.ts`, `src/domain/asset/AssetRepository.ts`; Create `src/domain/asset/barcode.ts`, `src/domain/asset/barcode.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/asset/barcode.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { generateBarcodeCandidate, allocateUniqueBarcode } from './barcode'

describe('generateBarcodeCandidate', () => {
  it('returns a 9-digit numeric string with a non-zero first digit', () => {
    for (let i = 0; i < 200; i++) {
      const c = generateBarcodeCandidate()
      expect(c).toMatch(/^[1-9]\d{8}$/)
    }
  })
})

describe('allocateUniqueBarcode', () => {
  it('returns the first candidate that is not taken', async () => {
    const taken = vi.fn(async (c: string) => false)
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{8}$/)
    expect(taken).toHaveBeenCalledTimes(1)
  })

  it('retries while taken, then returns a free one', async () => {
    let calls = 0
    const taken = vi.fn(async () => (++calls < 3)) // taken twice, then free
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{8}$/)
    expect(taken).toHaveBeenCalledTimes(3)
  })

  it('throws if it cannot find a free code within the cap', async () => {
    const taken = vi.fn(async () => true) // always taken
    await expect(allocateUniqueBarcode(taken)).rejects.toThrow(/unique barcode/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/asset/barcode.test.ts`
Expected: FAIL — module `./barcode` not found.

- [ ] **Step 3: Implement the helper**

Create `src/domain/asset/barcode.ts`:
```ts
/** A new asset barcode: a 9-digit numeric string, first digit 1-9 (e.g. "100309088"). */
export function generateBarcodeCandidate(): string {
  // 100000000 .. 999999999 inclusive → always 9 digits, non-zero leading digit.
  const n = 100_000_000 + Math.floor(Math.random() * 900_000_000)
  return String(n)
}

/**
 * Generates a unique barcode by probing `isTaken` until a free candidate is found.
 * Throws if no free value is found within `maxAttempts` (practically never — 900M space).
 */
export async function allocateUniqueBarcode(
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateBarcodeCandidate()
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error('Could not allocate a unique barcode after multiple attempts')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/asset/barcode.test.ts`
Expected: PASS (4 assertions/blocks).

- [ ] **Step 5: Add the field + repo signatures**

In `src/domain/asset/types.ts`, add to the `Asset` interface (near `serial`), as an OPTIONAL field to avoid a wide blast radius on existing `Asset` literals:
```ts
  /** System-generated unique numeric barcode (Code 128 label). Optional: null/absent for legacy assets. */
  barcode?: string | null
```

In `src/domain/asset/AssetRepository.ts`, add to `AssetWriteRepository` (right after `findByInvCode`):
```ts
  /** Resolves the first asset whose `barcode` equals the argument, or `null`. */
  findByBarcode(barcode: string): Promise<Asset | null>
  /** True if any OTHER asset already uses this barcode. */
  isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean>
```

- [ ] **Step 6: Verify typecheck surfaces the missing impls (expected) but the helper compiles**

Run: `npx vitest run src/domain/asset/barcode.test.ts` → still PASS.
Run: `npx tsc --noEmit` → EXPECTED to FAIL now, complaining that `FirestoreAssetRepository` / `InMemoryAssetRepository` do not implement `findByBarcode` / `isBarcodeTaken`. That is fixed in Task 2. (Do not proceed to commit; this is an intermediate state.)

- [ ] **Checkpoint:** barcode.test green; tsc failure is limited to the two repo classes missing the new methods.

---

## Task 2: Repository impls — barcode methods + generation in `createAsset`

**Files:** Modify `src/infra/repositories/firestoreAssetRepository.ts`, `src/infra/repositories/inMemoryAssetRepository.ts`, `src/infra/repositories/inMemoryAssetRepository.test.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/infra/repositories/inMemoryAssetRepository.test.ts` (mirror the existing `repo()` helper + fixtures already in this file):
```ts
describe('InMemoryAssetRepository — barcode', () => {
  const actor = { uid: 'u1', role: 'asset_admin' as const }
  const baseInput = {
    categoryId: 'cat_lap', brand: 'Dell', model: 'X', type: null,
    serial: null, assignment: null, branchId: 'br_main', deptId: null,
  }

  it('createAsset assigns a unique 9-digit barcode', async () => {
    const r = await repo().createAsset({ ...baseInput, invCode: 'LAP/90001' }, actor)
    expect(r.value.barcode).toMatch(/^[1-9]\d{8}$/)
  })

  it('createAssetsBatch assigns distinct barcodes to each asset', async () => {
    const created = await repo().createAssetsBatch([
      { ...baseInput, invCode: 'LAP/90010', serial: null },
      { ...baseInput, invCode: 'LAP/90011', serial: null },
      { ...baseInput, invCode: 'LAP/90012', serial: null },
    ], actor)
    const codes = created.map(a => a.barcode)
    expect(new Set(codes).size).toBe(3)
    codes.forEach(c => expect(c).toMatch(/^[1-9]\d{8}$/))
  })

  it('findByBarcode + isBarcodeTaken resolve a created barcode', async () => {
    const r = repo()
    const { value } = await r.createAsset({ ...baseInput, invCode: 'LAP/90020' }, actor)
    const code = value.barcode!
    expect((await r.findByBarcode(code))?.id).toBe(value.id)
    expect(await r.isBarcodeTaken(code)).toBe(true)
    expect(await r.isBarcodeTaken('000000000')).toBe(false)
    expect(await r.findByBarcode('000000000')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infra/repositories/inMemoryAssetRepository.test.ts`
Expected: FAIL — `findByBarcode`/`isBarcodeTaken` missing and `barcode` undefined on created assets.

- [ ] **Step 3: Implement in InMemory repo**

In `src/infra/repositories/inMemoryAssetRepository.ts`:

(a) Add the import at the top (near other domain imports):
```ts
import { allocateUniqueBarcode } from '@/domain/asset/barcode'
```

(b) Add the two methods right after `findByInvCode` (around line 113):
```ts
  async findByBarcode(barcode: string): Promise<Asset | null> {
    return this.assets.find(a => a.barcode === barcode) ?? null
  }

  async isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean> {
    return this.assets.some(a => a.barcode === barcode && a.id !== exceptId)
  }
```

(c) In `createAsset`, after the invCode/serial guards and before building `asset`, allocate the barcode, then set it on the literal:
```ts
    const barcode = await allocateUniqueBarcode((c) => this.isBarcodeTaken(c))
```
and add `barcode,` into the `asset: Asset = { ... }` literal (next to `serial: input.serial,`).

- [ ] **Step 4: Implement in Firestore repo**

In `src/infra/repositories/firestoreAssetRepository.ts`:

(a) Import:
```ts
import { allocateUniqueBarcode } from '@/domain/asset/barcode'
```

(b) In the `toAsset` mapper, add (next to `serial`):
```ts
    barcode: (d.barcode as string | null) ?? null,
```

(c) Add the two methods right after `findByInvCode` (around line 214):
```ts
  async findByBarcode(barcode: string): Promise<Asset | null> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('barcode', '==', barcode), limit(1)))
    if (snap.empty) return null
    const d = snap.docs[0]!
    return toAsset(d.id, d.data() as Record<string, unknown>)
  }

  async isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('barcode', '==', barcode), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }
```

(d) In `createAsset`, after the invCode/serial guards (line 228) and before `const statusId`, add:
```ts
    const barcode = await allocateUniqueBarcode((c) => this.isBarcodeTaken(c))
```
and add `barcode,` into the `stripUndefinedFs({ ... })` data object (next to `invCode: input.invCode, serial: input.serial,`). Optionally add `barcode` to the audit `after` object for traceability.

> NOTE on batch uniqueness: `createAssetsBatch` calls `createAsset` sequentially and each persists before the next, so `isBarcodeTaken` sees prior rows — in-batch uniqueness is automatic. No batch change needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/infra/repositories/inMemoryAssetRepository.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 6: Full typecheck**

Run: `npx tsc --noEmit` → expect exit 0 (the Task 1 errors are now resolved).

- [ ] **Checkpoint:** repo tests green; tsc exit 0.

---

## Task 3: Label rendering — install jsbarcode, `Barcode128`, `AssetLabel`, `LabelPrintHost`, print CSS

**Files:** `package.json`; Create the three label components + one test; Modify `src/index.css`.

- [ ] **Step 1: Install jsbarcode**

Run: `npm install jsbarcode && npm install -D @types/jsbarcode`
Expected: both added. Confirm: `node -e "console.log(require('./node_modules/jsbarcode/package.json').version)"`.

- [ ] **Step 2: Write the failing test for `Barcode128`**

Create `src/components/features/assets/label/Barcode128.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const jsbarcodeSpy = vi.fn()
vi.mock('jsbarcode', () => ({ default: (...args: unknown[]) => jsbarcodeSpy(...args) }))

import { Barcode128 } from './Barcode128'

describe('Barcode128', () => {
  it('calls JsBarcode with the value and CODE128 format', () => {
    render(<Barcode128 value="100309088" />)
    expect(jsbarcodeSpy).toHaveBeenCalled()
    const [, value, opts] = jsbarcodeSpy.mock.calls[0]
    expect(value).toBe('100309088')
    expect((opts as { format: string }).format).toBe('CODE128')
  })

  it('does not throw when JsBarcode itself throws (jsdom-safe)', () => {
    jsbarcodeSpy.mockImplementationOnce(() => { throw new Error('no getBBox in jsdom') })
    expect(() => render(<Barcode128 value="X" />)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/features/assets/label/Barcode128.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `Barcode128`**

Create `src/components/features/assets/label/Barcode128.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export interface Barcode128Props {
  value: string
  /** bar height in px (default 40) */
  height?: number
}

/** Renders a Code 128 barcode into an inline SVG. jsdom-safe (errors are swallowed). */
export function Barcode128({ value, height = 40 }: Barcode128Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        height,
        margin: 0,
        width: 2,
      })
    } catch {
      // jsdom (no getBBox) or invalid value — fail soft; the numeric text is shown by AssetLabel.
    }
  }, [value, height])
  return <svg ref={ref} aria-label={`barcode ${value}`} />
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/features/assets/label/Barcode128.test.tsx`
Expected: PASS.

- [ ] **Step 6: Implement `AssetLabel` (no test — pure presentational)**

Create `src/components/features/assets/label/AssetLabel.tsx`:
```tsx
import type { Asset } from '@/domain/asset/types'
import { Barcode128 } from './Barcode128'

export interface AssetLabelProps {
  asset: Asset
}

/** One ~50×30mm printable asset label: barcode + numeric code + invCode + brand/model. */
export function AssetLabel({ asset }: AssetLabelProps) {
  const title = [asset.brand, asset.model].filter(Boolean).join(' ')
  return (
    <div
      className="ams-label"
      style={{
        width: '50mm', height: '30mm', padding: '2mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        breakInside: 'avoid', overflow: 'hidden', color: '#000',
      }}
    >
      {asset.barcode ? <Barcode128 value={asset.barcode} height={36} /> : null}
      <div style={{ fontFamily: 'monospace', fontSize: '10pt', lineHeight: 1.1, marginTop: '1mm' }}>
        {asset.barcode ?? ''}
      </div>
      <div style={{ fontSize: '7pt', lineHeight: 1.1 }}>{asset.invCode}</div>
      {title ? <div style={{ fontSize: '7pt', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46mm' }}>{title}</div> : null}
    </div>
  )
}
```

- [ ] **Step 7: Implement `LabelPrintHost`**

Create `src/components/features/assets/label/LabelPrintHost.tsx`:
```tsx
import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Asset } from '@/domain/asset/types'
import { AssetLabel } from './AssetLabel'

export interface LabelPrintHostProps {
  assets: Asset[]
  /** Called once after the print dialog returns (or is cancelled). */
  onAfterPrint: () => void
}

/**
 * Renders the label(s) into a body-level portal (visible only in @media print via index.css)
 * and triggers window.print() once, then calls onAfterPrint. Single asset → one label,
 * multiple → a sheet. window.print is wrapped so jsdom/tests don't throw.
 */
export function LabelPrintHost({ assets, onAfterPrint }: LabelPrintHostProps) {
  useLayoutEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; onAfterPrint() } }
    try {
      window.print()
    } catch {
      // jsdom: window.print not implemented — ignore.
    }
    // window.print() is synchronous in browsers; finish on the next tick so the dialog is closed.
    const id = window.setTimeout(finish, 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!assets.length) return null
  return createPortal(
    <div className="ams-print-label-root">
      {assets.map((a) => <AssetLabel key={a.id} asset={a} />)}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 8: Add print CSS**

In `src/index.css`, append:
```css
/* ── Asset label printing ── */
.ams-print-label-root { display: none; }
@media print {
  body > #root { display: none; }
  .ams-print-label-root { display: block; }
  .ams-label { page-break-after: always; }
}
```

- [ ] **Step 9: Run the label test + typecheck**

Run: `npx vitest run src/components/features/assets/label/Barcode128.test.tsx` → PASS.
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Checkpoint:** label renderer green, tsc clean.

---

## Task 4: Wire print into `AssetCreatePage`

**Files:** Modify `src/pages/assets/AssetCreatePage.tsx`. Add/extend a test.

- [ ] **Step 1: Write the failing test**

Create `src/pages/assets/AssetCreatePage.print.test.tsx` (mock the heavy parts; assert that after a single create the print host mounts with the created asset and navigation happens). Mirror provider/repo patterns from the existing `AssetCreatePage.*.test.tsx` files (read one for the exact render helper + firebase mock). Core assertions:
```tsx
// Mock window.print so jsdom doesn't warn, and assert it was invoked.
const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
// ... render AssetCreatePage with an injected repo whose createAsset returns
//     { value: { ...asset, barcode: '123456789' }, auditId: 'x' } ...
// Fill the minimal required fields, submit, then:
await waitFor(() => expect(printSpy).toHaveBeenCalled())
await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets'))
```
(If wiring a full form submit is heavy, instead unit-test the new `printAssets` state path by exporting a small handler — but prefer the integration form-submit test if the existing test files show an easy submit helper.)

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run src/pages/assets/AssetCreatePage.print.test.tsx` → FAIL (no print today).

- [ ] **Step 3: Implement the wiring**

In `src/pages/assets/AssetCreatePage.tsx`:

(a) Imports + state:
```tsx
import { LabelPrintHost } from '@/components/features/assets/label/LabelPrintHost'
// ...
const [printAssets, setPrintAssets] = useState<Asset[]>([])
```

(b) In `handleSubmit` (single), replace the post-create `onCreated?.(value); navigate('/assets')` with:
```tsx
      onCreated?.(value)
      setPrintAssets([value])   // mounting LabelPrintHost triggers print, then navigates
```

(c) In `handleSubmitBatch` (group), replace the post-create `onCreated?.(...); navigate('/assets')` with:
```tsx
      onCreated?.(created[0] ?? (undefined as unknown as Asset))
      setPrintAssets(created)
```

(d) Render the host (e.g. just before the closing element of the returned JSX):
```tsx
      {printAssets.length > 0 && (
        <LabelPrintHost assets={printAssets} onAfterPrint={() => navigate('/assets')} />
      )}
```

> The asset is already persisted before printing; if the user cancels the dialog, `onAfterPrint` still navigates.

- [ ] **Step 4: Run the test to verify it passes** — `npx vitest run src/pages/assets/AssetCreatePage.print.test.tsx` → PASS.

- [ ] **Step 5: Guard existing create tests**

Run: `npx vitest run src/pages/assets/AssetCreatePage.caps.test.tsx src/pages/assets/AssetCreatePage.oem.test.tsx src/pages/assets/AssetCreatePage.freekey.test.tsx src/pages/assets/AssetCreatePage.parity.test.tsx`
Expected: PASS. If any now hang on navigation (because navigate moved into `onAfterPrint`), confirm `window.print` is a noop in jsdom and `onAfterPrint` fires via the `setTimeout(0)` in `LabelPrintHost`; these tests already `await waitFor(navigate)` so they should still pass. If a test asserted navigate happens synchronously, update it to `await waitFor(() => expect(navigate)...)`.

- [ ] **Checkpoint:** create-print test green; existing create tests green; `npx tsc --noEmit` exit 0.

---

## Task 5: `/scan` resolves by barcode first

**Files:** Modify `src/pages/scan/ScanPage.tsx`, `src/pages/scan/ScanPage.test.tsx`.

- [ ] **Step 1: Update the test (write the new expectation first)**

In `src/pages/scan/ScanPage.test.tsx`, change the fake repo to expose BOTH methods and assert barcode-first. Replace `repoWith` and add a fallback test:
```tsx
function repoWith(byBarcode: Asset | null, byInv: Asset | null = null): AssetWriteRepository {
  return {
    findByBarcode: vi.fn(async () => byBarcode),
    findByInvCode: vi.fn(async () => byInv),
  } as unknown as AssetWriteRepository
}
// existing "found" test: repoWith(ASSET) → navigates to /assets/a_005
// new test: repoWith(null, ASSET) → falls back to invCode and still navigates
it('falls back to invCode when barcode lookup misses', async () => {
  render(<MemoryRouter><ScanPage repository={repoWith(null, ASSET)} /></MemoryRouter>)
  fireScan('LAP/00123')
  await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets/a_005'))
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run src/pages/scan/ScanPage.test.tsx` → FAIL (ScanPage only calls findByInvCode).

- [ ] **Step 3: Implement barcode-first resolution**

In `src/pages/scan/ScanPage.tsx`, change the resolve line inside `handleScan`:
```tsx
      const asset = (await repo.findByBarcode(code)) ?? (await repo.findByInvCode(code))
```
(`repo` is typed `AssetWriteRepository`, which now declares both methods.)

- [ ] **Step 4: Run tests to verify they pass** — `npx vitest run src/pages/scan/ScanPage.test.tsx` → PASS (found, not-found, single-fire, fallback).

- [ ] **Checkpoint:** scan tests green; `npx tsc --noEmit` exit 0.

---

## Task 6: Reprint button on `AssetDetailPage`

**Files:** Modify `src/pages/assets/AssetDetailPage.tsx`.

- [ ] **Step 1: Implement (UI-only; verify via existing detail tests + manual)**

In `src/pages/assets/AssetDetailPage.tsx`:

(a) Imports + state:
```tsx
import { LabelPrintHost } from '@/components/features/assets/label/LabelPrintHost'
// near other useState:
const [printing, setPrinting] = useState(false)
```

(b) Add a «Печать наклейки» action — place it in the existing hero/kebab action area (match the surrounding button/IconBtn pattern already used on this page), rendered ONLY when `asset.barcode` is set:
```tsx
{asset.barcode && (
  <button type="button" onClick={() => setPrinting(true)} className="<match sibling action classes>">
    {t('label.print')}
  </button>
)}
```

(c) Mount the host:
```tsx
{printing && asset.barcode && (
  <LabelPrintHost assets={[asset]} onAfterPrint={() => setPrinting(false)} />
)}
```
> Read the page first to use the real action-button styling and the correct `t` namespace (`useTranslation('assets')`).

- [ ] **Step 2: Verify nothing breaks**

Run: `npx vitest run src/pages/assets/AssetDetailPage.test.tsx src/pages/assets/AssetDetailPage.assignment.test.tsx src/pages/assets/AssetDetailPage.license.test.tsx`
Expected: PASS (the new button is gated on `asset.barcode`, which test fixtures typically omit → button absent → no behavior change).

- [ ] **Checkpoint:** detail tests green; `npx tsc --noEmit` exit 0.

---

## Task 7: i18n keys (ru/en/hy)

**Files:** Modify `src/locales/ru/assets.json`, `src/locales/en/assets.json`, `src/locales/hy/assets.json`.

- [ ] **Step 1: Add `label.print` to each `assets.json`** (place inside the existing top-level object; create a `"label": { ... }` block if not present). ⚠️ Use the Write/Edit tools (UTF-8) — never bulk-edit these via PowerShell (corrupts Cyrillic/Armenian).
  - ru: `"label": { "print": "Печать наклейки" }`
  - en: `"label": { "print": "Print label" }`
  - hy: `"label": { "print": "Տպել պիտակը" }`

- [ ] **Step 2: Verify** — `npx vitest run` (no new failures) and read back `ru/assets.json` to confirm Cyrillic is intact (not mojibake).

- [ ] **Checkpoint:** `npx tsc --noEmit` exit 0.

---

## Task 8: Manual print + scan verification (owner-driven)

- [ ] **Step 1:** `npm run dev`; go to `/assets/new`, create a single asset → after «Создать» the browser print dialog opens with a label (barcode + number + invCode + brand/model). Print or cancel → lands on `/assets`, asset present.
- [ ] **Step 2:** Tune the `50×30mm` size / font in `AssetLabel.tsx` to your actual label printer.
- [ ] **Step 3:** Group-create N assets → one print job with N labels.
- [ ] **Step 4:** Open the created asset's detail page → «Печать наклейки» reprints.
- [ ] **Step 5:** Go to «Система → Сканировать», scan the printed Code 128 → the asset's detail page opens (resolved by `barcode`).

---

## Self-review notes

- **Spec coverage:** field + generation (T1, T2), triple uniqueness (T2 — createAsset guards + per-row batch), Code 128 label + print + group sheet (T3, T4), reprint (T6), `/scan` barcode-first (T5), i18n (T7), manual print test (T8). ✔
- **Type consistency:** `Asset.barcode?: string|null`; repo methods `findByBarcode`/`isBarcodeTaken` named identically across interface + both impls + tests; `allocateUniqueBarcode(isTaken)` signature consistent. ✔
- **No commits:** intentional (testing phase) — every task ends in a verification checkpoint.
- **jsdom safety:** `Barcode128` swallows JsBarcode errors; `LabelPrintHost` wraps `window.print` and fires `onAfterPrint` via `setTimeout(0)` so existing create tests keep passing.
- **Backfill of legacy assets is OUT OF SCOPE** (spec §10) — `barcode` is optional and null on old docs; the reprint button hides when null.
