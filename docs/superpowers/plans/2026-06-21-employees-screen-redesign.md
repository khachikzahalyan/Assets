# Employees Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Employees screen from a sparse 5-column table to the full prototype design — avatar, phone, asset-count pill, branch icon, position+dept two-line cell, sort control, labeled filter chips, and a proper pagination bar — while adding `phone` to the domain and wiring asset counts from Firestore.

**Architecture:** Component-first decomposition: pure utils → `EmployeeAvatar` → `EmployeeRow` (consumes both) → rewritten `EmployeesTable` → rewritten `EmployeesFilterBar` → `EmployeesPage` updates to load asset counts. Domain change (`phone` field) flows through types → both repositories → form.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react via `<Icon>`, Vitest + @testing-library/react, Firestore (no direct import — accessed through repository classes), react-i18next (`t()` for all strings, Russian only).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/domain/employee/types.ts` | Modify | Add `phone: string \| null` to `Employee` |
| `src/infra/repositories/firestoreEmployeeRepository.ts` | Modify | Read/write `phone` field |
| `src/infra/repositories/inMemoryEmployeeRepository.ts` | Modify | Carry `phone` field through create/update |
| `src/components/features/employees/employeeFormat.ts` | Create | `formatLocalPhone`, `employeeInitials`, `employeeAvatarColor` |
| `src/components/features/employees/employeeFormat.test.ts` | Create | Unit tests for the three pure helpers |
| `src/components/features/employees/EmployeeAvatar.tsx` | Create | Circular avatar with initials + deterministic color |
| `src/components/features/employees/EmployeeRow.tsx` | Create | Full single-row component (all 8 columns) |
| `src/components/features/employees/EmployeesTable.tsx` | Rewrite | Sticky 7-col header + `EmployeeRow` map; accepts `assetCounts` |
| `src/components/features/employees/EmployeesFilterBar.tsx` | Rewrite | Labeled filter chips for Dept/Branch/Status/Sort + search |
| `src/components/features/employees/EmployeeForm.tsx` | Modify | Add optional phone field (store digits) |
| `src/components/features/employees/index.ts` | Modify | Re-export new components |
| `src/components/ui/Icon.tsx` | Modify | Register missing icons: `chevron-right` (already present), `rotate-ccw`, `package` (already present), `list-filter`, `circle-dot` (already present) — add `rotate-ccw`, `list-filter` |
| `src/pages/EmployeesPage.tsx` | Modify | Load assets for count tally; add `sort` state; new pagination bar |
| `src/locales/ru/employees.json` | Modify | Add keys: `filter.sort`, `filter.sortUpdatedDesc`, `filter.sortUpdatedAsc`, `filter.sortNameAsc`, `filter.sortNameDesc`, `table.employee`, `table.branch`, `table.position`, `table.phone`, `table.gmail`, `table.assets`, `table.status`, `form.phone`, `pagination.showing` |
| `src/pages/EmployeesPage.test.tsx` | Modify | Add test for asset count column, phone display, sort state |
| `src/components/features/employees/EmployeeForm.test.tsx` | Modify | Add phone field render/submit test |

---

## Task 1: Add `phone` to domain types and both repositories

**Files:**
- Modify: `src/domain/employee/types.ts`
- Modify: `src/infra/repositories/firestoreEmployeeRepository.ts`
- Modify: `src/infra/repositories/inMemoryEmployeeRepository.ts`

- [ ] **Step 1: Add `phone` to Employee interface**

In `src/domain/employee/types.ts`, update the `Employee` interface (after `departmentId`):

```typescript
export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null   // ← add this line
  position: string | null
  branchId: string | null
  departmentId: string | null
  status: EmployeeStatus
  terminatedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Add `phone?: string | null` to `CreateEmployeeInput` in `src/domain/employee/EmployeeRepository.ts`:

```typescript
export interface CreateEmployeeInput {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null      // ← add this line
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}
```

Add `phone?: string | null` to `UpdateEmployeeInput`:

```typescript
export interface UpdateEmployeeInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null      // ← add this line
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}
```

- [ ] **Step 2: Wire phone through firestoreEmployeeRepository**

In `src/infra/repositories/firestoreEmployeeRepository.ts`, update the `toEmployee` mapper to include `phone`:

```typescript
function toEmployee(id: string, d: Record<string, unknown>): Employee {
  return {
    id,
    firstName: String(d.firstName ?? ''),
    lastName: String(d.lastName ?? ''),
    email: String(d.email ?? ''),
    phone: (d.phone as string | null) ?? null,   // ← add this line
    position: (d.position as string | null) ?? null,
    branchId: (d.branchId as string | null) ?? null,
    departmentId: (d.departmentId as string | null) ?? null,
    status: (d.status as EmployeeStatus) ?? 'active',
    terminatedAt: d.terminatedAt == null ? null : toIso(d.terminatedAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}
```

In `createEmployee`, add `phone` to the data object:

```typescript
const data: Record<string, unknown> = {
  firstName: input.firstName, lastName: input.lastName, email: input.email,
  phone: input.phone ?? null,                        // ← add this line
  position: input.position ?? null, branchId: input.branchId ?? null,
  departmentId: input.departmentId ?? null, status: 'active', terminatedAt: null,
  createdBy: actor.uid, updatedBy: actor.uid,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
}
```

- [ ] **Step 3: Wire phone through inMemoryEmployeeRepository**

In `src/infra/repositories/inMemoryEmployeeRepository.ts`, update `createEmployee` to include `phone`:

```typescript
const employee: Employee = {
  id: input.id,
  firstName: input.firstName,
  lastName: input.lastName,
  email: input.email,
  phone: input.phone ?? null,      // ← add this line
  position: input.position ?? null,
  branchId: input.branchId ?? null,
  departmentId: input.departmentId ?? null,
  status: 'active',
  terminatedAt: null,
  createdAt: now,
  updatedAt: now,
}
```

