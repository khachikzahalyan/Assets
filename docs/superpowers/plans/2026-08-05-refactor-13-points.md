# AMS 13-Point Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 13 mechanical refactors to the AMS React codebase — eliminate duplicate code, centralise helpers, and improve naming — without changing any behaviour or visuals.

**Architecture:** Pure refactor: no new features, no behaviour changes, no visual changes. Each task touches specific files with surgical edits. Vitest tests and `npm run build` (tsc-b strict) must pass green after every task.

**Tech Stack:** React 19, TypeScript strict (`exactOptionalPropertyTypes`), Vite, Tailwind, Vitest, src/hooks/useIsMobile.ts (already exists)

**HARD CONSTRAINTS:**
- NEVER touch: `src/components/features/dashboard/DomainBox.tsx`, `src/components/features/licenses/WindowsKeysSection.tsx`, `src/pages/dashboard/DashboardPage.tsx`
- NO git operations whatsoever (no add, commit, push)
- Behaviour and visuals must be identical after every task
- Always use absolute file paths

---

## File Map

**Modified (existing):**
- `src/components/features/assets/AssetsTable.tsx` — Task 1
- `src/components/features/licenses/WorkstationLicenseTable.tsx` — Task 1
- `src/components/ui/SelectMini.tsx` — Tasks 1, 6
- `src/components/features/assets/detail/TransferPanel.tsx` — Task 2
- `src/components/features/parts/DeviceDetailMobileView.tsx` — Task 3
- `src/components/features/parts/InstalledDetailPanel.tsx` — Task 3
- `src/domain/part/partCategoryDefaults.ts` — Task 4
- `src/hooks/useParts.ts` — Task 4
- `src/components/features/parts/partsTokens.ts` — Tasks 4, 10
- `src/components/features/parts/WarehouseTab.tsx` — Task 4
- `src/components/features/assets/detail/AssignmentCard.tsx` — Task 5
- `src/components/features/assets/detail/AssignmentCardMobile.tsx` — Task 5
- `src/components/features/assets/detail/LicenseBlock.tsx` — Task 7
- `src/components/ui/MobileSheet.tsx` — Task 8
- `src/components/ui/Drawer.tsx` — Tasks 8, 9
- `src/components/features/parts/PartCard.tsx` — Task 10
- `src/components/common/SearchPalette.tsx` — Task 11
- `src/pages/licenses/LicensesPage.tsx` — Task 12 (analysis only — already correct)

**Created (new files):**
- `src/components/features/parts/nativeRowHelpers.ts` — Task 3
- `src/components/features/assets/detail/assignmentHelpers.ts` — Task 5
- `src/components/ui/useEscapeKey.ts` — Task 8

---

## Task 1: Replace manual matchMedia with `useIsMobile()` in three files

**Files:**
- Modify: `src/components/features/assets/AssetsTable.tsx:1,64-74`
- Modify: `src/components/features/licenses/WorkstationLicenseTable.tsx:1,18-28`
- Modify: `src/components/ui/SelectMini.tsx:1,46-80`

### AssetsTable.tsx

- [ ] **Step 1: Open the file and locate the isMobile block**

Read `src/components/features/assets/AssetsTable.tsx`. Confirm lines 1, 64–74 contain `useState<boolean>` and `useEffect` for matchMedia.

- [ ] **Step 2: Replace import line and remove the isMobile block**

Change the import on line 1 from:
```ts
import { useMemo, useEffect, useState } from 'react'
```
to:
```ts
import { useMemo } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
```

Delete the block at lines 64–74 (the `useState` init + the `useEffect` listener). Replace with a single line inserted at the same position:
```ts
const isMobile = useIsMobile()
```

- [ ] **Step 3: Verify build passes**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors for AssetsTable.tsx.

---

### WorkstationLicenseTable.tsx

- [ ] **Step 4: Open the file and locate the isMobile block**

Read `src/components/features/licenses/WorkstationLicenseTable.tsx`. Confirm lines 1, 18–28 contain `useState<boolean>` + `useEffect` matchMedia pattern.

- [ ] **Step 5: Replace imports and remove the block**

Change line 1 from:
```ts
import { type ReactNode, useMemo, useState, useEffect } from 'react'
```
to:
```ts
import { type ReactNode, useMemo } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
```

Delete lines 18–28. Insert at the same position:
```ts
const isMobile = useIsMobile()
```

- [ ] **Step 6: Verify build passes**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

### SelectMini.tsx

The current SelectMini has:
- A standalone helper `getIsMobile()` at lines 46–50 (used only as the `useState` initialiser)
- `const [isMobile, setIsMobile] = useState(getIsMobile)` at line 61
- A `useEffect` at lines 71–80 that calls both `setIsMobile(e.matches)` AND `setOpen(false)` in one handler

The goal: replace the `useState`+`useEffect` pair with `useIsMobile()`, keep `setOpen(false)` in a separate `useEffect([isMobile])`.

- [ ] **Step 7: Update the import block**

Change line 1 from:
```ts
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
```
to:
```ts
import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
```
(Keep `useEffect` in the React import — it is still used for the scroll/resize/escape listener and for the new `[isMobile]` effect.)

- [ ] **Step 8: Remove getIsMobile helper and replace useState+useEffect for isMobile**

Delete the entire `getIsMobile` function (lines 46–50):
```ts
/** Returns true when window.innerWidth ≤ 767px. Safe in jsdom (no matchMedia). */
function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 767px)').matches
}
```

Replace `const [isMobile, setIsMobile] = useState(getIsMobile)` (line 61) with:
```ts
const isMobile = useIsMobile()
```

