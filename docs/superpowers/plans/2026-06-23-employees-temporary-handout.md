# Employees «Временно» Temporary Hand-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin temporarily hand selected assets to an anonymous Стажёр (intern) / Аудит (audit) holder with a return date from the Employee Detail Drawer, persist it via the existing transfer machinery, render the temporary holder wherever assignees appear, and surface an in-app "due back soon" signal 1 day before the return date.

**Architecture:** The domain (`buildTransferPatch` mode `'temporary'`), persistence (`changeStatus` flows the assignment through), and Firestore rules already support temporary holds. This plan adds: (1) a pure `temporaryHold.ts` domain helper for due-soon/overdue derivation, (2) a `'temporary'` variant of the DestPicker `Destination` union + a third sub-panel, (3) a `destToPatch` branch in EmployeesPage, (4) a `kind === 'temporary'` branch in the asset-list AssigneeCell + mobile name helper, (5) i18n keys in ru/en/hy. No Firebase rules change. The scheduled-email Cloud Function is deferred and flagged.

**Tech Stack:** React 19 + Vite + TypeScript (strict), Firebase modular SDK (untouched here), i18next 4-tier, Vitest + @testing-library/react.

---

## File Structure

- Create: `src/domain/asset/temporaryHold.ts` — pure due-soon/overdue derivation.
- Create: `src/domain/asset/temporaryHold.test.ts` — unit tests.
- Modify: `src/domain/asset/index.ts` — re-export the helper.
- Modify: `src/components/features/employees/DestPicker.tsx` — `temporary` variant + sub-panel.
- Modify: `src/components/features/employees/DestPicker.test.tsx` (create if absent) — interaction test.
- Modify: `src/pages/EmployeesPage.tsx` — `destToPatch` `temporary` branch.
- Modify: `src/pages/EmployeesPage.transfer.test.tsx` (create if absent) — persistence test.
- Modify: `src/components/features/assets/AssigneeCell.tsx` — `kind === 'temporary'` branch.
- Modify: `src/components/features/assets/AssigneeCell.test.tsx` — temporary render test.
- Modify: `src/components/features/assets/AssetsTable.tsx` — `mobileAssigneeName` temporary branch.
- Modify: `src/locales/{ru,en,hy}/employees.json` — `dest.temporary/kindAudit/kindIntern/returnDate/...`.

---

## Task 1: Pure temporary-hold derivation helper (domain-modeler)

**Files:**
- Create: `src/domain/asset/temporaryHold.ts`
- Test: `src/domain/asset/temporaryHold.test.ts`
- Modify: `src/domain/asset/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/asset/temporaryHold.test.ts
import { describe, it, expect } from 'vitest'
import { temporaryHoldStatus } from './temporaryHold'
import type { AssetAssignment } from './types'

const temp = (expiresAt: string | null): AssetAssignment => ({
  mode: 'temporary', tempKind: 'intern', expiresAt, isTemporary: true,
})

describe('temporaryHoldStatus', () => {
  const now = new Date('2026-06-23T12:00:00Z')

  it('returns null when assignment is not temporary', () => {
    expect(temporaryHoldStatus({ mode: 'employee', employeeId: 'e1' }, now)).toBeNull()
    expect(temporaryHoldStatus(null, now)).toBeNull()
  })

  it('returns null when temporary but no expiresAt', () => {
    expect(temporaryHoldStatus(temp(null), now)).toBeNull()
  })

  it('returns active when expiry is more than dueWithinDays away', () => {
    expect(temporaryHoldStatus(temp('2026-07-01'), now)).toBe('active')
  })

  it('returns dueSoon when expiry is within dueWithinDays (default 1)', () => {
    // expires tomorrow → within 1 day window
    expect(temporaryHoldStatus(temp('2026-06-24'), now)).toBe('dueSoon')
    // expires today → still dueSoon (>= now, <= now+1d)
    expect(temporaryHoldStatus(temp('2026-06-23'), now)).toBe('dueSoon')
  })

  it('returns overdue when expiry date is before today', () => {
    expect(temporaryHoldStatus(temp('2026-06-22'), now)).toBe('overdue')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/asset/temporaryHold.test.ts`