The `updateEmployee` method already uses spread + `stripUndefined(patch)`, so it inherits `phone` automatically once the field is in `UpdateEmployeeInput`.

- [ ] **Step 4: Run typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0. If Employee type complaints appear in test fixtures, update the `emp()` helper in `EmployeesPage.test.tsx` to include `phone: null`.

- [ ] **Step 5: Update the emp() test helper (in EmployeesPage.test.tsx)**

The existing test has:
```typescript
function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', position: null,
    branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}
```

Update to:
```typescript
function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null,
    position: null, branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}
```

- [ ] **Step 6: Run tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run
```

Expected: all 826 tests pass (0 new failures). The only change is adding `phone: null` to the fixture.

---

## Task 2: Create `employeeFormat.ts` utilities + unit tests

**Files:**
- Create: `src/components/features/employees/employeeFormat.ts`
- Create: `src/components/features/employees/employeeFormat.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/components/features/employees/employeeFormat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatLocalPhone, employeeInitials, employeeAvatarColor } from './employeeFormat'

describe('formatLocalPhone', () => {
  it('formats a full 9-digit Armenian number', () => {
    expect(formatLocalPhone('099123456')).toBe('099 12 34 56')
  })
  it('formats when leading zero is missing', () => {
    expect(formatLocalPhone('99123456')).toBe('099 12 34 56')
  })
  it('strips E.164 country code +374', () => {
    expect(formatLocalPhone('+37499123456')).toBe('099 12 34 56')
  })
  it('returns raw digits when fewer than 9 digits', () => {
    expect(formatLocalPhone('099123')).toBe('099123')
  })
  it('returns empty string for null/undefined', () => {
    expect(formatLocalPhone(null)).toBe('')
    expect(formatLocalPhone(undefined)).toBe('')
    expect(formatLocalPhone('')).toBe('')
  })
  it('strips non-digit characters', () => {
    expect(formatLocalPhone('099-12-34-56')).toBe('099 12 34 56')
  })
})

describe('employeeInitials', () => {
  it('returns first letters of first and last name', () => {
    expect(employeeInitials('Иван', 'Петров')).toBe('ИП')
  })
  it('returns single initial when only first name', () => {
    expect(employeeInitials('Иван', '')).toBe('И')
  })
  it('returns ? for empty inputs', () => {
    expect(employeeInitials('', '')).toBe('?')
  })
  it('handles undefined gracefully', () => {
    expect(employeeInitials(undefined, undefined)).toBe('?')
  })
})