Delete the old `useEffect` at lines 71–80:
```ts
useEffect(() => {
  if (typeof window.matchMedia !== 'function') return
  const mq = window.matchMedia('(max-width: 767px)')
  function handler(e: MediaQueryListEvent) {
    setIsMobile(e.matches)
    setOpen(false)
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

Add a new `useEffect` immediately after the `const isMobile = useIsMobile()` line:
```ts
// Close dropdown whenever viewport crosses the mobile/desktop boundary
useEffect(() => { setOpen(false) }, [isMobile])
```

- [ ] **Step 9: Verify build passes**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 2: Remove duplicate `todayISO` from TransferPanel.tsx

**Files:**
- Modify: `src/components/features/assets/detail/TransferPanel.tsx:1,47-50`

The file at lines 47–50 has:
```ts
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

`src/components/features/assets/create/warranty.ts` already exports an identical `todayISO()` function.

- [ ] **Step 1: Add import**

In `TransferPanel.tsx`, find the existing import block (lines 1–12). Add at the end of the imports:
```ts
import { todayISO } from '../create/warranty'
```

- [ ] **Step 2: Delete the local function**

Delete lines 47–50:
```ts
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

- [ ] **Step 3: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors. The imported `todayISO` is a drop-in replacement (same signature, same output).

---

## Task 3: Extract `kindToCategory` + native-row core to `nativeRowHelpers.ts`

**Files:**
- Create: `src/components/features/parts/nativeRowHelpers.ts`
- Modify: `src/components/features/parts/DeviceDetailMobileView.tsx`
- Modify: `src/components/features/parts/InstalledDetailPanel.tsx`

### 3a: Create nativeRowHelpers.ts

- [ ] **Step 1: Create the file**

Create `src/components/features/parts/nativeRowHelpers.ts` with the following content:

```ts
import type { UpgradeSlot } from '@/domain/part/types'

/** KIND_LABEL fallback for slot with no spec text. */
export const KIND_LABEL: Record<string, string> = {
  ram: 'ОЗУ', cooler: 'Кулер', battery: 'Аккумулятор', storage: 'Накопитель', psu: 'Блок питания',
}

/**
 * Resolve an upgradeCurrent entry's kind + storageType to a partsTokens category key.
 * Mirrors prototype _kindToCategory (parts.html ~2776).
 */
export function kindToCategory(kind: string, storageType?: string | null): string {
  if (kind === 'ram') return 'ram'
  if (kind === 'cooler') return 'cooler'
  if (kind === 'battery') return 'battery'
  if (kind === 'psu') return 'psu'
  if (kind === 'storage') {
    if (!storageType) return 'ssd'
    const t = storageType.toLowerCase()
    if (t === 'hdd') return 'hdd'
    if (t === 'm.2' || t === 'nvme' || t.includes('m.2')) return 'nvme'
    return 'ssd'
  }
  return kind
}

/**
 * Core computation shared by both native-row builders.
 * Returns computed display data; each caller maps to its own row shape.
 */
export function computeNativeRowCore(
  entry: UpgradeSlot,
  _idx: number,
): {
  category: string
  specText: string
  variantLabel: string | null
  state: 'factory' | 'replaced' | null
  nameForDeviceMobile: string
  nameForPanel: string
} {
  const category = kindToCategory(entry.kind, entry.storageType)
  const specText = entry.spec || (entry.replaced ? 'Заменено' : 'Заводской')
  let variantLabel: string | null = entry.storageType ?? null
  if (!variantLabel && entry.spec && entry.replaced) variantLabel = 'Заменено'
  const state: 'factory' | 'replaced' | null = entry.spec
    ? null
    : entry.replaced
      ? 'replaced'
      : 'factory'
  const nameForDeviceMobile = specText || entry.kind
  const nameForPanel = specText || KIND_LABEL[entry.kind] || entry.kind
  return { category, specText, variantLabel, state, nameForDeviceMobile, nameForPanel }
}
```

- [ ] **Step 2: Verify the new file compiles**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

### 3b: Refactor DeviceDetailMobileView.tsx

- [ ] **Step 3: Read the file to confirm current structure**

Read `src/components/features/parts/DeviceDetailMobileView.tsx` lines 1–60. Confirm:
- `kindToCategory` at lines 18–31
- `NativeRow` interface at lines 33–42
- `buildNativeRows` at lines 44–58

- [ ] **Step 4: Add import and replace helpers**

Add to the import block at the top of `DeviceDetailMobileView.tsx`:
```ts
import { computeNativeRowCore } from './nativeRowHelpers'
```

Delete the local `kindToCategory` function (lines 18–31):
```ts
function kindToCategory(kind: string, storageType?: string | null): string {
  if (kind === 'ram') return 'ram'
  if (kind === 'cooler') return 'cooler'
  if (kind === 'battery') return 'battery'
  if (kind === 'psu') return 'psu'
  if (kind === 'storage') {
    if (!storageType) return 'ssd'
    const t = storageType.toLowerCase()
    if (t === 'hdd') return 'hdd'
    if (t === 'm.2' || t === 'nvme' || t.includes('m.2')) return 'nvme'
    return 'ssd'
  }
  return kind
}
```

Keep the `NativeRow` interface unchanged (it is needed locally for the return type).

Replace `buildNativeRows` body to use `computeNativeRowCore`:
```ts
function buildNativeRows(asset: PartsAsset): NativeRow[] {
  return asset.upgradeCurrent
    .map((entry, i) => {
      const c = computeNativeRowCore(entry, i)
      return {
        id: `__native_${entry.kind}_${i}`,
        name: c.nameForDeviceMobile,
        category: c.category,
        variantLabel: c.variantLabel,
        entry,
        slotIdx: i,
        state: c.state,
      }
    })
    .sort((a, b) => {
      const r = componentRank(a.category) - componentRank(b.category)
      return r !== 0 ? r : a.slotIdx - b.slotIdx
    })
}
```

- [ ] **Step 5: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

### 3c: Refactor InstalledDetailPanel.tsx

- [ ] **Step 6: Read the file to confirm current structure**

Read `src/components/features/parts/InstalledDetailPanel.tsx` lines 1–75. Confirm:
- `kindToCategory` at lines 21–34
- `KIND_LABEL` at lines 37–39
- `makeNativeRow` at lines 55–72

- [ ] **Step 7: Replace helpers with imports**

Add to the import block at the top of `InstalledDetailPanel.tsx`:
```ts
import { computeNativeRowCore, KIND_LABEL } from './nativeRowHelpers'
```

Delete the local `kindToCategory` function (lines 21–34).

Delete the local `KIND_LABEL` constant (lines 37–39) — it is now imported.

Replace `makeNativeRow` body to use `computeNativeRowCore`:
```ts
function makeNativeRow(entry: UpgradeSlot, idx: number): NativeRow {
  const c = computeNativeRowCore(entry, idx)
  return {
    sku: {
      id: `__native_${entry.kind}_${idx}`,
      name: c.nameForPanel,
      category: c.category,
      variantLabel: c.variantLabel ?? null,
    },
    qty: 1,
    native: true,
    entry,
    state: c.state,
  }
}
```

- [ ] **Step 8: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 4: Centralise `DEFAULT_PART_CATEGORY_DEFS_RUNTIME` cast

**Files:**
- Modify: `src/domain/part/partCategoryDefaults.ts`
- Modify: `src/hooks/useParts.ts`
- Modify: `src/components/features/parts/partsTokens.ts`
- Modify: `src/components/features/parts/WarehouseTab.tsx`

### 4a: Add the runtime alias to partCategoryDefaults.ts

- [ ] **Step 1: Add export at end of file**

Open `src/domain/part/partCategoryDefaults.ts`. Append at the very end (after the `satisfies` line):

```ts
/**
 * DEFAULT_PART_CATEGORY_DEFS typed as PartCategoryDef[] for runtime fallback use-sites.
 * createdAt/updatedAt are absent from the seed data but never accessed at these call sites
 * (only category metadata: id, name, icon, tintToken, order, behavior, slotKind, variants, generations, active).
 */