Expected: FAIL — `temporaryHoldStatus` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/asset/temporaryHold.ts
import type { AssetAssignment } from './types'

export type TemporaryHoldStatus = 'active' | 'dueSoon' | 'overdue'

/** Parse an ISO date (YYYY-MM-DD or full ISO) into a local-midnight Date. */
function toDayStart(iso: string): Date | null {
  const [datePart] = iso.split('T')
  const [y, m, d] = (datePart ?? '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Derives the return-state of a temporary hold at read time. PURE — no Firebase.
 *
 * - null            — assignment is not a temporary hold, or has no expiresAt.
 * - 'overdue'       — expiry day is strictly before `now`'s day.
 * - 'dueSoon'       — expiry day is between today and today + dueWithinDays (inclusive).
 * - 'active'        — expiry day is further than dueWithinDays away.
 */
export function temporaryHoldStatus(
  assignment: AssetAssignment | null,
  now: Date = new Date(),
  dueWithinDays = 1,
): TemporaryHoldStatus | null {
  if (!assignment || assignment.isTemporary !== true) return null
  if (!assignment.expiresAt) return null
  const expiry = toDayStart(assignment.expiresAt)
  if (!expiry) return null
  const today = dayStart(now)
  const due = new Date(today)
  due.setDate(due.getDate() + dueWithinDays)
  if (expiry < today) return 'overdue'
  if (expiry <= due) return 'dueSoon'
  return 'active'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/asset/temporaryHold.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Re-export from the barrel**

Add to `src/domain/asset/index.ts` (next to the other `export * from './...'` lines):

```ts
export * from './temporaryHold'
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "temporaryHold|domain/asset" || echo "clean for touched files"`
Then:

```bash
git add src/domain/asset/temporaryHold.ts src/domain/asset/temporaryHold.test.ts src/domain/asset/index.ts
git commit -m "feat(asset): temporaryHoldStatus pure helper for due-soon/overdue derivation"
```

---

## Task 2: DestPicker «Временно» destination + sub-panel (react-ui-engineer)

**Files:**
- Modify: `src/components/features/employees/DestPicker.tsx`
- Test: `src/components/features/employees/DestPicker.test.tsx` (create if absent)

- [ ] **Step 1: Extend the `Destination` union**

In `DestPicker.tsx`, change the union to add the temporary variant:

```ts
export type Destination =
  | { kind: 'warehouse' }
  | { kind: 'employee'; id: string; label: string }
  | { kind: 'department'; id: string; label: string }
  | { kind: 'branch'; id: string; label: string }
  | { kind: 'temporary'; tempKind: 'audit' | 'intern'; expiresAt: string; label: string }
```

- [ ] **Step 2: Add the `temporary` accent + a `timer` top option**

Add to `KIND_ACCENT` a `temporary` entry (rose, matching the prototype temporary tone):

```ts
  temporary: {
    icon: 'timer',
    iconCls: 'bg-rose-500/15 text-rose-300',
    chipCls: 'bg-rose-500/10 ring-rose-500/30 text-rose-300 hover:bg-rose-500/15',
  },
```

Add a 5th entry to `TOP_OPTS` (after `branch`), routing to a new sub-kind `'temporary'`:

```ts
    {
      kind: 'temporary' as const,
      label: t('dest.temporary'),
      sub: 'temporary' as SubKind,
      iconCls: KIND_ACCENT.temporary.iconCls,
      icon: KIND_ACCENT.temporary.icon,
    },
```

Widen `SubKind`:

```ts
type SubKind = 'employee' | 'department' | 'branch' | 'temporary'
```

- [ ] **Step 3: Add temporary sub-panel state + the DatePicker import**

At the top of `DestPicker.tsx`, import the create DatePicker:

```ts
import { DatePicker } from '@/components/features/assets/create/DatePicker'
```

Inside the component, add temporary-draft state next to the existing `useState`s:

```ts
  const [tempKind, setTempKind] = useState<'audit' | 'intern' | ''>('')
  const todayISO = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const defaultExpiry = (() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const [returnDate, setReturnDate] = useState(defaultExpiry)
```

In the existing `useLayoutEffect` reset branch (`if (!open) { ... }`), also reset:

```ts
      setTempKind('')
      setReturnDate(defaultExpiry)
```

(Keep `defaultExpiry` recompute stable — it only matters on open; recomputing per render is fine for a date constant.)

- [ ] **Step 4: Render the temporary sub-panel**

Inside the `sub` branch (the `else` block that renders employee/department/branch lists),
render the temporary form when `sub === 'temporary'` INSTEAD of the search header + list.
Wrap the existing search-header + scroll-list in `sub !== 'temporary'` and add this block:

```tsx
{sub === 'temporary' && (
  <div className="px-1.5 pb-1">
    {/* back row */}
    <div className="flex items-center gap-1 px-0.5 mb-2">
      <button
        type="button"
        aria-label="Назад"
        onClick={() => { setSub(null); setTempKind('') }}
        className="p-1 rounded-md text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#22272E] transition-colors"
      >
        <Icon name="arrow-left" size={12} />
      </button>
      <span className="text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8]">
        {t('dest.temporary')}
      </span>
    </div>

    {/* kind toggle */}
    <div className="flex items-center gap-1 h-9 bg-[#111315] border border-[#2A2F36] rounded-lg overflow-hidden mb-2">
      {(['audit', 'intern'] as const).map((k, i) => (
        <button
          key={k}
          type="button"
          onClick={() => setTempKind(k)}
          aria-pressed={tempKind === k}
          className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-[#2A2F36]' : ''}
            ${tempKind === k ? 'bg-rose-500/80 text-white' : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#22272E]'}`}
        >
          {k === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')}
        </button>
      ))}
    </div>

    {/* return date */}
    <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
      {t('dest.returnDate')}
    </label>
    <DatePicker
      value={returnDate}
      onChange={(v) => { if (v && v < todayISO) return; setReturnDate(v) }}
      min={todayISO}
      placeholder={t('dest.returnDatePlaceholder')}
    />

    {/* confirm */}
    <button
      type="button"
      disabled={!tempKind || !returnDate || returnDate < todayISO}
      onClick={() => {
        if (!tempKind) return
        const dd = returnDate.split('-')
        const short = `${dd[2]}.${dd[1]}`
        const kindLabel = tempKind === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')
        commit({
          kind: 'temporary',
          tempKind,
          expiresAt: returnDate,
          label: t('dest.tempLabel', { kind: kindLabel, date: short }),
        })
      }}
      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[14px] bg-rose-500/80 text-white hover:bg-rose-500 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
    >
      <Icon name="check" size={13} />
      {t('dest.tempConfirm')}
    </button>
  </div>
)}
```

Guard the original `<div>` (search header + list) so it only renders for the three list
sub-kinds: wrap it in `{sub !== 'temporary' && ( ... )}`.

- [ ] **Step 5: Update the chip label for temporary**

The existing `chipLabel` derivation already handles `(value as { label: string }).label`
for non-warehouse kinds, so `temporary` works unchanged (it has a `label`). Confirm
`accent = KIND_ACCENT[value.kind]` resolves (it now includes `temporary`).

- [ ] **Step 6: Write the interaction test**

```tsx
// src/components/features/employees/DestPicker.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DestPicker, type Destination } from './DestPicker'