describe('employeeAvatarColor', () => {
  it('returns a Tailwind bg class', () => {
    const color = employeeAvatarColor('user_123')
    expect(color).toMatch(/^bg-/)
  })
  it('is deterministic — same id always gives same color', () => {
    expect(employeeAvatarColor('abc')).toBe(employeeAvatarColor('abc'))
  })
  it('uses fallback for empty id', () => {
    expect(employeeAvatarColor('')).toMatch(/^bg-/)
  })
  it('distributes across the palette (different ids give different colors sometimes)', () => {
    const colors = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map(employeeAvatarColor)
    const unique = new Set(colors)
    expect(unique.size).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run the failing tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run src/components/features/employees/employeeFormat.test.ts
```

Expected: FAIL — `employeeFormat.ts` doesn't exist yet.

- [ ] **Step 3: Implement employeeFormat.ts**

Create `src/components/features/employees/employeeFormat.ts`:

```typescript
const AVATAR_PALETTE = [
  'bg-[#F97316]',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-600',
  'bg-orange-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-blue-500',
  'bg-lime-600',
] as const

/**
 * Normalise an Armenian phone input to exactly 9 digits (leading 0 + 8 digits).
 * Accepts: raw digits, E.164 (+374…), partially formatted, null/undefined.
 * Returns '' when there is no meaningful input or fewer than 9 digits can be recovered.
 */
function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let d = String(input).replace(/\D/g, '') // digits only
  if (d.startsWith('374')) d = d.slice(3)   // strip +374 country code
  if (!d) return ''
  if (!d.startsWith('0')) d = '0' + d        // ensure leading 0
  return d.slice(0, 9)                       // cap at 9 digits
}

/**
 * Formats an Armenian local phone for display as `0XX XX XX XX`.
 * Returns raw (normalised) digits for incomplete numbers, '' for missing.
 */
export function formatLocalPhone(input: string | null | undefined): string {
  const d = normalizePhone(input)
  if (d.length === 9) {
    return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
  }
  return d
}

/**
 * Returns 1–2 uppercase initials from firstName + lastName.
 * Falls back to '?' when both are empty.
 */
export function employeeInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const parts = [firstName, lastName]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')
}

/**
 * Deterministically picks a Tailwind bg-* class from AVATAR_PALETTE
 * based on the employee's id (stable across renders).
 */
export function employeeAvatarColor(id: string | null | undefined): string {
  if (!id) return AVATAR_PALETTE[0]
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run src/components/features/employees/employeeFormat.test.ts
```

Expected: all 15 tests PASS.

---

## Task 3: Register missing icons in Icon.tsx

**Files:**
- Modify: `src/components/ui/Icon.tsx`

The existing registry is missing: `rotate-ccw`, `list-filter`. `chevron-right`, `package`, `circle-dot`, `landmark`, `building` are already present.

- [ ] **Step 1: Add RotateCcw and ListFilter to Icon.tsx imports**

In `src/components/ui/Icon.tsx`, add to the lucide-react import block:

```typescript
import {
  // ... existing imports ...
  RotateCcw,
  ListFilter,
  type LucideIcon,
} from 'lucide-react'
```

- [ ] **Step 2: Register the new icons in REGISTRY**

In the REGISTRY object, add:

```typescript
'rotate-ccw': RotateCcw,
'list-filter': ListFilter,
```

- [ ] **Step 3: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0.

---

## Task 4: Create `EmployeeAvatar.tsx`

**Files:**
- Create: `src/components/features/employees/EmployeeAvatar.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/features/employees/EmployeeAvatar.tsx`:

```typescript
import { employeeInitials, employeeAvatarColor } from './employeeFormat'

export interface EmployeeAvatarProps {
  firstName: string
  lastName: string
  id: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-7 h-7 text-[12.5px]',
  md: 'w-9 h-9 text-[14px]',
  lg: 'w-12 h-12 text-[16px]',
} as const

export function EmployeeAvatar({ firstName, lastName, id, size = 'md' }: EmployeeAvatarProps) {
  const initials = employeeInitials(firstName, lastName)
  const colorClass = employeeAvatarColor(id)

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full text-white font-bold tracking-tight select-none flex-shrink-0 ${colorClass} ${SIZES[size]}`}
    >
      {initials}
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0.

---

## Task 5: Create `EmployeeRow.tsx`

**Files:**
- Create: `src/components/features/employees/EmployeeRow.tsx`

This is the most complex component — one table row with all 8 columns matching the prototype exactly.

- [ ] **Step 1: Create EmployeeRow.tsx**

Create `src/components/features/employees/EmployeeRow.tsx`:

```typescript
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { EmployeeAvatar } from './EmployeeAvatar'
import { formatLocalPhone } from './employeeFormat'
import type { Employee } from '@/domain/employee'

// Grid columns matching prototype EMP_GRID_COLS
const GRID_COLS =
  'minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px'

export interface EmployeeRowProps {
  employee: Employee
  branchName: string
  isHeadOffice: boolean
  deptName: string
  assetCount: number
  onClick: () => void
}

export function EmployeeRow({
  employee,
  branchName,
  isHeadOffice,
  deptName,
  assetCount,
  onClick,
}: EmployeeRowProps) {
  const { t } = useTranslation('employees')

  const statusColor = employee.status === 'active' ? 'green' : 'gray'

  return (
    <div
      role="row"
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      tabIndex={0}
      className="group cursor-pointer transition-colors duration-150 hover:bg-[rgba(249,115,22,0.08)] border-t border-[#2A2F36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-inset"
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        flex: '1 1 0',
        minHeight: '58px',
        alignItems: 'center',
      }}
    >
      {/* 1 — Employee: avatar + full name */}
      <div
        role="cell"
        className="flex items-center gap-2.5 overflow-hidden px-3 h-full min-w-0"
        style={{ paddingLeft: '20px' }}
      >
        <EmployeeAvatar firstName={employee.firstName} lastName={employee.lastName} id={employee.id} size="sm" />
        <span className="text-[15px] font-semibold text-[#F8FAFC] truncate leading-tight">
          {employee.firstName} {employee.lastName}
        </span>
      </div>

      {/* 2 — Branch: icon + name */}
      <div role="cell" className="flex items-center gap-1.5 overflow-hidden px-3 h-full min-w-0">
        <span
          className="shrink-0 inline-flex"
          style={{ color: isHeadOffice ? '#10B981' : '#38BDF8' }}
        >
          <Icon name={isHeadOffice ? 'landmark' : 'building'} size={12} />
        </span>
        <span className="text-[14.5px] text-[#CBD5E1] truncate">
          {branchName || <span className="text-[#64748B]">—</span>}
        </span>
      </div>

      {/* 3 — Position (primary) + Department (secondary) */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <div className="min-w-0 w-full">
          <div className="text-[14.5px] font-medium text-[#F8FAFC] truncate whitespace-nowrap leading-tight">
            {employee.position || <span className="text-[#64748B]">—</span>}
          </div>
          <div className="text-[13px] text-[#94A3B8] truncate whitespace-nowrap leading-tight mt-0.5">
            {deptName || <span className="text-[#64748B]">—</span>}
          </div>
        </div>
      </div>

      {/* 4 — Phone */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        {employee.phone ? (
          <span className="text-[14px] text-[#CBD5E1] font-mono tabular-nums whitespace-nowrap truncate">
            {formatLocalPhone(employee.phone)}
          </span>
        ) : (
          <span className="text-[14px] text-[#64748B]" aria-label={t('table.phone')}>—</span>
        )}
      </div>

      {/* 5 — Gmail */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        {employee.email ? (
          <span className="text-[14px] text-[#94A3B8] truncate inline-block max-w-full">
            {employee.email}
          </span>
        ) : (
          <span className="text-[14px] text-[#64748B]">—</span>
        )}
      </div>

      {/* 6 — Asset count pill */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[14px] font-medium px-1.5 py-0.5 rounded border ${
            assetCount === 0
              ? 'text-[#64748B] bg-[#111315] border-[#2A2F36]'
              : 'text-[#CBD5E1] bg-[#111315] border-[#2A2F36]/70'
          }`}
          aria-label={t('table.assets')}
        >
          <Icon name="package" size={11} className="text-[#64748B]" />
          {assetCount}
        </span>
      </div>

      {/* 7 — Status chip */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <Chip color={statusColor} dot>
          {t(`status.${employee.status}`)}
        </Chip>
      </div>

      {/* 8 — Chevron actions */}
      <div
        role="cell"
        className="flex items-center justify-end overflow-hidden px-3 h-full min-w-0"
        style={{ paddingRight: '12px' }}
      >
        <Icon
          name="chevron-right"
          size={14}
          className="text-[#64748B] group-hover:text-[#FB923C] transition-colors duration-150"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0.

---

## Task 6: Rewrite `EmployeesTable.tsx`

**Files:**
- Rewrite: `src/components/features/employees/EmployeesTable.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `src/components/features/employees/EmployeesTable.tsx` with:

```typescript
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EmployeeRow } from './EmployeeRow'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

// Grid columns — must match EmployeeRow exactly
const GRID_COLS =
  'minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px'

// The first branch in any list is treated as head office by convention; the
// true head-office check compares against the configured branch id.
// Since the domain does not carry a headOffice flag on RefRow, we expose it
// via a prop so the page can pass it down.
export interface EmployeesTableProps {
  rows: Employee[]
  branches: RefRow[]
  departments: RefRow[]
  /** Map of employee id → assigned asset count. */
  assetCounts: Record<string, number>
  /** The branch id that represents the head office (uses landmark icon + green). */
  headOfficeBranchId?: string | null
  onRowClick: (e: Employee) => void
}

export function EmployeesTable({
  rows,
  branches,
  departments,
  assetCounts,
  headOfficeBranchId,
  onRowClick,
}: EmployeesTableProps) {
  const { t } = useTranslation('employees')

  const { branchMap, deptMap } = useMemo(
    () => ({
      branchMap: new Map(branches.map(b => [b.id, b.name])),
      deptMap:   new Map(departments.map(d => [d.id, d.name])),
    }),
    [branches, departments],
  )

  return (
    <div
      role="table"
      aria-label={t('title')}
      className="w-full"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Sticky header */}
      <div
        role="rowgroup"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          height: '44px',
          minHeight: '44px',
          alignItems: 'center',
          background: '#111315',
          borderBottom: '1px solid rgba(42,47,54,0.9)',
        }}
      >
        {[
          { label: t('table.employee'), pl: '20px' },
          { label: t('table.branch'), pl: '12px' },
          { label: t('table.position'), pl: '12px' },
          { label: t('table.phone'), pl: '12px' },
          { label: t('table.gmail'), pl: '12px' },
          { label: t('table.assets'), pl: '12px' },
          { label: t('table.status'), pl: '12px' },
          { label: '', pl: '12px' },
        ].map(({ label, pl }, i) => (
          <div
            key={i}
            role="columnheader"
            scope="col"
            className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-[#94A3B8] truncate overflow-hidden min-w-0"
            style={{ paddingLeft: pl }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Data rows */}
      <div role="rowgroup" style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map(emp => (
          <EmployeeRow
            key={emp.id}
            employee={emp}
            branchName={emp.branchId ? (branchMap.get(emp.branchId) ?? '') : ''}
            isHeadOffice={!!headOfficeBranchId && emp.branchId === headOfficeBranchId}
            deptName={emp.departmentId ? (deptMap.get(emp.departmentId) ?? '') : ''}
            assetCount={assetCounts[emp.id] ?? 0}
            onClick={() => onRowClick(emp)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0. EmployeesPage will have a type error at the EmployeesTable call site (missing `assetCounts` prop) — that's fixed in Task 8.

---

## Task 7: Rewrite `EmployeesFilterBar.tsx`

**Files:**
- Modify: `src/locales/ru/employees.json` — add sort/table keys first
- Rewrite: `src/components/features/employees/EmployeesFilterBar.tsx`

- [ ] **Step 1: Add i18n keys to ru/employees.json**

Open `src/locales/ru/employees.json`. Add the following top-level and nested keys. The file already contains `filter`, `table` is new, and `pagination` partially exists.

Merge these additions into the existing JSON (keep all current keys, add the new ones):

```json
{
  "filter": {
    "all": "Все",
    "branch": "Филиал",
    "department": "Отдел",
    "search": "Поиск по имени, должности…",
    "status": "Статус",
    "sort": "Сорт.",
    "sortUpdatedDesc": "Сначала новые",
    "sortUpdatedAsc": "Сначала старые",
    "sortNameAsc": "Имя А → Я",
    "sortNameDesc": "Имя Я → А",
    "reset": "Сбросить"
  },
  "table": {
    "employee": "Сотрудник",
    "branch": "Филиал",
    "position": "Должность",
    "phone": "Телефон",
    "gmail": "Gmail",
    "assets": "Активы",
    "status": "Статус"
  },
  "form": {
    "phone": "Телефон"
  },
  "pagination": {
    "range": "{{from}}–{{to}} / {{total}}",
    "showing": "Показано {{from}}–{{to}} из {{total}}"
  }
}
```

The complete updated `employees.json` (ALL keys including existing ones):

```json
{
  "create": "Добавить сотрудника",
  "detail": {
    "acts": "Подписанные акты",
    "assets": "Закреплённые активы",
    "noActs": "Нет подписанных актов",
    "noAssets": "Нет закреплённых активов",
    "profile": "Профиль",
    "reactivate": "Восстановить",
    "terminate": "Уволить",
    "viewScan": "Открыть скан"
  },
  "empty": {
    "desc": "Добавьте первого сотрудника",
    "title": "Сотрудников пока нет"
  },
  "filter": {
    "all": "Все",
    "branch": "Филиал",
    "department": "Отдел",
    "search": "Поиск по имени, должности…",
    "status": "Статус",
    "sort": "Сорт.",
    "sortUpdatedDesc": "Сначала новые",
    "sortUpdatedAsc": "Сначала старые",
    "sortNameAsc": "Имя А → Я",
    "sortNameDesc": "Имя Я → А",
    "reset": "Сбросить"
  },
  "table": {
    "employee": "Сотрудник",
    "branch": "Филиал",
    "position": "Должность",
    "phone": "Телефон",
    "gmail": "Gmail",
    "assets": "Активы",
    "status": "Статус"
  },
  "form": {
    "branch": "Филиал",
    "cancel": "Отмена",
    "createTitle": "Новый сотрудник",
    "department": "Отдел",
    "editTitle": "Редактирование сотрудника",
    "email": "Корпоративная почта",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "notFound": "Сотрудник не найден",
    "phone": "Телефон",
    "pickBranch": "Выберите филиал",
    "pickDepartment": "Выберите отдел",
    "position": "Должность",
    "save": "Сохранить",
    "uid": "ID пользователя (uid)",
    "uidHint": "Firebase Auth uid сотрудника. Совпадает с users/{uid}."
  },
  "self": {
    "myActs": "Мои акты",
    "myAssets": "Мои активы",
    "noActs": "У вас нет подписанных актов",
    "noAssets": "За вами не закреплены активы",
    "noProfile": "Ваш профиль ещё не заполнен. Обратитесь к администратору.",
    "profile": "Мой профиль"
  },
  "status": {
    "active": "Активен",
    "terminated": "Уволен"
  },
  "pagination": {
    "range": "{{from}}–{{to}} / {{total}}",
    "showing": "Показано {{from}}–{{to}} из {{total}}"
  },
  "title": "Сотрудники",
  "validation": {
    "emailFormat": "Введите корректный email",
    "emailTaken": "Этот email уже используется",
    "required": "Обязательное поле",
    "saveFailed": "Не удалось сохранить. Попробуйте ещё раз.",
    "uidRequired": "Укажите uid"
  }
}
```

- [ ] **Step 2: Define the SortValue type and update EmployeeListQuery**

`EmployeeListQuery` in `src/domain/employee/types.ts` does not currently have a `sort` field. Add it:

```typescript
export type SortValue =
  | 'updated_desc'
  | 'updated_asc'
  | 'name_asc'
  | 'name_desc'

export interface EmployeeListQuery {
  status?: EmployeeStatus | 'all'
  branchId?: string | 'all'
  departmentId?: string | 'all'
  search?: string
  sort?: SortValue
}
```

- [ ] **Step 3: Create SelectMini — a labeled dropdown chip**

The filter bar uses labeled dropdowns that look like `[LABEL value ▼]`. There is no existing `SelectMini` in the codebase. Create it at `src/components/ui/SelectMini.tsx`:

```typescript
import { Icon } from './Icon'

export interface SelectMiniOption {
  value: string
  label: string
}

export interface SelectMiniProps {
  label: string
  leadingIcon?: string
  value: string
  onChange: (v: string) => void
  options: SelectMiniOption[]
  id?: string
}

/**
 * Compact labeled select chip styled for filter bars.
 * Renders as: [icon LABEL value ▾]
 */
export function SelectMini({ label, leadingIcon, value, onChange, options, id }: SelectMiniProps) {
  const current = options.find(o => o.value === value)

  return (
    <label
      htmlFor={id ?? `select-mini-${label}`}
      className="relative inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#1B1F24] border border-[#2A2F36] text-[13px] font-semibold text-[#94A3B8] cursor-pointer hover:border-[#3A4048] transition-colors duration-150 select-none"
    >
      {leadingIcon && (
        <span className="text-[#64748B] flex-shrink-0">
          <Icon name={leadingIcon} size={12} />
        </span>
      )}
      <span className="uppercase tracking-[0.07em] text-[11px] text-[#64748B]">{label}</span>
      <span className="text-[#CBD5E1] ml-0.5">{current?.label ?? value}</span>
      <Icon name="chevron-down" size={11} className="text-[#64748B] ml-0.5" />
      <select
        id={id ?? `select-mini-${label}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full"
        aria-label={label}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
```

Export from `src/components/ui/index.ts` (add the line):

```typescript
export * from './SelectMini'
```

- [ ] **Step 4: Rewrite EmployeesFilterBar.tsx**

Replace the entire contents of `src/components/features/employees/EmployeesFilterBar.tsx`:

```typescript
import { useTranslation } from 'react-i18next'
import { Icon, Btn, SelectMini } from '@/components/ui'
import type { EmployeeListQuery, SortValue } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import type { SelectMiniOption } from '@/components/ui/SelectMini'

export interface EmployeesFilterBarProps {
  query: EmployeeListQuery
  onChange: (patch: Partial<EmployeeListQuery>) => void
  branches: RefRow[]
  departments: RefRow[]
}

const DEFAULT_QUERY: Required<Omit<EmployeeListQuery, 'sort'>> & { sort: SortValue } = {
  status: 'all',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

function isDirty(query: EmployeeListQuery): boolean {
  return (
    (query.status ?? 'all') !== DEFAULT_QUERY.status ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY.branchId ||
    (query.departmentId ?? 'all') !== DEFAULT_QUERY.departmentId ||
    (query.search ?? '') !== DEFAULT_QUERY.search ||
    (query.sort ?? 'updated_desc') !== DEFAULT_QUERY.sort
  )
}

export function EmployeesFilterBar({ query, onChange, branches, departments }: EmployeesFilterBarProps) {
  const { t } = useTranslation('employees')

  const deptOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ]

  const branchOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all') },
    ...branches.map(b => ({ value: b.id, label: b.name })),
  ]

  const statusOptions: SelectMiniOption[] = [
    { value: 'all',        label: t('filter.all') },
    { value: 'active',     label: t('status.active') },
    { value: 'terminated', label: t('status.terminated') },
  ]

  const sortOptions: SelectMiniOption[] = [
    { value: 'updated_desc', label: t('filter.sortUpdatedDesc') },
    { value: 'updated_asc',  label: t('filter.sortUpdatedAsc') },
    { value: 'name_asc',     label: t('filter.sortNameAsc') },
    { value: 'name_desc',    label: t('filter.sortNameDesc') },
  ]

  const dirty = isDirty(query)

  return (
    <div className="flex items-center gap-2 px-0 py-1 flex-wrap">
      <SelectMini
        id="emp-filter-dept"
        label={t('filter.department')}
        leadingIcon="users"
        value={query.departmentId ?? 'all'}
        onChange={v => onChange({ departmentId: v })}
        options={deptOptions}
      />
      <SelectMini
        id="emp-filter-branch"
        label={t('filter.branch')}
        leadingIcon="building"
        value={query.branchId ?? 'all'}
        onChange={v => onChange({ branchId: v })}
        options={branchOptions}
      />
      <SelectMini
        id="emp-filter-status"
        label={t('filter.status')}
        leadingIcon="circle-dot"
        value={query.status ?? 'active'}
        onChange={v => {
          const s = v === 'all' || v === 'active' || v === 'terminated' ? v : 'all'
          onChange({ status: s })
        }}
        options={statusOptions}
      />
      <SelectMini
        id="emp-filter-sort"
        label={t('filter.sort')}
        leadingIcon="list-filter"
        value={query.sort ?? 'updated_desc'}
        onChange={v => onChange({ sort: v as SortValue })}
        options={sortOptions}
      />

      {/* Search — flex-1 pushes right */}
      <div className="relative flex-1 min-w-[200px] ml-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
          <Icon name="search" size={13} />
        </span>
        <input
          id="employees-search"
          type="search"
          value={query.search ?? ''}
          onChange={e => onChange({ search: e.target.value })}
          placeholder={t('filter.search')}
          className="w-full h-8 pl-8 pr-3 text-[13px] bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
          aria-label={t('filter.search')}
        />
      </div>

      {dirty && (
        <Btn
          variant="ghost"
          size="sm"
          onClick={() => onChange({
            status: 'all',
            branchId: 'all',
            departmentId: 'all',
            search: '',
            sort: 'updated_desc',
          })}
          aria-label={t('filter.reset')}
        >
          <Icon name="rotate-ccw" size={12} />
          {t('filter.reset')}
        </Btn>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Export SelectMini from ui/index.ts**

Read `src/components/ui/index.ts`. Add at the end:
```typescript
export * from './SelectMini'
export type { SelectMiniOption } from './SelectMini'
```

- [ ] **Step 6: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0.

---

## Task 8: Update `EmployeesPage.tsx` — asset counts, sort, pagination bar

**Files:**
- Modify: `src/pages/EmployeesPage.tsx`

- [ ] **Step 1: Rewrite EmployeesPage.tsx**

Replace the entire file with:

```typescript
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState,
} from '@/components/ui'
import { EmployeesFilterBar, EmployeesTable } from '@/components/features/employees'
import type { Employee, EmployeeListQuery, EmployeeRepository, SortValue } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import { FirestoreEmployeeRepository, FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

const DEFAULT_QUERY: Required<EmployeeListQuery> = {
  status: 'all',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

export interface EmployeesPageProps {
  repository?: EmployeeRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
  /** Optional: pre-loaded asset counts map. If omitted, the page loads assets via FirestoreAssetRepository. */
  assetCounts?: Record<string, number>
}

function sortEmployees(employees: Employee[], sort: SortValue): Employee[] {
  const copy = [...employees]
  switch (sort) {
    case 'updated_desc':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'updated_asc':
      return copy.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    case 'name_asc':
      return copy.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'ru'),
      )
    case 'name_desc':
      return copy.sort((a, b) =>
        `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`, 'ru'),
      )
    default:
      return copy
  }
}

export function EmployeesPage({ repository, loadRefData, assetCounts: assetCountsProp }: EmployeesPageProps) {
  const { t } = useTranslation('employees')
  const navigate = useNavigate()
  const { role } = useAuth()

  // Lazy default repos — test callers inject their own
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultLoadRefData = useMemo(
    () => async () => {
      const assetRepo = new FirestoreAssetRepository(db())
      const r = await assetRepo.loadReferenceData()
      return { branches: r.branches, departments: r.departments }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const refLoader = loadRefData ?? defaultLoadRefData

  const defaultLoadAssetCounts = useMemo(
    () => async (): Promise<Record<string, number>> => {
      const assetRepo = new FirestoreAssetRepository(db())
      const assets = await assetRepo.listAssets({ statusId: 'all' })
      const counts: Record<string, number> = {}
      for (const asset of assets) {
        if (asset.assignment?.mode === 'employee' && asset.assignment.employeeId) {
          const eid = asset.assignment.employeeId
          counts[eid] = (counts[eid] ?? 0) + 1
        }
      }
      return counts
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const [query, setQuery]           = useState<EmployeeListQuery>({ ...DEFAULT_QUERY })
  const [page, setPage]             = useState(1)
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [branches, setBranches]     = useState<RefRow[]>([])
  const [departments, setDepts]     = useState<RefRow[]>([])
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>(assetCountsProp ?? {})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const handleQueryChange = useCallback((patch: Partial<EmployeeListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Strip sort from the repo query — sorting is done client-side
      const { sort: _sort, ...repoQuery } = query
      const [emps, ref] = await Promise.all([
        repo.listEmployees(repoQuery),
        refLoader(),
      ])
      setEmployees(emps)
      setBranches(ref.branches)
      setDepts(ref.departments)
      // Only load asset counts when no prop override provided
      if (!assetCountsProp) {
        const counts = await defaultLoadAssetCounts()
        setAssetCounts(counts)
      }
    } catch {
      setError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, refLoader, query, t, assetCountsProp, defaultLoadAssetCounts])

  useEffect(() => {
    void load()
  }, [load])

  // Client-side sort
  const sorted = useMemo(
    () => sortEmployees(employees, (query.sort ?? 'updated_desc') as SortValue),
    [employees, query.sort],
  )

  // Derive head office branch id — first branch is head office (no domain flag yet)
  const headOfficeBranchId = branches[0]?.id ?? null

  // Pagination
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const from       = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to         = Math.min(page * PAGE_SIZE, totalCount)
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Windowed page numbers (up to 5 visible)
  const windowSize = 5
  const winStart   = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const winEnd     = Math.min(totalPages, winStart + windowSize - 1)
  const pageNums   = Array.from({ length: Math.max(0, winEnd - winStart + 1) }, (_, i) => winStart + i)

  function goTo(p: number) { setPage(Math.min(Math.max(1, p), totalPages)) }

  function renderPagination() {
    if (totalCount <= PAGE_SIZE) return null
    return (
      <div className="flex items-center justify-between px-1 py-2 border-t border-[#2A2F36] mt-1">
        <span className="text-[14px] text-[#94A3B8] tabular-nums">
          {t('pagination.showing', { from, to, total: totalCount })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#F8FAFC] hover:bg-[#22272E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
            aria-label="Previous page"
          >
            <Icon name="chevron-right" size={14} className="rotate-180" />
          </button>
          {winStart > 1 && (
            <>
              <button type="button" onClick={() => goTo(1)} className="w-8 h-8 rounded-md text-[14px] font-semibold text-[#F8FAFC] hover:bg-[#22272E]">1</button>
              {winStart > 2 && <span className="px-1 text-[#64748B] text-[14px]">…</span>}
            </>
          )}
          {pageNums.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`w-8 h-8 rounded-md text-[14px] font-semibold tabular-nums transition-colors duration-100 ${
                p === page
                  ? 'bg-[#F97316] text-white shadow-sm shadow-[#F97316]/25'
                  : 'text-[#F8FAFC] hover:bg-[#22272E]'
              }`}
            >
              {p}
            </button>
          ))}
          {winEnd < totalPages && (
            <>
              {winEnd < totalPages - 1 && <span className="px-1 text-[#64748B] text-[14px]">…</span>}
              <button type="button" onClick={() => goTo(totalPages)} className="w-8 h-8 rounded-md text-[14px] font-semibold text-[#F8FAFC] hover:bg-[#22272E]">{totalPages}</button>
            </>
          )}
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#F8FAFC] hover:bg-[#22272E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
            aria-label="Next page"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderBody() {
    if (loading) return <LoadingState rows={8} />
    if (error)   return <ErrorState onRetry={load} />
    if (sorted.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }
    return (
      <>
        <EmployeesTable
          rows={pageRows}
          branches={branches}
          departments={departments}
          assetCounts={assetCounts}
          headOfficeBranchId={headOfficeBranchId}
          onRowClick={e => navigate(`/employees/${e.id}`)}
        />
        {renderPagination()}
      </>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="users"
        title={t('title')}
        {...(!loading ? { count: totalCount } : {})}
        {...(canMutate ? {
          actions: (
            <Btn variant="primary" size="md" onClick={() => navigate('/employees/new')}>
              <Icon name="users" size={14} />
              {t('create')}
            </Btn>
          ),
        } : {})}
      />

      <SectionCard noHeader>
        <div className="space-y-3">
          <EmployeesFilterBar
            query={query}
            onChange={handleQueryChange}
            branches={branches}
            departments={departments}
          />
          {renderBody()}
        </div>
      </SectionCard>
    </div>
  )
}
```

- [ ] **Step 2: Check FirestoreAssetRepository.listAssets signature**

The page calls `assetRepo.listAssets({ statusId: 'all' })`. Verify this signature is valid by checking `src/infra/repositories/firestoreAssetRepository.ts`. If `listAssets` requires a different argument structure (e.g., no `statusId: 'all'`), adjust the call accordingly — pass an empty object `{}` or the correct "fetch all" argument.

- [ ] **Step 3: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0.

---

## Task 9: Add phone field to `EmployeeForm.tsx`

**Files:**
- Modify: `src/components/features/employees/EmployeeForm.tsx`

- [ ] **Step 1: Add phone state and field to EmployeeForm**

In `EmployeeFormSubmit` interface, add:
```typescript
export interface EmployeeFormSubmit {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string | null       // ← add this
  position: string | null
  branchId: string | null
  departmentId: string | null
}
```

In the component body, add phone state after the `position` state:
```typescript
const [phone, setPhone] = useState(initial?.phone ?? '')
```

In `handleSubmit`, add phone to the submitted object:
```typescript
onSubmit({
  ...(mode === 'create' ? { id: uid.trim() } : {}),
  firstName:    firstName.trim(),
  lastName:     lastName.trim(),
  email:        email.trim(),
  phone:        phone.trim() || null,     // ← add this
  position:     position.trim() || null,
  branchId:     branchId || null,
  departmentId: departmentId || null,
})
```

Add the phone input field after the Position field:
```tsx
{/* Phone */}
<div>
  <label htmlFor="emp-phone" className={LABEL_CLS}>
    {t('form.phone')}
  </label>
  <Input
    id="emp-phone"
    value={phone}
    onChange={setPhone}
    placeholder="099 12 34 56"
    mono
  />
</div>
```

- [ ] **Step 2: Typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0. If there are callers of `EmployeeForm` that pass `onSubmit` and now have a type error on the returned object missing `phone`, they will need to be updated too. The primary caller is the employees new/edit page — update its `onSubmit` handler to pass `phone: v.phone` to the repository's `createEmployee`/`updateEmployee`.

---

## Task 10: Update barrel and run all tests

**Files:**
- Modify: `src/components/features/employees/index.ts`
- Modify: `src/pages/EmployeesPage.test.tsx`

- [ ] **Step 1: Update the employees barrel file**

Replace contents of `src/components/features/employees/index.ts`:

```typescript
export * from './EmployeesTable'
export * from './EmployeesFilterBar'
export * from './EmployeeForm'
export * from './EmployeeAvatar'
export * from './EmployeeRow'
export * from './employeeFormat'
```

- [ ] **Step 2: Update EmployeesPage.test.tsx**

The existing tests will still pass since they check for `Иван Петров` text and empty state. However, we should add tests for the new props.

Replace the full test file:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { EmployeesPage } from './EmployeesPage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'

// Mock Firebase so EmployeesPage's lazy defaultRepo doesn't crash
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreEmployeeRepository: class {
      async listEmployees() { return [] }
    },
    FirestoreAssetRepository: class {
      async loadReferenceData() { return { statuses: [], branches: [], departments: [], categories: [], employees: [] } }
      async listAssets() { return [] }
    },
  }
})

function authCtx(role: 'super_admin' | 'asset_admin' | 'employee') {
  return {
    user: { id: 'u_1', name: 'A', email: 'a@x', role, initials: 'A', avatarColor: '' },
    role, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
}

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null,
    position: null, branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}

function renderPage(
  employees: Employee[],
  role: 'super_admin' | 'asset_admin' = 'asset_admin',
  assetCounts: Record<string, number> = {},
) {
  const repo = new InMemoryEmployeeRepository(employees)
  const refLoader = async () => ({ branches: [], departments: [] })
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <MemoryRouter>
          <EmployeesPage repository={repo} loadRefData={refLoader} assetCounts={assetCounts} />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('EmployeesPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders an employee row with full name', async () => {
    renderPage([emp()])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })

  it('shows empty state when there are no employees', async () => {
    renderPage([])
    expect(await screen.findByText(/Сотрудников пока нет/)).toBeInTheDocument()
  })

  it('passes asset count 0 when not provided', async () => {
    renderPage([emp()])
    // The asset count pill shows "0" for employees with no assets
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
    // The digit "0" appears in the asset count pill
    const cells = await screen.findAllByText('0')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows asset count when passed via prop', async () => {
    renderPage([emp({ id: 'uid_1' })], 'asset_admin', { uid_1: 3 })
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('renders phone when employee has phone', async () => {
    renderPage([emp({ phone: '099123456' })])
    expect(await screen.findByText('099 12 34 56')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run full test suite**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run
```

Expected: all tests pass. If the `EmployeeForm.test.tsx` fails because `EmployeeFormSubmit` now requires `phone`, update the EmployeeForm tests:

In `src/components/features/employees/EmployeeForm.test.tsx`, the existing tests only test `isValidEmail` (a pure function) — they don't test form submission and should still pass. If a form submission test is added in the next step, it will include `phone`.

- [ ] **Step 4: Add phone field test to EmployeeForm.test.tsx**

Replace the full file:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeForm, isValidEmail } from './EmployeeForm'

describe('isValidEmail', () => {
  it('accepts a normal address', () => { expect(isValidEmail('i@x.com')).toBe(true) })
  it('rejects malformed', () => {
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
})

describe('EmployeeForm phone field', () => {
  it('renders the phone input in create mode', async () => {
    await i18n.changeLanguage('ru')
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeForm
          mode="create"
          branches={[]}
          departments={[]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(screen.getByLabelText('Телефон')).toBeInTheDocument()
  })

  it('renders the phone input in edit mode', async () => {
    await i18n.changeLanguage('ru')
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeForm
          mode="edit"
          initial={{ phone: '099123456' }}
          branches={[]}
          departments={[]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    const input = screen.getByLabelText('Телефон') as HTMLInputElement
    expect(input.value).toBe('099123456')
  })
})
```

- [ ] **Step 5: Run tests again**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run
```

Expected: all tests pass.

---

## Task 11: Final typecheck and build verification

- [ ] **Step 1: Full typecheck**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run typecheck
```

Expected: exit 0, 0 errors.

- [ ] **Step 2: Full test run**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run test -- --run
```

Expected: 0 new failures vs baseline (originally 826 tests; new tests added are in `employeeFormat.test.ts`, updated `EmployeesPage.test.tsx`, updated `EmployeeForm.test.tsx`).

- [ ] **Step 3: Check for any FirestoreAssetRepository.listAssets type mismatch**

If step 8's `assetRepo.listAssets({ statusId: 'all' })` produced a type error, fix by checking the actual `AssetListQuery` type definition and adjusting the argument. The common pattern is `listAssets({})` for all assets.

---

## Self-Review Against Spec

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| `employeeFormat.ts` with 3 helpers + unit tests | Task 2 |
| `EmployeeAvatar` with initials + color + size variants | Task 4 |
| `EmployeeRow` with all 8 columns | Task 5 |
| Rewrite `EmployeesTable` with sticky 7-col header + `assetCounts` | Task 6 |
| Rewrite `EmployeesFilterBar` with labeled chips + sort | Task 7 |
| `phone` field in domain types | Task 1 |
| `phone` field in both repos | Task 1 |
| `phone` field in EmployeeForm | Task 9 |
| Asset counts loaded in EmployeesPage | Task 8 |
| Client-side sort in EmployeesPage | Task 8 |
| New pagination bar (numbered, windowed) | Task 8 |
| i18n keys (ru only) | Task 7 |
| Register missing icons | Task 3 |
| Unit tests for employeeFormat | Task 2 |
| Updated EmployeesPage tests | Task 10 |
| Updated EmployeeForm tests | Task 10 |
| KindBadge — DEFERRED | Not implemented (no `kind` in domain) |
| Head-office branch detection — heuristic (first branch) | Task 8 |

**Deferred / follow-up:**
- `kind` badge: `Employee` has no `kind` field in the domain. The badge is skipped as instructed. A future task should add `kind: 'staff' | 'contractor' | 'intern' | null` to the domain if needed.
- Head office branch id: since no domain flag marks a branch as head office, the page uses `branches[0]` as the head office. This should be replaced with a proper `isHeadOffice` field on `RefRow` or a settings constant in a follow-up.
- `terminated` status maps to prototype's `archived` color (`violet`). The existing `Chip` already has `violet`. The `status.terminated` i18n key is already "Уволен".

**Type consistency check:**
- `SortValue` defined in `types.ts`, used in `EmployeeListQuery`, imported by `EmployeesFilterBar` and `EmployeesPage` — consistent.
- `assetCounts: Record<string, number>` prop passed from `EmployeesPage` to `EmployeesTable` — consistent.
- `EmployeeFormSubmit.phone: string | null` — consistent with domain `Employee.phone: string | null`.
- `SelectMini` imported from `@/components/ui` in `EmployeesFilterBar` — consistent with export in `SelectMini.tsx` + barrel.

**No placeholder scan:** All steps have concrete code. No "TBD", "TODO", or "similar to" references.
