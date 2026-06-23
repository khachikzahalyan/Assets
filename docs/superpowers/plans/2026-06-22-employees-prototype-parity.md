# Employees Page Prototype Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the polished `Warehouse/prototypes/employees.html` screen into the assets-crm React app so `/employees` matches the prototype 1:1 in UI/UX and logic — modal create/edit, right-side detail drawer, handover ("Сдача техники") flow, asset-picker ("Привязать активы") wizard, restore-confirm, toast, archive/restore, CSS-Grid table, KindTabs, SelectMini filter toolbar.

**Architecture:** Convert the current navigation-based Employees pages (`/employees/new`, `/employees/:id` full pages) into the prototype's IN-PAGE modal + drawer model rendered from `EmployeesPage`. Keep `/employees/new` and `/employees/:id` routes valid for deep-linking by having them mount `EmployeesPage` with an initial modal/drawer target. Wire all flows to the EXISTING repositories (`FirestoreEmployeeRepository`, `FirestoreAssignmentRepository`, `FirestoreAssetRepository`) — no new domain enum. The prototype's `archived/Архив` maps to the production `terminated` status; "Сдача техники" → terminate-after-return, "Восстановить" → reactivate. Dark/orange theme, TypeScript strict, repository-pattern boundaries, i18n 4-tier, MobileSheet for mobile, role-gated mutations.

**Tech Stack:** React 19 + Vite + TypeScript (strict) + Tailwind + Firebase modular SDK + react-i18next + Vitest + @testing-library/react.

---

## Source-of-truth references

- **Prototype:** `C:/Users/DELL/Desktop/Warehouse/prototypes/employees.html` (3206 lines). DO NOT EDIT — reference only.
- **Shipped reference impl to mirror conventions:** `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/AssetsTable.tsx` (matchMedia 767px mobile branch), `src/components/features/assets/BulkAssignModal.tsx` (Radix Dialog modal pattern), `src/components/ui/MobileSheet.tsx`.
- **Layout locks (memory):** EMP_GRID_COLS / EMP_ROW_H=58 / EMP_PAGE_ROWS=10, CSS-Grid table (no `<table>`), placeholder rows pad to 10-row footprint, flex-distribute rows. PAGE_SIZE in the prototype App = **10** (NOT 15). Pagination bar `flex items-center justify-between px-5 py-2 border-t`.
- **Golden rule:** unique invCode + serial — not central to Employees but the asset-picker MUST only offer warehouse-stock assets (it never creates assets, so no dup risk; verify picker never mutates invCode/serial).

## Theme tokens (lift verbatim from prototype)

- Surfaces: card `#1B1F24`, page `#111315`, border `#2A2F36`, hover-border `#3A4048`.
- Text: primary `#F8FAFC`, secondary `#94A3B8`, muted `#64748B`, body `#CBD5E1`.
- Accent: orange `#F97316` / `#FB923C` / `#EA580C`. Row hover `rgba(249,115,22,0.08)`. Focus ring `#F97316`/15.
- Status chips: active = `green`, archived/terminated = `violet`.
- Animations: reuse existing `anim-fade-slide-in`, `anim-modal-pop`, `anim-backdrop-fade`, `anim-drawer-slide-in`, `anim-toast` (already in app global CSS — verify in `src/index.css`; if any are missing, add them in Task 1).

## Data-model mapping (prototype → production)

| Prototype field/concept | Production | Note |
|---|---|---|
| `emp.firstName` / `lastName` / `name` | `Employee.firstName` / `lastName`; derive name | name = `${firstName} ${lastName}` |
| `emp.status: 'active'\|'archived'` | `Employee.status: 'active'\|'terminated'` | archived ⇔ terminated. Chip color: active=green, terminated=violet. Labels via i18n. |
| `emp.deptId` | `Employee.departmentId` | |
| `emp.branchId` | `Employee.branchId` | head office = `branches[0].id` (no domain flag) |
| `emp.phone` (Armenian 9-digit) | `Employee.phone` | reuse existing `employeeFormat.formatLocalPhone`; ADD `normalizePhone` (see Task 2) |
| `emp.email` | `Employee.email` | |
| `emp.position` | `Employee.position` | |
| `emp.lastActivity` | `Employee.updatedAt` | sort/recency key |
| `emp.kind` | (none) | Production has only staff. KindTabs shows Все / Сотрудники (count). No audit/intern. |
| `assetCount` | derived from assets where `assignment.mode==='employee' && employeeId===id` | `FirestoreAssetRepository.listAssetsForEmployee` |
| handover → warehouse | `FirestoreAssignmentRepository.returnAsset(assetId, actor)` then employee `setStatus('terminated')` | |
| picker link → employee | `FirestoreAssignmentRepository.assign({assetId, mode:'employee', employeeId, employeeEmail, employeeName, invCode}, actor)` per asset | asset must be `st_warehouse` |
| restore | `setStatus('active', actor)` | |