export const DEFAULT_PART_CATEGORY_DEFS_RUNTIME: PartCategoryDef[] =
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[]
```

Note: `PartCategoryDef` is already imported at line 14 of the file, so no new import is needed.

---

### 4b: Replace the cast in useParts.ts

- [ ] **Step 2: Update useParts.ts import**

Open `src/hooks/useParts.ts`. Find the existing import:
```ts
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
```
Replace with:
```ts
import { DEFAULT_PART_CATEGORY_DEFS_RUNTIME } from '@/domain/part/partCategoryDefaults'
```

- [ ] **Step 3: Replace the cast expression**

Find line 59:
```ts
return (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
```
Replace with:
```ts
return DEFAULT_PART_CATEGORY_DEFS_RUNTIME
```

---

### 4c: Replace the three casts in partsTokens.ts

- [ ] **Step 4: Update partsTokens.ts import**

Open `src/components/features/parts/partsTokens.ts`. Find the existing import:
```ts
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
```
Replace with:
```ts
import { DEFAULT_PART_CATEGORY_DEFS_RUNTIME } from '@/domain/part/partCategoryDefaults'
```

- [ ] **Step 5: Replace the three cast expressions**

Find and replace each occurrence:

Occurrence 1 (PART_CATEGORY_META definition, ~line 147):
```ts
// old:
export const PART_CATEGORY_META: PartCatMeta[] = buildPartCatMeta(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
  (name) => name.ru,
)
// new:
export const PART_CATEGORY_META: PartCatMeta[] = buildPartCatMeta(
  DEFAULT_PART_CATEGORY_DEFS_RUNTIME,
  (name) => name.ru,
)
```

Occurrence 2 (CATEGORY_TINT definition, ~line 164):
```ts
// old:
export const CATEGORY_TINT: Record<string, Tint> = buildCategoryTint(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)
// new:
export const CATEGORY_TINT: Record<string, Tint> = buildCategoryTint(
  DEFAULT_PART_CATEGORY_DEFS_RUNTIME,
)
```

Occurrence 3 (COMPONENT_ORDER definition, ~line 210):
```ts
// old:
export const COMPONENT_ORDER: Record<string, number> = buildComponentOrder(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)
// new:
export const COMPONENT_ORDER: Record<string, number> = buildComponentOrder(
  DEFAULT_PART_CATEGORY_DEFS_RUNTIME,
)
```

---

### 4d: Replace the cast in WarehouseTab.tsx

- [ ] **Step 6: Update WarehouseTab.tsx import**

Open `src/components/features/parts/WarehouseTab.tsx`. Find:
```ts
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
```
Replace with:
```ts
import { DEFAULT_PART_CATEGORY_DEFS_RUNTIME } from '@/domain/part/partCategoryDefaults'
```

- [ ] **Step 7: Replace the cast expression**

Find line 62:
```ts
const effectiveDefs = partCategories ?? (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
```
Replace with:
```ts
const effectiveDefs = partCategories ?? DEFAULT_PART_CATEGORY_DEFS_RUNTIME
```

- [ ] **Step 8: Verify full build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors across all four files.

---

## Task 5: AssignmentCard / AssignmentCardMobile — shared `resolveAssignment` helper

**Files:**
- Create: `src/components/features/assets/detail/assignmentHelpers.ts`
- Modify: `src/components/features/assets/detail/AssignmentCard.tsx`
- Modify: `src/components/features/assets/detail/AssignmentCardMobile.tsx`

### 5a: Create assignmentHelpers.ts

- [ ] **Step 1: Create the file**

Create `src/components/features/assets/detail/assignmentHelpers.ts`:

```ts
import type { Asset, AssetReferenceData } from '@/domain/asset'

export type AssignmentMode = 'warehouse' | 'employee' | 'department' | 'branch' | 'temporary'

export interface ResolvedAssignment {
  mode: AssignmentMode
  /** Primary label (employee name / dept name / branch name / empty for warehouse/temporary) */
  primaryLabel: string
  /** Secondary label (position · dept / location type / expiry) — null if absent */
  secondaryLabel: string | null
  /** For employee mode — the employee's department name */
  deptName: string | null
  /** For temporary mode */
  tempKind: string | null
  /** For temporary mode — expiry date ISO string */
  expiresAt: string | null
}

/** Pure resolver — returns display data for any assignment mode. No JSX, no t(). */
export function resolveAssignment(
  ass: Asset['assignment'],
  refData: AssetReferenceData,
): ResolvedAssignment {
  if (!ass || ass.mode === 'warehouse') {
    return { mode: 'warehouse', primaryLabel: '', secondaryLabel: null, deptName: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'employee') {
    const emp = refData.employees.find(e => e.id === ass.employeeId)
    const dept = emp?.departmentId ? refData.departments.find(d => d.id === emp!.departmentId) : undefined
    const empName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '—'
    const subline = [emp?.position, dept?.name].filter(Boolean).join(' · ')
    return {
      mode: 'employee',
      primaryLabel: empName,
      secondaryLabel: subline || null,
      deptName: dept?.name ?? null,
      tempKind: null,
      expiresAt: null,
    }
  }
  if (ass.mode === 'department') {
    const dept = refData.departments.find(d => d.id === ass.departmentId)
    return { mode: 'department', primaryLabel: dept?.name ?? '—', secondaryLabel: null, deptName: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'branch') {
    const br = refData.branches.find(b => b.id === ass.branchId)
    return { mode: 'branch', primaryLabel: br?.name ?? '—', secondaryLabel: null, deptName: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'temporary') {
    return {
      mode: 'temporary',
      primaryLabel: '',
      secondaryLabel: null,
      deptName: null,
      tempKind: ass.tempKind ?? null,
      expiresAt: ass.expiresAt ?? null,
    }
  }
  return { mode: 'warehouse', primaryLabel: '', secondaryLabel: null, deptName: null, tempKind: null, expiresAt: null }
}
```

- [ ] **Step 2: Verify file compiles**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

### 5b: Refactor AssignmentCard.tsx

Current `renderAssignment()` searches `refData` inline for each mode. Replace with `resolveAssignment`.

- [ ] **Step 3: Add import**

Open `src/components/features/assets/detail/AssignmentCard.tsx`. After existing imports, add:
```ts
import { resolveAssignment } from './assignmentHelpers'
```

- [ ] **Step 4: Refactor renderAssignment()**

Replace the entire `renderAssignment()` function body. The function currently starts at line 39. The new body uses `resolveAssignment` for data resolution but keeps all JSX, classNames, and translation calls identical:

```ts
function renderAssignment() {
  const resolved = resolveAssignment(ass, refData)

  if (!ass || ass.mode === 'warehouse') {
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
        <div className="w-9 h-9 rounded-full bg-border text-text-tertiary flex items-center justify-center shrink-0">
          <Icon name="warehouse" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-16 text-text-primary">{t('detail.assignment.warehouse')}</p>
          <p className="text-12 text-text-tertiary">{t('assignee.warehouse')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'employee') {
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
        <RoleIcon role="employee" size={36} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-15 text-text-primary truncate">{resolved.primaryLabel}</p>
          {resolved.secondaryLabel && <p className="text-12 text-text-tertiary truncate">{resolved.secondaryLabel}</p>}
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title={t('detail.assignment.active')} />
      </div>
    )
  }

  if (resolved.mode === 'department') {
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
        <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-300 light:text-amber-700 flex items-center justify-center shrink-0">
          <Icon name="layout-list" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-15 text-text-primary truncate">{resolved.primaryLabel}</p>
          <p className="text-12 text-text-tertiary">{t('detail.location.dept')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'branch') {
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
        <div className="w-9 h-9 rounded-full bg-teal-500/15 text-teal-300 light:text-teal-700 flex items-center justify-center shrink-0">
          <Icon name="git-branch" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-15 text-text-primary truncate">{resolved.primaryLabel}</p>
          <p className="text-12 text-text-tertiary">{t('detail.location.branch')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'temporary') {
    const kindLabel = resolved.tempKind === 'audit'
      ? t('detail.transfer.kindAudit')
      : t('detail.transfer.kindIntern')
    return (
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-rose-500/10 light:bg-rose-50 ring-1 ring-rose-500/30 light:ring-rose-200">
        <div className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-300 light:text-rose-700 flex items-center justify-center shrink-0">
          <Icon name="timer" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-15 text-text-primary truncate">
            {t('assignee.temp')} — {kindLabel}
          </p>
          {resolved.expiresAt && (
            <p className="text-12 text-rose-300 light:text-rose-700 font-medium inline-flex items-center gap-1">
              <Icon name="clock" size={10} />
              {resolved.expiresAt}
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 5: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

### 5c: Refactor AssignmentCardMobile.tsx

- [ ] **Step 6: Add import**

Open `src/components/features/assets/detail/AssignmentCardMobile.tsx`. After existing imports, add:
```ts
import { resolveAssignment } from './assignmentHelpers'
```

- [ ] **Step 7: Refactor renderAssignee()**

Replace the `renderAssignee()` function body. Keep `baseCard` / `innerPad` CSS vars and all JSX/classNames identical — only remove the inline `refData` lookups and replace them with `resolveAssignment` fields:

```ts
function renderAssignee() {
  const baseCard = 'bg-bg border border-border rounded-xl flex items-center gap-2.5'
  const innerPad = 'p-[10px_13px]'
  const resolved = resolveAssignment(ass, refData)

  if (!ass || ass.mode === 'warehouse') {
    return (
      <div className={`${baseCard} ${innerPad}`}>
        <div className="w-9 h-9 rounded-[10px] bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
          <Icon name="warehouse" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-13.5 font-bold text-text-primary leading-tight">
            {t('detail.assignment.warehouse')}
          </p>
          <p className="text-11 text-text-tertiary">{t('assignee.warehouse')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'employee') {
    return (
      <div className={`${baseCard} ${innerPad}`}>
        <RoleIcon role="employee" size={36} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
          {resolved.secondaryLabel && <p className="text-11 text-text-tertiary truncate">{resolved.secondaryLabel}</p>}
        </div>
        <span className="w-[7px] h-[7px] rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
      </div>
    )
  }

  if (resolved.mode === 'department') {
    return (
      <div className={`${baseCard} ${innerPad}`}>
        <div className="w-9 h-9 rounded-[10px] bg-amber-500/15 text-amber-300 light:text-amber-700 flex items-center justify-center shrink-0">
          <Icon name="layout-list" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
          <p className="text-11 text-text-tertiary">{t('detail.location.dept')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'branch') {
    return (
      <div className={`${baseCard} ${innerPad}`}>
        <div className="w-9 h-9 rounded-[10px] bg-teal-500/15 text-teal-300 light:text-teal-700 flex items-center justify-center shrink-0">
          <Icon name="git-branch" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
          <p className="text-11 text-text-tertiary">{t('detail.location.branch')}</p>
        </div>
      </div>
    )
  }

  if (resolved.mode === 'temporary') {
    const kindLabel = resolved.tempKind === 'audit'
      ? t('detail.transfer.kindAudit')
      : t('detail.transfer.kindIntern')
    return (
      <div className={`${baseCard} ${innerPad} bg-rose-500/10 light:bg-rose-50 border-rose-500/30 light:border-rose-200`}>
        <div className="w-9 h-9 rounded-[10px] bg-rose-500/15 text-rose-300 light:text-rose-700 flex items-center justify-center shrink-0">
          <Icon name="timer" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-13.5 font-bold text-text-primary leading-tight truncate">
            {t('assignee.temp')} — {kindLabel}
          </p>
          {resolved.expiresAt && (
            <p className="text-11 text-rose-300 light:text-rose-700 inline-flex items-center gap-1">
              <Icon name="clock" size={10} />
              {resolved.expiresAt}
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 8: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 6: SelectMini — extract shared `OptionRow` component

**Files:**
- Modify: `src/components/ui/SelectMini.tsx`

The current file has two near-identical `options.map()` blocks: one in the sheet (py-2.5, icon 14px, text-15, check 14px) and one in the portal dropdown (py-2, icon 12px, text-14.5, check 13px). Extract an internal `OptionRow` component.

**Note:** At the end of Task 1, `SelectMini.tsx` already had `useIsMobile` wired. This task works on the JSX rendering section, not the hook section.

- [ ] **Step 1: Read the current file**

Read `src/components/ui/SelectMini.tsx` in full to confirm line numbers after Task 1 edits.

- [ ] **Step 2: Add OptionRow component before SelectMini**

The existing `SelectMiniOption` interface is defined at lines 9–17 (unchanged). Insert the `OptionRow` component immediately after the `SelectMiniProps` interface (after line ~37), before the `PortalPos` interface:

```tsx
interface OptionRowProps {
  opt: SelectMiniOption
  isActive: boolean
  leadingIcon?: string
  size: 'sheet' | 'dropdown'
  onClick: () => void
}

function OptionRow({ opt, isActive, leadingIcon, size, onClick }: OptionRowProps) {
  const py = size === 'sheet' ? 'py-2.5' : 'py-2'
  const iconContainerSize = size === 'sheet' ? 'w-[18px] h-[18px]' : 'w-4 h-4'
  const dotSize = size === 'sheet' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  const iconSize = size === 'sheet' ? 14 : 12
  const textClass = size === 'sheet' ? 'text-15' : 'text-14.5'
  const checkSize = size === 'sheet' ? 14 : 13

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      className={[
        `w-full flex items-center gap-2 px-3 ${py} text-left transition-colors duration-100`,
        isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg',
      ].join(' ')}
    >
      {leadingIcon && (
        opt.iconNode ? (
          <span className={`flex-shrink-0 inline-flex ${iconContainerSize} items-center justify-center`}>{opt.iconNode}</span>
        ) : opt.dotColor ? (
          <span style={{ backgroundColor: opt.dotColor }} className={`${dotSize} rounded-full flex-shrink-0`} />
        ) : (
          <span
            className="flex-shrink-0 inline-flex"
            style={{ color: isActive ? '#FFFFFF' : (opt.iconColor ?? (size === 'sheet' ? '#64748B' : 'var(--color-text-subtle)')) }}
          >
            <Icon name={opt.icon ?? leadingIcon} size={iconSize} />
          </span>
        )
      )}
      <span className={[`flex-1 ${textClass} truncate`, isActive ? 'font-semibold' : ''].join(' ')}>
        {opt.label}
      </span>
      {isActive && <Icon name="check" size={checkSize} className="text-white" />}
    </button>
  )
}
```

- [ ] **Step 3: Replace the sheet optionRows block**

Find the sheet options block (inside `<div className="py-1.5 max-h-[280px] overflow-y-auto" role="listbox">`). Replace the entire `{options.map(opt => { ... })}` block with:

```tsx
{options.map(opt => (
  <OptionRow
    key={opt.value}
    opt={opt}
    isActive={opt.value === value}
    leadingIcon={leadingIcon}
    size="sheet"
    onClick={() => { onChange(opt.value); setOpen(false) }}
  />
))}
```

Also remove the `const optionRows = (...)` wrapper variable if it still exists — inline the `<div>` and `<OptionRow>` directly into the JSX where `{optionRows}` was used.

**Important:** The current code has `const optionRows = (...)` at lines 133–184. The `{optionRows}` usage is inside `MobileSheet` at line 245. The portal dropdown at lines 264–313 is a SEPARATE block with different sizes. After Task 6:
- The shared `optionRows` variable at lines 133–184 becomes the new sheet rendering using `<OptionRow size="sheet" />`
- The portal dropdown block at lines 264–313 uses `<OptionRow size="dropdown" />`
- Both are inlined directly into their respective JSX positions

Replacement for the portal dropdown block (inside `<div className="py-1.5 max-h-[17.5rem] overflow-y-auto" role="listbox">`):

```tsx
{options.map(opt => (
  <OptionRow
    key={opt.value}
    opt={opt}
    isActive={opt.value === value}
    leadingIcon={leadingIcon}
    size="dropdown"
    onClick={() => { onChange(opt.value); setOpen(false) }}
  />
))}
```

- [ ] **Step 4: Verify build and visual parity**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors. The size props match the original hard-coded values exactly, so no visual change occurs.

---

## Task 7: LicenseBlock compact — `MsLogoSmall` component

**Files:**
- Modify: `src/components/features/assets/detail/LicenseBlock.tsx`

The compact-mode branches at lines ~254–260 and ~289–295 each contain an identical inline SVG. Extract to a local component.

- [ ] **Step 1: Read LicenseBlock.tsx around the MsLogo component**

Read `src/components/features/assets/detail/LicenseBlock.tsx` lines 59–70 to confirm the existing `MsLogo` component, then read lines 250–300 to see both compact inline SVGs.

- [ ] **Step 2: Add MsLogoSmall after MsLogo**

Insert immediately after the closing `}` of the `MsLogo()` function (after line ~70):

```tsx
function MsLogoSmall() {
  return (
    <div className="w-[1.875rem] h-[1.875rem] rounded-lg bg-white flex items-center justify-center shrink-0">
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
        <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
        <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
        <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
      </svg>
    </div>
  )
}
```

- [ ] **Step 3: Replace both inline SVG blocks with `<MsLogoSmall />`**

First occurrence (~line 253–260):
```tsx
// old:
<div className="w-[1.875rem] h-[1.875rem] rounded-lg bg-white flex items-center justify-center shrink-0">
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
    <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
    <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </svg>
</div>
// new:
<MsLogoSmall />
```

Second occurrence (~line 288–295):
```tsx
// old (same SVG block):
<div className="w-[1.875rem] h-[1.875rem] rounded-lg bg-white flex items-center justify-center shrink-0">
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
    <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
    <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
    <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
  </svg>
</div>
// new:
<MsLogoSmall />
```

- [ ] **Step 4: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 8: Extract `useEscapeKey` hook, wire into MobileSheet and Drawer

**Files:**
- Create: `src/components/ui/useEscapeKey.ts`
- Modify: `src/components/ui/MobileSheet.tsx`
- Modify: `src/components/ui/Drawer.tsx`

### 8a: Create useEscapeKey.ts

- [ ] **Step 1: Create the file**

Create `src/components/ui/useEscapeKey.ts`:

```ts
import { useEffect } from 'react'

/**
 * Registers a keydown listener for the Escape key while `open` is true.
 * Automatically removed when `open` becomes false or the component unmounts.
 */
export function useEscapeKey(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}
```

---

### 8b: Wire into MobileSheet.tsx

Current `MobileSheet.tsx` has a `useEffect` at lines 31–38 that handles ESC.

- [ ] **Step 2: Update MobileSheet.tsx imports**

Change line 1 from:
```ts
import { useEffect } from 'react'
```
to:
```ts
import { useEscapeKey } from './useEscapeKey'
```
(Remove `useEffect` from React imports entirely — `MobileSheet` has no other `useEffect` calls.)

- [ ] **Step 3: Replace the ESC useEffect with the hook**

Delete lines 31–38:
```ts
// ESC key close
useEffect(() => {
  if (!open) return
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [open, onClose])
```

Add immediately after `useBodyScrollLock(open)`:
```ts
useEscapeKey(open, onClose)
```

---

### 8c: Wire into Drawer.tsx

Current `Drawer.tsx` has a `useEffect` at lines 36–43 for ESC close.

- [ ] **Step 4: Update Drawer.tsx imports**

Add `useEscapeKey` import. Change line 1:
```ts
import { useEffect, useRef } from 'react'
```
to:
```ts
import { useRef } from 'react'
import { useEscapeKey } from './useEscapeKey'
```
(Remove `useEffect` if it is no longer used after this change — check the file first. If `useEffect` is not used elsewhere in Drawer.tsx, remove it.)

- [ ] **Step 5: Replace the ESC useEffect with the hook**

Delete lines 36–43:
```ts
// ESC close — mirrors MobileSheet pattern.
useEffect(() => {
  if (!open) return
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [open, onClose])
```

Add immediately after `useBodyScrollLock(open)`:
```ts
useEscapeKey(open, onClose)
```

- [ ] **Step 6: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 9: Drawer.tsx — named `createPortal` import

**Files:**
- Modify: `src/components/ui/Drawer.tsx`

Current line 2:
```ts
import ReactDOM from 'react-dom'
```
Used as `ReactDOM.createPortal(...)` on line ~47.

- [ ] **Step 1: Replace import**

Change line 2:
```ts
import ReactDOM from 'react-dom'
```
to:
```ts
import { createPortal } from 'react-dom'
```

- [ ] **Step 2: Replace usage**

Find `ReactDOM.createPortal(` and replace with `createPortal(`.

- [ ] **Step 3: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 10: `resolveVariants` helper in partsTokens.ts + replace IIFE in PartCard.tsx

**Files:**
- Modify: `src/components/features/parts/partsTokens.ts`
- Modify: `src/components/features/parts/PartCard.tsx`

`PartsReceivePage.tsx` does NOT have a `CATEGORY_VARIANTS`/`resolveVariants` pattern (confirmed by grep returning no matches), so only `PartCard.tsx` needs updating.

### 10a: Add resolveVariants to partsTokens.ts

- [ ] **Step 1: Append resolveVariants to partsTokens.ts**

Open `src/components/features/parts/partsTokens.ts`. Append the following at the end of the file (after the last export):

```ts
/**
 * Resolve the display variants for a category.
 * Prefers the live PartCategoryDef; falls back to the legacy CATEGORY_VARIANTS map.
 */
export function resolveVariants(
  categoryId: string,
  catDef: { variants: { id: string; label: string; order: number }[] | null } | undefined,
): { id: string; label: string }[] | null {
  if (catDef) {
    if (!catDef.variants) return null
    return catDef.variants.map(v => ({ id: v.id, label: v.label }))
  }
  // Legacy fallback
  const STORAGE_VARIANTS: { id: string; label: string }[] = [
    { id: '64gb', label: '64 ГБ' }, { id: '128gb', label: '128 ГБ' },
    { id: '256gb', label: '256 ГБ' }, { id: '512gb', label: '512 ГБ' },
    { id: '1tb', label: '1 ТБ' }, { id: '2tb', label: '2 ТБ' },
    { id: '3tb', label: '3 ТБ' }, { id: '4tb', label: '4 ТБ' }, { id: '5tb', label: '5 ТБ' },
  ]
  const RAM_VARIANTS: { id: string; label: string }[] = [
    { id: '4gb', label: '4 ГБ' }, { id: '8gb', label: '8 ГБ' },
    { id: '16gb', label: '16 ГБ' }, { id: '20gb', label: '20 ГБ' },
    { id: '32gb', label: '32 ГБ' }, { id: '40gb', label: '40 ГБ' },
    { id: '64gb', label: '64 ГБ' }, { id: '128gb', label: '128 ГБ' },
  ]
  const legacyMap: Record<string, { id: string; label: string }[] | null> = {
    psu: null, cooler: null, gpu: null,
    ssd: STORAGE_VARIANTS, hdd: STORAGE_VARIANTS, nvme: STORAGE_VARIANTS,
    ram: RAM_VARIANTS,
  }
  return legacyMap[categoryId] ?? null
}
```

---

### 10b: Use resolveVariants in PartCard.tsx

- [ ] **Step 2: Update PartCard.tsx import**

Open `src/components/features/parts/PartCard.tsx`. Find:
```ts
import { categoryTint, categoryIcon, PART_CAT_BY_ID } from './partsTokens'
```
Replace with:
```ts
import { categoryTint, categoryIcon, PART_CAT_BY_ID, resolveVariants } from './partsTokens'
```

- [ ] **Step 3: Check if CATEGORY_VARIANTS is still used elsewhere in PartCard.tsx**

Grep for `CATEGORY_VARIANTS` inside `PartCard.tsx`. It appears in:
- The `const CATEGORY_VARIANTS` definition (lines 35–39) — local data
- `isSized` computation at line 86: `CATEGORY_VARIANTS[categoryId] !== null && CATEGORY_VARIANTS[categoryId] !== undefined`
- `const allVariants` IIFE at lines 105–111

After replacing `allVariants`, the only remaining use of `CATEGORY_VARIANTS` is in the `isSized` check. The `resolveVariants` helper can also provide the answer: `resolveVariants(categoryId, catDef) !== null` when catDef is absent.

- [ ] **Step 4: Replace IIFE for allVariants**

Find lines 105–111:
```ts
const allVariants: Variant[] | null = (() => {
  if (catDef) {
    if (!catDef.variants) return null
    return catDef.variants.map(v => ({ id: v.id, label: v.label }))
  }
  return CATEGORY_VARIANTS[categoryId] ?? null
})()
```
Replace with:
```ts
const allVariants = resolveVariants(categoryId, catDef)
```

- [ ] **Step 5: Remove CATEGORY_VARIANTS if no longer used**

Check line 86:
```ts
const isSized = catDef ? isSizedCategory(catDef) : (CATEGORY_VARIANTS[categoryId] !== null && CATEGORY_VARIANTS[categoryId] !== undefined)
```
Replace this line with:
```ts
const isSized = catDef ? isSizedCategory(catDef) : (resolveVariants(categoryId, undefined) !== null)
```

Now `CATEGORY_VARIANTS`, `STORAGE_VARIANTS`, `RAM_VARIANTS`, and their definitions (lines 14–39) are unused. Delete them:

Delete lines 14–39 (the three `Variant[]` constants and the `CATEGORY_VARIANTS` record):
```ts
const STORAGE_VARIANTS: Variant[] = [...]
const RAM_VARIANTS: Variant[] = [...]
const CATEGORY_VARIANTS: Record<string, Variant[] | null> = { ... }
```

The `Variant` interface at lines 10–13 is still needed (used for `allVariants` type inference and `variants` state). Keep it.

- [ ] **Step 6: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 11: SearchPalette — remove dead `dataState.status === 'ready'` check

**Files:**
- Modify: `src/components/common/SearchPalette.tsx`

- [ ] **Step 1: Read the context**

Read `src/components/common/SearchPalette.tsx` lines 80–170 to confirm the early-return pattern and the dead check.

The `useMemo` has an early return:
```ts
if (dataState.status !== 'ready') return []
```
Lines below that only execute when `dataState.status === 'ready'`. The departments block at ~line 148 redundantly checks `&& dataState.status === 'ready'`.

- [ ] **Step 2: Remove the dead condition**

Find:
```ts
if (canAccess(role, 'departments') && dataState.status === 'ready') {
```
Replace with:
```ts
if (canAccess(role, 'departments')) {
```

- [ ] **Step 3: Verify build**

```
cd C:\Users\DELL\Desktop\assets-crm && npx tsc -b --noEmit
```
Expected: zero errors.

---

## Task 12: LicensesPage — verify duplicate testid is not a DOM-simultaneous issue

**Files:**
- Read: `src/pages/licenses/LicensesPage.tsx`

- [ ] **Step 1: Read the relevant section of LicensesPage.tsx**

Read `src/pages/licenses/LicensesPage.tsx` lines 370–420 to confirm both `data-testid="add-subscription-btn-mobile"` usages.

- [ ] **Step 2: Analyse render conditions**

The two buttons have these conditions:
1. First button: `{activeTab === 'subs' && ...}` — only renders when subs tab is active
2. Second button: `{activeTab === 'keys' && ...}` — only renders when keys tab is active

Since `activeTab` is a string with a single value at any time, exactly one of the two conditions is true and the other is false. Both buttons are **never in the DOM simultaneously**.

**Conclusion:** This is not a DOM duplication bug. Both buttons having the same `data-testid` is fine because they represent the same logical action ("add license") in two different layout contexts. The task requires no code change. Close as "already correct."

- [ ] **Step 3: Note result**

No changes needed. The two `add-subscription-btn-mobile` buttons are mutually exclusive by the `activeTab` condition.

---

## Task 13: WarehouseHistorySection metrics — analysis

**Files:**
- Read: `src/components/features/parts/WarehouseHistorySection.tsx`
- Read: `src/components/features/parts/HistoryPanel.tsx`

- [ ] **Step 1: Compare metric computation**

`WarehouseHistorySection.tsx` computes:
```ts
let added = 0, used = 0, service = 0
for (const m of movements) {
  if (!skuIds.has(m.skuId)) continue
  if (m.type === 'receive') added += m.qty
  else if (m.type === 'install') (m.serviceReplace ? (service += m.qty) : (used += m.qty))
}
```

`HistoryPanel.tsx` computes `addedQty` and `usedQty` separately via `useMemo`, and uses different filter sets (it also excludes `type === 'service'` from `categoryMovements`). The two computations have **different filtering logic** and different shapes of output (HistoryPanel doesn't expose `service` separately in the same way).

- [ ] **Step 2: Decide**

The metrics are NOT identical enough to safely extract without risk of behaviour change. The `WarehouseHistorySection` loops a single pass with a `skuIds` set filter; `HistoryPanel` uses two separate `useMemo`s on a pre-filtered array that also excludes the `'service'` type. Extracting a shared helper would require changing one of the two computations, which risks subtle behaviour differences.

**Conclusion:** Skip Task 13. The optional extraction is not safe without deeper analysis that could introduce bugs.

---

## Final Verification

- [ ] **Run vitest**

```
cd C:\Users\DELL\Desktop\assets-crm && npx vitest run
```
Expected: all tests pass (green).

- [ ] **Run build**

```
cd C:\Users\DELL\Desktop\assets-crm && npm run build
```
Expected: zero TypeScript errors, Vite build completes successfully.

- [ ] **Confirm no git operations were performed**

```
cd C:\Users\DELL\Desktop\assets-crm && git status
```
Only source files should be modified/created. No commits, no staging, no push.

---

## Self-Review

### Spec coverage check

| Point | Task | Status |
|-------|------|--------|
| 1 — useIsMobile in 3 files | Task 1 | ✅ Covered (AssetsTable, WorkstationLicenseTable, SelectMini) |
| 2 — todayISO dedup | Task 2 | ✅ Covered |
| 3 — kindToCategory + nativeRowHelpers | Task 3 | ✅ Covered |
| 4 — DEFAULT_PART_CATEGORY_DEFS_RUNTIME | Task 4 | ✅ Covered (5 call sites) |
| 5 — AssignmentCard resolveAssignment | Task 5 | ✅ Covered |
| 6 — SelectMini OptionRow | Task 6 | ✅ Covered |
| 7 — LicenseBlock MsLogoSmall | Task 7 | ✅ Covered |
| 8 — useEscapeKey hook | Task 8 | ✅ Covered (MobileSheet + Drawer) |
| 9 — Drawer createPortal named import | Task 9 | ✅ Covered |
| 10 — resolveVariants helper | Task 10 | ✅ Covered (partsTokens + PartCard) |
| 11 — SearchPalette dead check | Task 11 | ✅ Covered |
| 12 — LicensesPage testid | Task 12 | ✅ Analysed — no change needed |
| 13 — WarehouseHistorySection metrics | Task 13 | ✅ Analysed — skip (not safe) |

### Placeholder scan
No TBDs, no "implement later", no "handle edge cases" without code. Every step contains the actual code to write.

### Type consistency check
- `OptionRow` uses `SelectMiniOption` (the file's own interface) — consistent
- `resolveAssignment` returns `ResolvedAssignment` — used consistently in both card components
- `computeNativeRowCore` returns `nameForDeviceMobile` and `nameForPanel` — both consumed correctly in their respective callers
- `resolveVariants` returns `{ id: string; label: string }[] | null` — matches `Variant[]` interface in PartCard (which is `{ id: string; label: string }`)
- `DEFAULT_PART_CATEGORY_DEFS_RUNTIME` is typed as `PartCategoryDef[]` — replaces `as unknown as PartCategoryDef[]` at all 5 call sites correctly