// i18n stub: react-i18next is globally mocked in setupTests to return keys.
// We assert on stable substrings the mock yields (the key tails), so no real i18n needed.

function setup(onChange = vi.fn()) {
  render(
    <DestPicker
      value={{ kind: 'warehouse' }}
      onChange={onChange}
      currentEmpId="e0"
      employees={[]}
      departments={[]}
      branches={[]}
    />,
  )
  return { onChange }
}

describe('DestPicker temporary', () => {
  it('opens the temporary sub-panel and commits a temporary destination', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: /warehouse|Склад/i }))
    // open the «Временно» top option (label resolves via dest.temporary)
    fireEvent.click(screen.getByText(/temporary|Временно/i))
    // pick "audit"
    fireEvent.click(screen.getByText(/kindAudit|Аудит/i))
    // confirm
    fireEvent.click(screen.getByText(/tempConfirm|Подтвердить|Confirm/i))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0] as Destination
    expect(arg.kind).toBe('temporary')
    if (arg.kind === 'temporary') {
      expect(arg.tempKind).toBe('audit')
      expect(arg.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
```

> NOTE for the implementer: if the repo's `setupTests` does NOT globally mock
> react-i18next, render inside the app's existing test i18n provider used by sibling
> DestPicker-adjacent tests (check `EmployeeDetailDrawer.test.tsx` for the pattern) and
> assert on the real ru strings instead. Match whichever pattern the existing employee
> tests use — do not introduce a new i18n test harness.

- [ ] **Step 7: Run the test**

Run: `npx vitest run src/components/features/employees/DestPicker.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/features/employees/DestPicker.tsx src/components/features/employees/DestPicker.test.tsx
git commit -m "feat(employees): «Временно» destination in DestPicker (intern/audit + return date)"
```

---

## Task 3: EmployeesPage destToPatch temporary branch (react-ui-engineer)

**Files:**
- Modify: `src/pages/EmployeesPage.tsx`
- Test: `src/pages/EmployeesPage.transfer.test.tsx` (create if absent — else extend the existing transfer test)

- [ ] **Step 1: Add the temporary branch to `destToPatch`**

In `EmployeesPage.tsx`, the `destToPatch` helper currently early-returns for warehouse
then builds an employee/department/branch target. Insert a temporary branch BEFORE the
employee/department/branch ternary:

```ts
function destToPatch(dest: Destination, employees: Employee[]): TransferPatch {
  if (dest.kind === 'warehouse') return buildTransferPatch({ mode: 'warehouse' })
  if (dest.kind === 'temporary') {
    return buildTransferPatch({
      mode: 'temporary',
      tempKind: dest.tempKind,
      expiresAt: dest.expiresAt,
    })
  }
  const empDeptId =
    dest.kind === 'employee'
      ? (employees.find(e => e.id === dest.id)?.departmentId ?? null)
      : null
  const target: TransferTarget =
    dest.kind === 'employee'
      ? { mode: 'employee', employeeId: dest.id }
      : dest.kind === 'department'
        ? { mode: 'department', departmentId: dest.id }
        : { mode: 'branch', branchId: dest.id }
  return buildTransferPatch(target, empDeptId)
}
```

> The `destLabel` in `EmployeeDetailDrawer.tsx` confirm bar uses `dest.label` for any
> non-warehouse kind — temporary works unchanged.

- [ ] **Step 2: Write the persistence test**

Use the in-memory asset repo so the test is Firebase-free. Mirror the harness the existing
EmployeesPage tests use (inject `assetRepository`, `repository`, `loadRefData`). Minimal
focused test of the page handler path:

```tsx
// src/pages/EmployeesPage.transfer.test.tsx
import { describe, it, expect } from 'vitest'
import { buildTransferPatch } from '@/domain/asset'
import type { Destination } from '@/components/features/employees/DestPicker'

// destToPatch is module-private; assert the contract it relies on instead.
describe('temporary transfer patch contract', () => {
  it('buildTransferPatch temporary yields an isTemporary assignment with expiresAt + tempKind', () => {
    const dest: Destination = { kind: 'temporary', tempKind: 'intern', expiresAt: '2026-07-01', label: 'x' }
    const patch = buildTransferPatch({ mode: 'temporary', tempKind: dest.tempKind, expiresAt: dest.expiresAt })
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.assignment).toMatchObject({
      mode: 'temporary', tempKind: 'intern', expiresAt: '2026-07-01', isTemporary: true,
    })
    expect(patch.branchId).toBe('br_main')
    expect(patch.deptId).toBeNull()
  })
})
```

> If a richer page-level test harness already exists (search for `assetRepository={`
> in `*.test.tsx` under `src/pages/`), ADD a temporary-transfer case there that drives
> the drawer → DestPicker → confirm and asserts the in-memory asset ends with
> `assignment.mode === 'temporary'`. Prefer extending the real harness over the contract
> test above.

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/pages/EmployeesPage.transfer.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/EmployeesPage.tsx src/pages/EmployeesPage.transfer.test.tsx
git commit -m "feat(employees): persist «Временно» transfers via destToPatch temporary branch"
```

---

## Task 4: Asset-list AssigneeCell + mobile name temporary branch (react-ui-engineer)

**Files:**
- Modify: `src/components/features/assets/AssigneeCell.tsx`
- Modify: `src/components/features/assets/AssetsTable.tsx`
- Test: `src/components/features/assets/AssigneeCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `AssigneeCell.test.tsx`:

```tsx
import { temporaryHoldStatus } from '@/domain/asset'

it('renders a temporary (mode==="temporary") hold with role label + Временно sub-line', () => {
  const asset = {
    id: 'a1', categoryId: 'c1', brand: null, model: null, invCode: 'INV/1', serial: null,
    statusId: 'st_assigned', branchId: 'br_main', deptId: null, updatedAt: '2026-06-23T00:00:00Z',
    assignment: { mode: 'temporary', tempKind: 'intern', expiresAt: '2099-01-01', isTemporary: true },
  } as const
  render(
    <AssigneeCell
      asset={asset as never}
      employeeMap={new Map()}
      deptMap={new Map()}
      branchMap={new Map()}
      onShelf="На складе" onShelfSub="Ожидает выдачи"
      deptLabel="Отдел" branchLabel="Филиал"
      tempLabel="Временно" kindAuditLabel="Аудитор" kindInternLabel="Стажёр"
    />,
  )
  expect(screen.getByText('Стажёр')).toBeInTheDocument()
  // sub-line carries the «Временно» marker — assert it does NOT fall through to «На складе»
  expect(screen.queryByText('На складе')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/features/assets/AssigneeCell.test.tsx`
Expected: FAIL — currently `mode==='temporary'` falls through to the warehouse branch, so «На складе» renders.

- [ ] **Step 3: Add the `temporary` branch to AssigneeCell**

In `AssigneeCell.tsx`, AFTER the `employee` branch and BEFORE the `department` branch,
insert (also import the helper at the top: `import { temporaryHoldStatus } from '@/domain/asset'`):

```tsx
  // ── temporary (mode === 'temporary') ─────────────────────────────────────────
  if (kind === 'temporary') {
    const tempKind = asset.assignment?.tempKind
    const name =
      tempKind === 'audit' ? kindAuditLabel : tempKind === 'intern' ? kindInternLabel : tempLabel
    const hold = temporaryHoldStatus(asset.assignment, new Date())
    const expiresAt = asset.assignment?.expiresAt
    let subText = tempLabel
    if (expiresAt) {
      const [y, m, d] = expiresAt.split('T')[0]!.split('-')
      subText = `${tempLabel} · ${d}.${m}.${y?.slice(2) ?? ''}`
    }
    const subCls =
      hold === 'overdue'
        ? 'text-rose-400'
        : hold === 'dueSoon'
          ? 'text-amber-300'
          : 'text-amber-300/80'
    return (
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate leading-tight text-[#F8FAFC]">
          {name}
        </div>
        <div className={`text-[13px] font-medium leading-tight mt-0.5 truncate ${subCls}`}>
          {subText}
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/features/assets/AssigneeCell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the mobile branch in AssetsTable**

In `AssetsTable.tsx` `mobileAssigneeName`, AFTER the `employee` branch and BEFORE the
`department` branch, insert:

```ts
    if (kind === 'temporary') {
      const tempKind = a.assignment?.tempKind
      const label = tempKind === 'audit' ? kindAuditLabel
        : tempKind === 'intern' ? kindInternLabel : tempLabel
      return { name: label, isAuditOrIntern: true }
    }
```

- [ ] **Step 6: Run the table parity tests (no regression)**

Run: `npx vitest run src/components/features/assets/assetFormat.parity.test.ts src/components/features/assets/AssigneeCell.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/assets/AssigneeCell.tsx src/components/features/assets/AssigneeCell.test.tsx src/components/features/assets/AssetsTable.tsx
git commit -m "fix(assets): render mode==='temporary' holds in AssigneeCell + mobile name"
```

---

## Task 5: i18n keys ru / en / hy (i18n-engineer)

**Files:**
- Modify: `src/locales/ru/employees.json`
- Modify: `src/locales/en/employees.json`
- Modify: `src/locales/hy/employees.json`

- [ ] **Step 1: Add keys to the `dest` block in each locale**

Add these keys inside the existing `"dest": { ... }` object.

ru (`src/locales/ru/employees.json`):

```json
    "temporary": "Временно",
    "kindAudit": "Аудит",
    "kindIntern": "Стажёр",
    "returnDate": "Вернуть до",
    "returnDatePlaceholder": "— выберите дату —",
    "tempLabel": "{{kind}} · до {{date}}",
    "tempConfirm": "Подтвердить"
```

en (`src/locales/en/employees.json`):

```json
    "temporary": "Temporary",
    "kindAudit": "Audit",
    "kindIntern": "Intern",
    "returnDate": "Return by",
    "returnDatePlaceholder": "— pick a date —",
    "tempLabel": "{{kind}} · by {{date}}",
    "tempConfirm": "Confirm"
```

hy (`src/locales/hy/employees.json`):

```json
    "temporary": "Ժամանակավոր",
    "kindAudit": "Աուդիտ",
    "kindIntern": "Պրակտիկանտ",
    "returnDate": "Վերադարձնել մինչև",
    "returnDatePlaceholder": "— ընտրեք ամսաթիվ —",
    "tempLabel": "{{kind}} · մինչև {{date}}",
    "tempConfirm": "Հաստատել"
```

> Keep each file's existing key ordering/formatting style. Add commas correctly.

- [ ] **Step 2: Verify JSON validity + key parity**

Run: `node -e "['ru','en','hy'].forEach(l=>{const o=require('./src/locales/'+l+'/employees.json').dest;['temporary','kindAudit','kindIntern','returnDate','returnDatePlaceholder','tempLabel','tempConfirm'].forEach(k=>{if(!(k in o))throw new Error(l+' missing dest.'+k)})});console.log('i18n parity OK')"`
Expected: `i18n parity OK`.

- [ ] **Step 3: Render test that the key resolves in all three locales**

If the repo has an i18n render-parity test pattern (search `src/locales` test usage),
follow it. Otherwise the parity node check above + the DestPicker test cover resolution.

- [ ] **Step 4: Commit**

```bash
git add src/locales/ru/employees.json src/locales/en/employees.json src/locales/hy/employees.json
git commit -m "i18n(employees): «Временно» dest keys (ru/en/hy)"
```

---

## Task 6: Scoped verification (orchestrator)

- [ ] **Step 1: Run the full touched-files test set**

```bash
npx vitest run \
  src/domain/asset/temporaryHold.test.ts \
  src/components/features/employees/DestPicker.test.tsx \
  src/pages/EmployeesPage.transfer.test.tsx \
  src/components/features/assets/AssigneeCell.test.tsx \
  src/components/features/assets/assetFormat.parity.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Scoped typecheck (full build is broken by an unrelated parts/* workstream)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "DestPicker|EmployeesPage|AssigneeCell|temporaryHold|AssetsTable" || echo "no tsc errors in touched files"`
Expected: `no tsc errors in touched files`.

- [ ] **Step 3: Reviews** — spec-reviewer → code-quality-reviewer → security-reviewer.

---

## Self-Review

- **Spec coverage:** DestPicker temporary (Task 2), destToPatch persist (Task 3),
  holder rendering drawer chip (Task 2 label) + asset-list (Task 4), in-app due-soon
  helper (Task 1) + colored sub-line (Task 4), i18n (Task 5). Scheduled-email deferred &
  flagged (design doc). All covered.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `Destination.temporary` shape `{ kind, tempKind, expiresAt, label }`
  is identical in Tasks 2/3/4. `temporaryHoldStatus(assignment, now, dueWithinDays)`
  signature identical in Tasks 1/4. `tempKind` is `'audit'|'intern'` throughout.