## File structure

**Create:**
- `src/contexts/ToastContext.tsx` — toast provider + `useToast()` (prototype anim-toast).
- `src/components/ui/Drawer.tsx` — right-side drawer shell (portal + a11y + ESC + backdrop). Reuses MobileSheet on mobile? No — drawer is desktop right-panel; on mobile it becomes full-width (clamp handles it). Exported via `src/components/ui/index.ts`.
- `src/components/features/employees/EmployeeFormModal.tsx` — create/edit modal (wraps existing EmployeeForm fields or replaces — see Task 6).
- `src/components/features/employees/EmployeeDetailDrawer.tsx` — right-side detail panel.
- `src/components/features/employees/HandoverModal.tsx` — 2-step "Приёмка техники".
- `src/components/features/employees/AssetPickerSheet.tsx` — 4-step asset-link wizard.
- `src/components/features/employees/RestoreConfirmModal.tsx`.
- `src/components/features/employees/DestPicker.tsx` — destination picker popover used inside HandoverModal.
- `src/components/features/employees/EmployeeKindTabs.tsx` — Все / Сотрудники chips.
- Tests co-located: `*.test.tsx` for each new component + `EmployeesPage.test.tsx` updates.

**Modify:**
- `src/pages/EmployeesPage.tsx` — becomes the modal/drawer host; PAGE_SIZE 15→10; add KindTabs, toast, all handlers.
- `src/components/features/employees/EmployeesTable.tsx` — confirm columns/heights match prototype; mobile card branch (already partially there — verify).
- `src/components/features/employees/EmployeesFilterBar.tsx` — confirm 4 SelectMinis (Отдел/Филиал/Статус/Сорт.) + Сбросить, defaults (status default 'active').
- `src/components/features/employees/employeeFormat.ts` — add `normalizePhone`, `relativeTime`, `formatDateRu`, `createdAtFor` helpers used by drawer/modal.
- `src/components/features/employees/index.ts` — export new components.
- `src/pages/EmployeeCreatePage.tsx` / `EmployeeDetailPage.tsx` — re-point to mount `EmployeesPage` with `initialModal='create'` / `initialDetailId=:id` (deep-link). Keep route registration intact.
- `src/config/routes.tsx` — no structural change; verify `/employees/new` and `/employees/:id` still resolve.
- `src/App.tsx` (or wherever providers mount) — wrap with `<ToastProvider>`.
- `src/locales/{ru,en,hy}/employees.json` — add modal/drawer/handover/picker/toast keys.
- `src/components/ui/index.ts` — export `Drawer`.

**Note on the dirty working tree:** the repo is on branch `feat/go-live-seed-deploy-runbook` with uncommitted changes including employee files. Work ADDITIVELY. Before starting, the executor must create a new branch off the current HEAD (`git checkout -b feat/employees-prototype-parity`) so this work is isolated and the in-progress changes ride along rather than being clobbered. Commit frequently.

---

### Task 0: Branch + baseline green

**Files:** none (setup)

- [ ] **Step 1: Create isolated branch**

```bash
cd /c/Users/DELL/Desktop/assets-crm
git checkout -b feat/employees-prototype-parity
```

- [ ] **Step 2: Baseline test run (record current state)**

Run: `npm test -- --run src/pages/EmployeesPage.test.tsx`
Expected: PASS (record the count — this is the regression baseline).

- [ ] **Step 3: Baseline build**

Run: `npm run build`
Expected: succeeds. If it fails due to unrelated in-progress changes on the branch, note the failure set and proceed only for employee-scoped files; do not attempt to fix unrelated files.

---

### Task 1: ToastContext + animations

**Files:**
- Create: `src/contexts/ToastContext.tsx`
- Test: `src/contexts/ToastContext.test.tsx`
- Modify: `src/index.css` (only if `anim-toast` keyframes absent)

- [ ] **Step 1: Write failing test**

```tsx
// ToastContext.test.tsx
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
  const { showToast } = useToast()
  return <button onClick={() => showToast('Сотрудник добавлен')}>fire</button>
}

it('shows a toast then auto-dismisses', () => {
  vi.useFakeTimers()
  render(<ToastProvider><Trigger /></ToastProvider>)
  act(() => { screen.getByText('fire').click() })
  expect(screen.getByRole('status')).toHaveTextContent('Сотрудник добавлен')
  act(() => { vi.advanceTimersByTime(3100) })
  expect(screen.queryByRole('status')).toBeNull()
  vi.useRealTimers()
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

Run: `npm test -- --run src/contexts/ToastContext.test.tsx`

- [ ] **Step 3: Implement ToastContext**

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui'

interface ToastState { id: number; text: string }
interface ToastApi { showToast: (text: string) => void }
const Ctx = createContext<ToastApi>({ showToast: () => {} })
export function useToast(): ToastApi { return useContext(Ctx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const showToast = useCallback((text: string) => setToast({ id: Date.now() + Math.random(), text }), [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div key={toast.id}
            className="anim-toast pointer-events-auto bg-[#1B1F24] border border-emerald-500/30 rounded-lg shadow-xl shadow-emerald-900/10 px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md"
            role="status" aria-live="polite">
            <div className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
              <Icon name="check" size={14} />
            </div>
            <div className="text-[15px] text-[#F8FAFC] font-semibold tracking-tight">{toast.text}</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
```

- [ ] **Step 4: Ensure `anim-toast` keyframes exist in `src/index.css`**

Grep first: `grep -n "anim-toast" src/index.css`. If absent, append:

```css
@keyframes toastInOut {
  0%   { opacity: 0; transform: translateX(20px); }
  6%   { opacity: 1; transform: translateX(0); }
  94%  { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(20px); }
}
.anim-toast { animation: toastInOut 3000ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

Also verify `anim-drawer-slide-in`, `anim-modal-pop`, `anim-backdrop-fade`, `anim-fade-slide-in` exist; add any missing from the prototype `<style>` block (lines 32-68).

- [ ] **Step 5: Run — expect PASS.** Then mount `<ToastProvider>` around the app router root (find where `<RouterProvider>`/`<App>` mounts — likely `src/App.tsx` or `src/main.tsx`; wrap inside existing providers, outside the router so it persists across routes).

- [ ] **Step 6: Commit** `feat(employees): add ToastContext + toast animation`

---

### Task 2: employeeFormat helpers (normalizePhone, relativeTime, formatDateRu, createdAtFor)

**Files:**
- Modify: `src/components/features/employees/employeeFormat.ts`
- Test: `src/components/features/employees/employeeFormat.test.ts`

- [ ] **Step 1: Write failing tests** (add to existing test file)

```ts
import { normalizePhone, formatLocalPhone, relativeTime, formatDateRu } from './employeeFormat'

describe('normalizePhone', () => {
  it('strips +374 and enforces leading 0, caps 9 digits', () => {
    expect(normalizePhone('+37499120000')).toBe('099120000')
    expect(normalizePhone('99 12 00 00')).toBe('099120000')
    expect(normalizePhone('099120000')).toBe('099120000')
    expect(normalizePhone('')).toBe('')
  })
})
describe('formatLocalPhone', () => {
  it('formats a full 9-digit number as 0XX XX XX XX', () => {
    expect(formatLocalPhone('099120000')).toBe('099 12 00 00')
  })
  it('returns partial unformatted', () => {
    expect(formatLocalPhone('0991')).toBe('0991')
  })
})
describe('relativeTime', () => {
  it('returns "только что" for now', () => {
    expect(relativeTime(new Date().toISOString())).toMatch(/только что|мин назад/)
  })
})
describe('formatDateRu', () => {
  it('formats DD mmm YYYY', () => {
    expect(formatDateRu(new Date(2026, 4, 12))).toBe('12 май 2026')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

Run: `npm test -- --run src/components/features/employees/employeeFormat.test.ts`

- [ ] **Step 3: Implement helpers** (append to `employeeFormat.ts`; copy logic verbatim from prototype lines 603-649)

```ts
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let d = String(input).replace(/\D/g, '')
  if (d.startsWith('374')) d = d.slice(3)
  if (!d) return ''
  if (!d.startsWith('0')) d = '0' + d
  return d.slice(0, 9)
}

// formatLocalPhone already exists — ensure it delegates to normalizePhone:
// const d = normalizePhone(phone); if d.length===9 return `${d.slice(0,3)} ${d.slice(3,5)} ${d.slice(5,7)} ${d.slice(7,9)}`; return d

const RU_MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
export function formatDateRu(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${RU_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ч назад`
  const dy = Math.floor(hr / 24)
  if (dy < 7) return `${dy} ${dy === 1 ? 'день' : dy < 5 ? 'дня' : 'дней'} назад`
  const wk = Math.floor(dy / 7)
  if (wk < 4) return `${wk} нед назад`
  const mo = Math.floor(dy / 30)
  if (mo < 12) return `${mo} мес назад`
  return `${Math.floor(dy / 365)} г назад`
}
```

If `formatLocalPhone` already exists and does NOT delegate to `normalizePhone`, refactor it to delegate (so partial input behavior matches the prototype). Keep `employeeInitials` / `employeeAvatarColor` exports untouched.

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(employees): add phone/date/relative-time format helpers`

---

### Task 3: Drawer UI primitive

**Files:**
- Create: `src/components/ui/Drawer.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `src/components/ui/Drawer.test.tsx`

**Behavior:** right-side panel, portal to body, backdrop (`bg-black/60 backdrop-blur-[2px] anim-backdrop-fade`), ESC closes, body-scroll locked while open, `anim-drawer-slide-in`. Panel: `absolute top-0 right-0 h-full bg-[#1B1F24] border-l border-[#2A2F36] shadow-2xl flex flex-col` with `style={{width:'100%', maxWidth:'clamp(320px, 42vw, 680px)'}}`. Focus-trap + restore (mirror prototype `useModalA11y`).

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'

it('renders children when open and calls onClose on ESC', () => {
  const onClose = vi.fn()
  render(<Drawer open onClose={onClose}><div>panel body</div></Drawer>)
  expect(screen.getByText('panel body')).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalled()
})
it('renders nothing when closed', () => {
  const { container } = render(<Drawer open={false} onClose={() => {}}><div>x</div></Drawer>)
  expect(container.querySelector('[data-drawer]')).toBeNull()
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement Drawer** (portal, ESC handler, body-overflow lock, backdrop onClick→onClose, `data-drawer` attr on panel). Copy the focus-trap from prototype `useModalA11y` (lines 424-487) as a local `useDrawerA11y(open, ref)` hook OR a shared `src/components/ui/useModalA11y.ts` if not already present. Use `ReactDOM.createPortal(..., document.body)`.
- [ ] **Step 4: Export from `src/components/ui/index.ts`:** `export { Drawer } from './Drawer'`.
- [ ] **Step 5: Run — expect PASS.**
- [ ] **Step 6: Commit** `feat(ui): add right-side Drawer primitive`

---

### Task 4: EmployeesFilterBar parity

**Files:**
- Modify: `src/components/features/employees/EmployeesFilterBar.tsx`
- Test: `src/components/features/employees/EmployeesFilterBar.test.tsx`

**Target (prototype lines 1064-1098):** wrapper `flex items-center gap-2 px-4 py-2 flex-wrap`. Four `SelectMini`:
- Отдел (icon `users`) — options: Все + all departments. default 'all'.
- Филиал (icon `building`) — options: Все + branches; per-option icon `landmark` (head office, color `#10B981`) / `building` (others, `#38BDF8`). default 'all'.
- Статус (icon `circle-dot`) — Все + active + terminated. **default 'active'**.
- Сорт. (icon `list-filter`) — `updated_desc`(Сначала новые) / `updated_asc`(Сначала старые) / `name_asc`(Имя А→Я) / `name_desc`(Имя Я→А) / `dept_asc`(По отделу) / `assets_desc`(Больше активов). default 'updated_desc'.
- Сбросить button (ghost, `ml-auto`) when `hasActiveFilters`.

Note SortValue currently is only 4 values; ADD `'dept_asc' | 'assets_desc'` to `src/domain/employee/types.ts` SortValue union (Task 4 step 0).

- [ ] **Step 1: Extend SortValue in `src/domain/employee/types.ts`** to `'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'dept_asc' | 'assets_desc'`. Run `npm run build` to surface any switch exhaustiveness gaps in `EmployeesPage.sortEmployees` (handle in Task 9).
- [ ] **Step 2: Write failing test** asserting 4 SelectMini labels render (Отдел/Филиал/Статус/Сорт.), reset button hidden by default, shown when query differs from defaults, and onChange propagates.

```tsx
it('shows reset only when filters differ from defaults', () => {
  const onChange = vi.fn()
  const { rerender } = render(<EmployeesFilterBar query={{status:'active',branchId:'all',departmentId:'all',sort:'updated_desc',search:''}} onChange={onChange} branches={[]} departments={[]} />)
  expect(screen.queryByText('Сбросить')).toBeNull()
  rerender(<EmployeesFilterBar query={{status:'all',branchId:'all',departmentId:'all',sort:'updated_desc',search:''}} onChange={onChange} branches={[]} departments={[]} />)
  expect(screen.getByText('Сбросить')).toBeInTheDocument()
})
```

(Use i18n labels — if tests run in `ru`, assert Russian strings. Match the existing test setup's `changeLanguage('ru')`.)

- [ ] **Step 3: Implement parity** — adjust SelectMini set/order/defaults/icons; add Сбросить with `ml-auto`; pass `hasActiveFilters` computed from query vs DEFAULT_QUERY (status default 'active'). Per-option branch icon+color via SelectMiniOption `{icon, iconColor}`.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `feat(employees): filter toolbar parity (4 selects, status default active, reset)`

---

### Task 5: EmployeeKindTabs + PageHeader parity

**Files:**
- Create: `src/components/features/employees/EmployeeKindTabs.tsx`
- Test: `src/components/features/employees/EmployeeKindTabs.test.tsx`
- (PageHeader wiring happens in Task 9 inside EmployeesPage)

**Target (prototype lines 927-955):** chips `Все`(icon `users`) + `Сотрудники`(icon `user`), each `h-9 px-3 rounded-lg` with count. Active = `bg-[#F97316] text-white`; inactive = `bg-[#1B1F24] text-[#F8FAFC] border border-[#2A2F36] hover:border-[#3A4048]`. Since production has only staff, tabs are `all` and `staff`. (Keep the component generic enough to add kinds later but ship only these two.)

- [ ] **Step 1: Write failing test** — renders Все + Сотрудники with counts, active tab styled, onSelect fires.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `EmployeeKindTabs({ selected, onSelect, counts })` where `counts = { all: number, staff: number }`.
- [ ] **Step 4: Run — PASS. Export from index.ts.**
- [ ] **Step 5: Commit** `feat(employees): add KindTabs (Все / Сотрудники)`

---

### Task 6: EmployeeFormModal (create + edit)

**Files:**
- Create: `src/components/features/employees/EmployeeFormModal.tsx`
- Test: `src/components/features/employees/EmployeeFormModal.test.tsx`

**Target (prototype lines 1442-1594):** Modal `max-w-2xl`. Header title `Новый сотрудник` / `Редактировать сотрудника` + subtitle. Body grid: row1 Имя+Фамилия, row2 Должность+Отдел(Select), row3 Телефон+Gmail. **Edit mode locks firstName/lastName/Gmail** (ReadOnlyValue with lock icon); position/department/phone editable always. Footer: Отмена(ghost) + Создать/Сохранить(primary, disabled until canSave). Validation: required firstName/lastName(create)/position/dept/phone(9 digits)/email(create, format). Phone uses normalizePhone + formatLocalPhone. Reuse the existing `Modal`/Radix-Dialog pattern from `BulkAssignModal.tsx` for the shell, OR port the prototype `<Modal>` to a local component — prefer the existing app Modal if one is exported; else create a local modal shell mirroring prototype lines 1414-1437.

The modal calls back `onSave(submit: EmployeeFormSubmit)` where `EmployeeFormSubmit = { id?: string; firstName: string; lastName: string; email: string; phone: string; position: string; departmentId: string; branchId: string }`. The PAGE wires this to the repository (Task 9). Modal does NOT call Firebase directly.

- [ ] **Step 1: Write failing tests:**
  - create mode: all fields editable; Создать disabled until valid; submitting valid form calls onSave with trimmed values + derived name absent (page derives).
  - edit mode: Имя/Фамилия/Gmail render as read-only (no input); Должность/Телефон editable; Сохранить enabled when position+phone valid.
  - phone: typing `99120000` displays `099 12 00 00`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** per prototype. Use `<Field>`, `<Input>`, `<Select>`, `Btn`, `Icon` from `@/components/ui`. ReadOnlyValue: port prototype lines 759-765 as a local sub-component (lock icon, slate bg). Department `<Select>` options = `departments` prop.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(employees): EmployeeFormModal create/edit with locked identity in edit`

---

### Task 7: RestoreConfirmModal + EmployeeDetailDrawer

**Files:**
- Create: `src/components/features/employees/RestoreConfirmModal.tsx`
- Create: `src/components/features/employees/EmployeeDetailDrawer.tsx`
- Test: both `*.test.tsx`

**RestoreConfirmModal (prototype 2537-2567):** `max-w-md`, violet icon `rotate-ccw`, title `Восстановить сотрудника?`, body naming the employee, footer Отмена + Восстановить(violet gradient). Props `{ open, emp, onConfirm, onClose }`.

**EmployeeDetailDrawer (prototype 2628-2814):** uses the new `Drawer`. Header: avatar (EmployeeAvatar lg) + status dot, name + status chip + joined date (`formatDateRu(createdAtFor)`), close. Quick-facts `<dl>` rows (EmployeePropRow): Филиал, Отдел(+position), Gmail(copyable), Телефон(mono, copyable). Section bar `Активы` + count + `Привязать актив` button (emerald, only when active). Scrollable linked-assets list (icon tile + title + invCode + cat + transfer date). Footer: active → `Сдача техники`(danger, `package` icon); terminated → `Восстановить`(secondary). Props: `{ open, emp, linkedAssets, joinedAt, onClose, onArchive, onRestore, onLinkAssets }` — linkedAssets passed in from page (already fetched), each `{ id, icon, title, invCode, cat, transferredAt }`. Port `EmployeePropRow` (2589-2626) + `ICON_TINT`/`iconTint` (2579-2587) + `createdAtFor` (move to employeeFormat in Task 2 if simpler — but `createdAtFor` is prototype-only deterministic mock; production should use `emp.createdAt`. Use `emp.createdAt` directly, not the hash mock).

> **Decision (documented):** the prototype's `createdAtFor` is a deterministic mock because the mock store lacks createdAt. Production `Employee.createdAt` exists — the drawer joined-date renders `formatDateRu(new Date(emp.createdAt))`. Do NOT port the hash-based mock.

- [ ] **Step 1: Write failing tests** for both: RestoreConfirmModal renders employee name + fires onConfirm; Drawer renders quick-facts, shows "Сдача техники" for active emp / "Восстановить" for terminated, shows linked-asset rows, "Привязать актив" hidden for terminated.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement both.**
- [ ] **Step 4: Run — PASS. Export from index.ts.**
- [ ] **Step 5: Commit** `feat(employees): detail drawer + restore-confirm modal`

---

### Task 8: DestPicker + HandoverModal + AssetPickerSheet

**Files:**
- Create: `src/components/features/employees/DestPicker.tsx`
- Create: `src/components/features/employees/HandoverModal.tsx`
- Create: `src/components/features/employees/AssetPickerSheet.tsx`
- Test: `HandoverModal.test.tsx`, `AssetPickerSheet.test.tsx`

**DestPicker (prototype 1599-1799):** portal popover chip with sub-pickers (Склад / Сотрудник… / Отдел… / Филиал…), search, drop-up support. Props `{ value, onChange, currentEmpId, employees, departments, branches, forceDropUp }`. employees/departments/branches injected (no global mock).

**HandoverModal (prototype 1801-2113):** 2-step. Step receive: checkbox rows per asset, toggle-all, progress bar, "Далее" enabled when allDone. Step route: read-only rows + DestPicker per row (default warehouse), "Завершить приёмку". Props `{ open, emp, assets, employees, departments, branches, onConfirm, onClose }` where assets = `[{ id, icon, title, invCode, sn }]`. `onConfirm(rows)` — rows carry `received` + `destination`. Page handles persistence.

**AssetPickerSheet (prototype 2161-2532):** 4-step wizard Group→Category→Items→Review with cart, cancel-with-cart confirm overlay. Props `{ open, emp, stock, onConfirm, onClose }` where `stock = [{ id, title, invCode, cat, icon, group }]` (warehouse assets in emp's branch, injected by page). `onConfirm(assetIds: string[])`. Group constants `ASSET_GROUPS` (devices/network/furniture) ported from 2126-2154.

- [ ] **Step 1: Write failing tests:**
  - HandoverModal: step 1 disables "Далее" until all received; toggle-all checks all; advancing to step 2 shows DestPickers; "Завершить приёмку" calls onConfirm with rows.
  - AssetPickerSheet: group step shows 3 groups with counts; selecting group→category→item toggles cart; review shows selected; Подтвердить calls onConfirm with ids; cancel with non-empty cart shows confirm overlay.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement all three** verbatim to prototype, with injected data props instead of `window.AMS_MOCK`/`EMPLOYEES_MOCK`. Use existing `SearchInput`, `Modal` shell, `Btn`, `Icon`, `Chip`.
- [ ] **Step 4: Run — PASS. Export from index.ts.**
- [ ] **Step 5: Commit** `feat(employees): handover modal + asset-picker wizard + dest picker`

---

### Task 9: EmployeesPage host wiring (the integration task)

**Files:**
- Modify: `src/pages/EmployeesPage.tsx`
- Modify: `src/pages/EmployeeCreatePage.tsx`, `src/pages/EmployeeDetailPage.tsx` (deep-link mounts)
- Modify: `src/pages/EmployeesPage.test.tsx`

**Wiring:**
1. `PAGE_SIZE = 10`.
2. Add `sortEmployees` cases for `dept_asc` (by department name via deptMap) and `assets_desc` (by assetCounts).
3. PageHeader: search + Добавить (already). ADD `EmployeeKindTabs` above filter bar OR inside header per prototype (prototype puts KindTabs in PageHeader topbar variant; production PageHeader differs — place KindTabs as a row directly under PageHeader, before the SectionCard, matching X1 layout note "KindTabs in PageHeader use variant=topbar"). Decision: render `<EmployeeKindTabs>` inside the SectionCard top, above the filter bar — simplest parity given production PageHeader shape. Counts: all + staff (= all, since prod has only staff).
4. State: `formOpen/formInitial`, `detailId`, `handoverTarget`, `pickerTarget`, `restoreTarget`. `useToast()`.
5. Status filter default 'active' (DEFAULT_QUERY.status = 'active').
6. Handlers (wire to repos + audit + toast):
   - `handleCreate` → open modal, `formInitial=null`.
   - `handleSaveForm(submit)` → create: build CreateEmployeeInput with `id` = generated uid placeholder? **PROBLEM:** production createEmployee requires `id` === Firebase Auth uid. The prototype generates `emp_${Date.now()}`. **Decision (documented):** Employees are created lazily on first email-link sign-in in production; an admin-created record without a real uid is acceptable for MVP using a generated doc id (e.g. `pending_${crypto.randomUUID()}`) — the create modal already exists in production via EmployeeCreatePage which uses a uid field. To stay faithful to the prototype (no uid field in modal), generate a placeholder id `pending_<uuid>`; the existing repo accepts any string id. Call `repo.createEmployee({ id, firstName, lastName, email, phone, position, branchId, departmentId }, actor)`; edit: `repo.updateEmployee(id, patch, actor)`. On success → `showToast`, reload list, close modal. On error → toast error text from `t('validation.saveFailed')`.
   - `handleOpenDetail(id)` → `setDetailId(id)`; fetch linkedAssets for that employee via `assetRepo.listAssetsForEmployee(id)` (lazy, cache in state map).
   - `handleArchive(id)` → if assetCount 0: `repo.setStatus(id,'terminated',actor)` + toast; else open HandoverModal with that emp's assets.
   - `handleHandoverConfirm(rows)` → for each received row with destination warehouse: `assignmentRepo.returnAsset(row.id, actor)`; (redirected destinations out of MVP scope — return-to-warehouse only, matching prototype which only persists warehouse returns); then `repo.setStatus(target,'terminated',actor)`; reload; toast; close.
   - `handleRestore(id)` → open RestoreConfirmModal; confirm → `repo.setStatus(id,'active',actor)`; reload; toast.
   - `handleLinkAssets(id)` → open AssetPickerSheet with warehouse stock in emp's branch: `assetRepo.listAssets({statusId:'st_warehouse', branchId: emp.branchId})` mapped to picker rows.
   - `handleConfirmLink(ids)` → for each id: `assignmentRepo.assign({assetId:id, mode:'employee', employeeId:target.id, employeeEmail:target.email, employeeName:`${first} ${last}`, invCode: <lookup>}, actor)`; reload counts; toast; close.
7. `actor` from `useAuth()` user → `{ uid, role }` shape expected by repos (verify Actor type; build from `user.id`/`role`).
8. Reset filters: status→'active', others→'all', search→'', sort→'updated_desc'.
9. EmployeesTable onRowClick → `handleOpenDetail` (NOT navigate). Pass `onRestore` for archived rows' inline restore button.
10. Mount all modals/drawer at the bottom of the page JSX.
11. **Deep-link:** `EmployeeCreatePage` → render `<EmployeesPage initialModal="create" />`; `EmployeeDetailPage` → render `<EmployeesPage initialDetailId={id} />`. Add optional props `initialModal?: 'create'`, `initialDetailId?: string` to EmployeesPage; on mount, open the corresponding modal/drawer. This keeps routes + existing route tests valid while matching the prototype's in-page model.

- [ ] **Step 1: Update EmployeesPage.test.tsx** — keep existing passing assertions; ADD: clicking a row opens the drawer (not navigation); clicking Добавить opens the form modal; status default is 'active'; KindTabs render. Mock `FirestoreAssignmentRepository` + `listAssetsForEmployee` similar to existing asset-repo mock.
- [ ] **Step 2: Run — expect FAIL** for the new assertions.
- [ ] **Step 3: Implement wiring.** Keep the page's loading/error/empty states. Sort additions for dept_asc/assets_desc.
- [ ] **Step 4: Run page tests — expect PASS.**
- [ ] **Step 5: Run full employees test scope:** `npm test -- --run src/pages/EmployeesPage.test.tsx src/components/features/employees`
- [ ] **Step 6: Commit** `feat(employees): wire modal+drawer host page to repositories + toast`

---

### Task 10: i18n keys (ru/en/hy)

**Files:**
- Modify: `src/locales/ru/employees.json`, `en/employees.json`, `hy/employees.json`
- Test: `src/components/features/employees/employees.i18n.test.tsx` (new render-resolves test)

Add namespaced keys for: form modal (already mostly present — add `form.createSubtitle`, `form.editSubtitle`, `form.lockedHint`, validation `firstNameRequired`/`lastNameRequired`/`positionRequired`/`phoneRequired`/`phoneDigits`), detail drawer (`detail.linkAsset`, `detail.handover`, `detail.restore`, `detail.noAssets`, `detail.assets`, `detail.joinedAt`, prop labels reuse `table.*`), handover (`handover.title`, `handover.step1`, `handover.step2`, `handover.markAll`, `handover.unmarkAll`, `handover.next`, `handover.finish`, `handover.remaining`, `handover.destWarehouse`/`employee`/`department`/`branch`), picker (`picker.title`, `picker.groupDevices`/`network`/`furniture`, `picker.cart`, `picker.confirm`, `picker.review`, `picker.empty`, `picker.cancelConfirm`), restore (`restore.title`, `restore.body`, `restore.confirm`), toast (`toast.created`, `toast.updated`, `toast.archived`, `toast.restored`, `toast.linked`, `toast.handover`), kindTabs (`kind.all`, `kind.staff`), sort additions (`filter.sortDeptAsc`, `filter.sortAssetsDesc`).

> **Tier rule:** all these are Tier-1 UI chrome → i18next. No Tier-2 multilang fields here (branch/department names come from their own catalogs). Phone/email/invCode/serial are Tier-4 English/as-is — rendered raw, never translated.

- [ ] **Step 1: Write a render test** that mounts a representative component (e.g. EmployeeFormModal) under `ru`, `en`, `hy` and asserts the title key resolves (no raw `employees.form.createTitle` leaking).
- [ ] **Step 2: Run — FAIL** for missing keys / untranslated.
- [ ] **Step 3: Add all keys to all three locale files** with translations (ru authoritative from prototype strings; en + hy translated). Replace any hardcoded Russian in the new components with `t()` calls.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `feat(employees): i18n keys for modals/drawer/handover/picker (ru/en/hy)`

---

### Task 11: Final verification + visual parity check

**Files:** none (verification)

- [ ] **Step 1: Full test suite (employees scope + regressions)**

Run: `npm test -- --run`
Expected: all pass (or only pre-existing unrelated failures from the dirty branch — diff against Task 0 baseline).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` + `vite build` succeed, no new TS errors in employee files.

- [ ] **Step 3: Lint** (if configured)

Run: `npm run lint` (if present)

- [ ] **Step 4: Manual visual parity** against `http://localhost:5173/employees` AND the prototype `Warehouse/prototypes/employees.html` opened in a browser. Walk the checklist:
  - Filter toolbar: 4 selects, status default Активен, Сбросить appears on change.
  - KindTabs: Все / Сотрудники with counts.
  - Table: 8 columns, 58px rows, sticky header, 10-row footprint with placeholder rows, orange row-hover, chevron, inline restore for archived.
  - Row click → right drawer slides in (clamp width), quick-facts, linked assets, footer "Сдача техники".
  - Добавить → modal create; edit from drawer? (prototype has no edit entry from drawer — verify; create/edit modal reachable per prototype: only create from header + edit is wired via formInitial — confirm prototype has no edit button on the drawer; if so, do NOT add one).
  - Сдача техники → 2-step handover; Привязать актив → 4-step picker; restore → confirm modal; toasts fire.
  - Mobile (≤767px): card list + bottom-sheet behaviors.
- [ ] **Step 5: Commit** any final polish; do NOT merge — leave on `feat/employees-prototype-parity` for review.

---

## Self-review notes (author)

- **Spec coverage:** every prototype component (FilterToolbar, KindTabs, EmployeeTable, PaginationBar, PageHeader, EmployeeFormModal, EmployeeDetailDrawer, HandoverModal/DestPicker, AssetPickerSheet, RestoreConfirmModal, toast, archive/restore/link handlers) has a task. EmployeesTable/PaginationBar already exist in production close to parity → verified in Task 9/11 rather than rebuilt; if Task 11 reveals column/height drift, fix in a follow-up sub-task.
- **Edit entry point:** the prototype's `EmployeeFormModal` supports edit (`formInitial`) but the wired App only opens it for create (`handleCreate`). There is no edit button on the drawer or row in the prototype. Therefore production must NOT invent an edit affordance — build the modal's edit capability (faithful to prototype code) but only wire create, matching the prototype's actual behavior. (If reviewers find a prototype edit trigger I missed, add it.)
- **Backend faithfulness vs mock:** handover persists only warehouse returns (matches prototype's `handleHandoverConfirm` which only writes warehouse returns); redirected destinations in DestPicker are UI-complete but out of MVP persistence scope, exactly as the prototype. Documented.
- **No new domain enum:** archived⇔terminated mapping keeps rules/audit/self-service invariant intact.
- **Placeholder scan:** all code steps contain real code or exact prototype line refs to copy. Repo method names verified against the Explore inventory (`returnAsset`, `assign`, `setStatus`, `listAssetsForEmployee`, `listAssets`, `createEmployee`, `updateEmployee`).
- **Type consistency:** SortValue extended in Task 4 and consumed in Task 9; EmployeeFormSubmit shape consistent between Task 6 and Task 9; Actor built from useAuth in Task 9.
