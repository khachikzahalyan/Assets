# Style Constants DRY-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract repeated Tailwind className strings (≥3 verbatim occurrences) into named string constants in `src/components/ui/styles.ts`, replacing inline duplicates — zero visual or DOM change.

**Architecture:** Single new file `src/components/ui/styles.ts` exports plain `const` strings. Consumer files import from there and use `cn(CONSTANT, extraClasses)` for any per-instance additions. The UI barrel (`src/components/ui/index.ts`) re-exports everything from `styles.ts`. No new components, no DOM wrapping, no logic change.

**Tech Stack:** TypeScript string constants, existing `cn()` from `src/lib/utils.ts`, `import` statements only.

---

## Confirmed Duplication Census

These are the patterns confirmed by grep with exact occurrence counts. **Do not extract anything not on this list.**

### Pattern A — `DIALOG_BACKDROP` (8 hits)
```
'fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60'
```
Files (8):
- `src/components/features/branches/BranchFormDialog.tsx:36`
- `src/components/features/catalogs/ConfirmDeleteDialog.tsx:18`
- `src/components/features/categories/CategoryFormDialog.tsx:58`
- `src/components/features/departments/DepartmentFormDialog.tsx:31`
- `src/components/features/licenses/AssignLicenseDialog.tsx:63`
- `src/components/features/licenses/LicenseFormDialog.tsx:125`
- `src/components/features/statuses/AssetStatusFormDialog.tsx:54`
- `src/pages/RolesPage.tsx:64` — **has extra `backdrop-blur-sm`** → use `cn(DIALOG_BACKDROP, 'backdrop-blur-sm')`

### Pattern B — `DIALOG_BACKDROP_BLUR` (4 hits)
```
'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'
```
Files (4 — all in licenses/):
- `src/components/features/licenses/ActivateKeyModal.tsx:78`
- `src/components/features/licenses/AddSubscriptionModal.tsx:67`
- `src/components/features/licenses/KeyDetailsModal.tsx:124`
- `src/components/features/licenses/ManageAssigneesModal.tsx:69`

### Pattern C — `MODAL_BACKDROP_ABS` (3 hits)
```
'absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-backdrop-fade'
```
Files (3):
- `src/components/features/employees/EmployeeModalShell.tsx:61`
- `src/components/features/employees/HandoverModal.tsx:231`
- `src/components/ui/Drawer.tsx:56`

### Pattern D — `MODAL_PANEL` (2 hits — below threshold, skip)
`bg-surface rounded-2xl shadow-2xl shadow-slate-900/20 border border-border/60 anim-modal-pop` — only 2 files (EmployeeModalShell, HandoverModal), each has unique extra classes. **Do not extract.**

### Pattern E — `LIST_SEPARATOR` (5 hits, 2 variants)
Variant E1 — `'border-b border-border last:border-b-0'` (3 hits):
- `src/components/features/dashboard/RecentActivityList.tsx:78` — has large extra string block after
- `src/components/features/dashboard/RecentActivityList.tsx:88` — bare
- `src/components/features/licenses/ActivateKeyModal.tsx:150` — part of template literal with conditional

Variant E2 — `'border-b border-border last:border-0'` (3 hits):
- `src/components/features/assets/detail/AssetHistory.tsx:45` — has extra classes before
- `src/pages/PendingUsersPage.tsx:302` — has extra classes after
- `src/pages/RolesPage.tsx:279` — inside template literal with conditional

**Decision on E:** The two variants differ only by `last:border-b-0` vs `last:border-0`. Both are short (28–32 chars). RecentActivityList:78 and ActivateKeyModal:150 have so many per-instance additions that the constant would only cover a fragment of the template literal. **Extract E1 as `LIST_ROW_SEPARATOR` and E2 as `LIST_ROW_SEPARATOR_FULL` only if all 3 usages of each can be cleanly substituted without breaking the surrounding `cn()` or template-literal call.** If any usage is inside a complex template literal where substitution would obscure intent, skip that variant and note it in the report.

---

## File Structure

### New file
- `src/components/ui/styles.ts` — exports `DIALOG_BACKDROP`, `DIALOG_BACKDROP_BLUR`, `MODAL_BACKDROP_ABS`, `LIST_ROW_SEPARATOR`, `LIST_ROW_SEPARATOR_FULL`

### Modified files
- `src/components/ui/index.ts` — add `export * from './styles'`
- `src/components/features/branches/BranchFormDialog.tsx`
- `src/components/features/catalogs/ConfirmDeleteDialog.tsx`
- `src/components/features/categories/CategoryFormDialog.tsx`
- `src/components/features/departments/DepartmentFormDialog.tsx`
- `src/components/features/licenses/AssignLicenseDialog.tsx`
- `src/components/features/licenses/LicenseFormDialog.tsx`
- `src/components/features/statuses/AssetStatusFormDialog.tsx`
- `src/pages/RolesPage.tsx` (backdrop only)
- `src/components/features/licenses/ActivateKeyModal.tsx`
- `src/components/features/licenses/AddSubscriptionModal.tsx`
- `src/components/features/licenses/KeyDetailsModal.tsx`
- `src/components/features/licenses/ManageAssigneesModal.tsx`
- `src/components/features/employees/EmployeeModalShell.tsx`
- `src/components/features/employees/HandoverModal.tsx`
- `src/components/ui/Drawer.tsx`
- `src/components/features/dashboard/RecentActivityList.tsx`
- `src/components/features/assets/detail/AssetHistory.tsx`
- `src/pages/PendingUsersPage.tsx`

**Do NOT touch** (parts/ in-flight, or below-threshold patterns):
- `src/components/features/parts/**` — leave entirely alone
- `src/pages/PartsPage.tsx` — leave entirely alone
- `src/components/features/settings/AuthSettingsPanel.tsx` — its backdrop (`fixed inset-0 z-50 flex items-center justify-center bg-black/60`, no `max-md:items-end`) is a one-off variant (2 occurrences including `PendingUsersPage.tsx:79`). Both already below threshold after factoring PendingUsersPage.tsx uses `backdrop-blur-sm` too — they differ. Leave as-is.
- `src/components/common/SearchPalette.tsx` — `absolute inset-0 bg-black/60 anim-backdrop-fade` (no blur) — 1 occurrence, skip.
- `src/components/common/ProfileMenu.tsx` and `NotificationBell.tsx` — dropdown containers with unique positioning/animation classes. Only 2 hits, not ≥3. Skip.

---

## Task 1: Create `src/components/ui/styles.ts`

**Files:**
- Create: `src/components/ui/styles.ts`

- [ ] **Step 1.1: Write the styles module**

Create `C:/Users/DELL/Desktop/assets-crm/src/components/ui/styles.ts` with this exact content:

```ts
/**
 * Shared Tailwind className constants for repeated AMS patterns.
 * Import these instead of copy-pasting inline strings.
 * Use cn(CONSTANT, 'extra-classes') to append per-instance overrides.
 *
 * CONSERVATIVE extraction — only patterns with ≥3 verbatim occurrences.
 */

/**
 * Standard dialog/modal backdrop — z-50, bottom-sheet on mobile.
 * 8 usages: BranchFormDialog, ConfirmDeleteDialog, CategoryFormDialog,
 * DepartmentFormDialog, AssignLicenseDialog, LicenseFormDialog,
 * AssetStatusFormDialog, + RolesPage (with extra backdrop-blur-sm via cn).
 */
export const DIALOG_BACKDROP =
  'fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60'

/**
 * License-module modal backdrop — z-200, centered, with blur and padding.
 * 4 usages: ActivateKeyModal, AddSubscriptionModal, KeyDetailsModal, ManageAssigneesModal.
 */
export const DIALOG_BACKDROP_BLUR =
  'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'

/**
 * Absolute inner backdrop for portal-based modals (EmployeeModalShell, HandoverModal, Drawer).
 * 3 usages.
 */
export const MODAL_BACKDROP_ABS =
  'absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-backdrop-fade'

/**
 * List-row separator — border bottom, remove on last child (border-b-0 variant).
 * Use when the row does NOT use border-0 shorthand.
 * 3 usages: RecentActivityList (×2), ActivateKeyModal.
 */
export const LIST_ROW_SEPARATOR = 'border-b border-border last:border-b-0'

/**
 * List-row separator — border bottom, remove on last child (border-0 variant).
 * Use when the row uses the border-0 shorthand (resets all borders on last child).
 * 3 usages: AssetHistory, PendingUsersPage, RolesPage.
 */
export const LIST_ROW_SEPARATOR_FULL = 'border-b border-border last:border-0'
```

- [ ] **Step 1.2: Export from the UI barrel**

Open `C:/Users/DELL/Desktop/assets-crm/src/components/ui/index.ts`.

Add this line at the **end** of the file (after all existing exports):

```ts
export * from './styles'
```

- [ ] **Step 1.3: Verify TypeScript sees the new file**

Run:
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1 | head -5
```

Expected: same 11 errors, all in parts/. Zero new errors.

---

## Task 2: Replace `DIALOG_BACKDROP` — 8 files

**Files:**
- Modify: `src/components/features/branches/BranchFormDialog.tsx:36`
- Modify: `src/components/features/catalogs/ConfirmDeleteDialog.tsx:18`
- Modify: `src/components/features/categories/CategoryFormDialog.tsx:58`
- Modify: `src/components/features/departments/DepartmentFormDialog.tsx:31`
- Modify: `src/components/features/licenses/AssignLicenseDialog.tsx:63`
- Modify: `src/components/features/licenses/LicenseFormDialog.tsx:125`
- Modify: `src/components/features/statuses/AssetStatusFormDialog.tsx:54`
- Modify: `src/pages/RolesPage.tsx:64`

**Import to add in each file:**
```tsx
import { DIALOG_BACKDROP } from '@/components/ui/styles'
```
(Use the project's existing `@/` alias. Check current imports in the file — if it already imports from `@/components/ui`, add `DIALOG_BACKDROP` to that import.)

**Replacement rules per file:**

### BranchFormDialog.tsx:36
Before:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60" onClick={p.onCancel}>
```
After:
```tsx
<div className={DIALOG_BACKDROP} onClick={p.onCancel}>
```

### ConfirmDeleteDialog.tsx:18
Before:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60" onClick={p.onCancel}>
```
After:
```tsx
<div className={DIALOG_BACKDROP} onClick={p.onCancel}>
```

### CategoryFormDialog.tsx:58
Before:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60"
```
After:
```tsx
className={DIALOG_BACKDROP}
```
(This is a JSX attribute; remove the quotes, add curly braces.)

### DepartmentFormDialog.tsx:31
Before:
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60" onClick={p.onCancel}>
```
After:
```tsx
<div className={DIALOG_BACKDROP} onClick={p.onCancel}>
```

### AssignLicenseDialog.tsx:63
Before:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60"
```
After:
```tsx
className={DIALOG_BACKDROP}
```

### LicenseFormDialog.tsx:125
Before:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60"
```
After:
```tsx
className={DIALOG_BACKDROP}
```

### AssetStatusFormDialog.tsx:54
Before:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60"
```
After:
```tsx
className={DIALOG_BACKDROP}
```

### RolesPage.tsx:64 — has extra `backdrop-blur-sm`
This file has `backdrop-blur-sm` appended. Must use `cn()`.

Check what `cn` is imported as in RolesPage.tsx first (`grep -n "import.*cn\|import.*utils" src/pages/RolesPage.tsx`).

Before:
```tsx
className="fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60 backdrop-blur-sm"
```
After:
```tsx
className={cn(DIALOG_BACKDROP, 'backdrop-blur-sm')}
```

If `cn` is not yet imported in RolesPage.tsx, add:
```tsx
import { cn } from '@/lib/utils'
```

- [ ] **Step 2.1: Edit all 7 plain-substitution files** (BranchFormDialog, ConfirmDeleteDialog, CategoryFormDialog, DepartmentFormDialog, AssignLicenseDialog, LicenseFormDialog, AssetStatusFormDialog) — add the import and replace the className string.

- [ ] **Step 2.2: Edit RolesPage.tsx** — add imports (`DIALOG_BACKDROP` + `cn` if missing), replace with `cn(DIALOG_BACKDROP, 'backdrop-blur-sm')`.

- [ ] **Step 2.3: Verify — TypeScript check**
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1 | grep -v "parts/"
```
Expected: zero non-parts errors.

---

## Task 3: Replace `DIALOG_BACKDROP_BLUR` — 4 license modal files

**Files:**
- Modify: `src/components/features/licenses/ActivateKeyModal.tsx:78`
- Modify: `src/components/features/licenses/AddSubscriptionModal.tsx:67`
- Modify: `src/components/features/licenses/KeyDetailsModal.tsx:124`
- Modify: `src/components/features/licenses/ManageAssigneesModal.tsx:69`

**Import to add in each:**
```tsx
import { DIALOG_BACKDROP_BLUR } from '@/components/ui/styles'
```
(Or add `DIALOG_BACKDROP_BLUR` to an existing `@/components/ui` import if present.)

**Replacement — same pattern in all 4 files:**

Before:
```tsx
className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
```
After:
```tsx
className={DIALOG_BACKDROP_BLUR}
```

- [ ] **Step 3.1: Edit all 4 files** — add import, replace className.

- [ ] **Step 3.2: TypeScript check**
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1 | grep -v "parts/"
```
Expected: zero non-parts errors.

---

## Task 4: Replace `MODAL_BACKDROP_ABS` — 3 files

**Files:**
- Modify: `src/components/features/employees/EmployeeModalShell.tsx:61`
- Modify: `src/components/features/employees/HandoverModal.tsx:231`
- Modify: `src/components/ui/Drawer.tsx:56`

**Import to add in each:**
```tsx
import { MODAL_BACKDROP_ABS } from '@/components/ui/styles'
```

**Replacement — same in all 3:**

Before:
```tsx
className="absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-backdrop-fade"
```
After:
```tsx
className={MODAL_BACKDROP_ABS}
```

Note for `EmployeeModalShell.tsx`: the file already imports from React and ReactDOM. Check existing `@/components/ui` imports so you can bundle the new import without duplicating the import line.

- [ ] **Step 4.1: Edit all 3 files** — add import, replace className.

- [ ] **Step 4.2: TypeScript check**
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1 | grep -v "parts/"
```
Expected: zero non-parts errors.

---

## Task 5: Replace `LIST_ROW_SEPARATOR` and `LIST_ROW_SEPARATOR_FULL`

This task is more nuanced — each usage has surrounding extra classes. Read each usage site carefully before editing.

**Files:**
- Modify: `src/components/features/dashboard/RecentActivityList.tsx:78,88`
- Modify: `src/components/features/licenses/ActivateKeyModal.tsx:150`
- Modify: `src/components/features/assets/detail/AssetHistory.tsx:45`
- Modify: `src/pages/PendingUsersPage.tsx:302`
- Modify: `src/pages/RolesPage.tsx:279`

**Import to add (wherever needed):**
```tsx
import { LIST_ROW_SEPARATOR, LIST_ROW_SEPARATOR_FULL } from '@/components/ui/styles'
```

### RecentActivityList.tsx:88 — bare usage, clean substitution
Before:
```tsx
className="border-b border-border last:border-b-0"
```
After:
```tsx
className={LIST_ROW_SEPARATOR}
```

### RecentActivityList.tsx:78 — has many extra classes after
The line currently reads (approximately):
```tsx
className="block border-b border-border last:border-b-0 hover:bg-surface-2 rounded-md -mx-1 px-1 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
```
After (use `cn`):
```tsx
className={cn(LIST_ROW_SEPARATOR, 'block hover:bg-surface-2 rounded-md -mx-1 px-1 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent')}
```
Check if `cn` is already imported in RecentActivityList.tsx. If not, add:
```tsx
import { cn } from '@/lib/utils'
```

### ActivateKeyModal.tsx:150 — inside a template literal with conditional
The current line (approximate) is:
```tsx
className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border last:border-b-0 ${someCondition ? 'class-a' : 'class-b'}`}
```
**Decision: skip this one.** The `border-b border-border last:border-b-0` fragment is embedded inside a template literal with a runtime conditional. Extracting it into `cn()` would require restructuring the entire template literal and risks a subtle class-ordering change via tailwind-merge. The two characters saved do not justify the risk. **Leave ActivateKeyModal.tsx:150 as-is** and note this in the report.

(The separator constant still has ≥3 usages from the other files.)

### AssetHistory.tsx:45 — extra classes before the separator
Before:
```tsx
className="flex items-start gap-3 py-2 border-b border-border last:border-0"
```
After:
```tsx
className={cn('flex items-start gap-3 py-2', LIST_ROW_SEPARATOR_FULL)}
```
Check if `cn` is imported in AssetHistory.tsx; add `import { cn } from '@/lib/utils'` if missing.

### PendingUsersPage.tsx:302 — extra classes after
Before:
```tsx
className="border-b border-border last:border-0 hover:bg-surface-2 transition-colors"
```
After:
```tsx
className={cn(LIST_ROW_SEPARATOR_FULL, 'hover:bg-surface-2 transition-colors')}
```
Check if `cn` is imported in PendingUsersPage.tsx; add if missing.

### RolesPage.tsx:279 — inside template literal with conditional
Before:
```tsx
className={`border-b border-border last:border-0 transition-colors ${isSelf ? 'bg-accent/5' : 'hover:bg-surface-2'}`}
```
After (convert from template literal to `cn`):
```tsx
className={cn(LIST_ROW_SEPARATOR_FULL, 'transition-colors', isSelf ? 'bg-accent/5' : 'hover:bg-surface-2')}
```
`cn` should already be imported in RolesPage.tsx from Task 2.

- [ ] **Step 5.1: Edit RecentActivityList.tsx** — lines 78 and 88; add `cn` import if missing.

- [ ] **Step 5.2: Edit AssetHistory.tsx** — line 45; add `cn` import if missing.

- [ ] **Step 5.3: Edit PendingUsersPage.tsx** — line 302; add `cn` import if missing.

- [ ] **Step 5.4: Edit RolesPage.tsx:279** — convert template literal to `cn(...)`.

- [ ] **Step 5.5: TypeScript check**
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1 | grep -v "parts/"
```
Expected: zero non-parts errors.

---

## Task 6: Full verification

- [ ] **Step 6.1: Confirm baseline error count is still 11**
```
npx tsc -b C:/Users/DELL/Desktop/assets-crm/tsconfig.json --noEmit 2>&1
```
Expected output — exactly these 11 lines (and nothing else):
```
../assets-crm/src/components/features/parts/AddPartModal.tsx(219,41): error TS18048: 'cur' is possibly 'undefined'.
../assets-crm/src/components/features/parts/AddPartModal.tsx(225,28): error TS18048: 'cur' is possibly 'undefined'.
../assets-crm/src/components/features/parts/AddPartModal.tsx(231,37): error TS18048: 'cur' is possibly 'undefined'.
../assets-crm/src/components/features/parts/HistoryPanel.tsx(24,7): error TS2367: ...
../assets-crm/src/components/features/parts/HistoryPanel.tsx(25,7): error TS2367: ...
../assets-crm/src/components/features/parts/InstalledDetailPanel.tsx(12,3): error TS6133: ...
../assets-crm/src/components/features/parts/StatTile.tsx(31,42): error TS18048: ...
../assets-crm/src/components/features/parts/StatTile.tsx(31,54): error TS18048: ...
../assets-crm/src/components/features/parts/StatTile.tsx(39,68): error TS18048: ...
../assets-crm/src/components/features/parts/UninstallModal.tsx(27,61): error TS6133: ...
../assets-crm/src/pages/PartsPage.tsx(394,8): error TS2375: ...
```
If any error outside `parts/` or `PartsPage.tsx` appears, **stop and fix it before proceeding**.

- [ ] **Step 6.2: Vite build**
```
npx vite build --config C:/Users/DELL/Desktop/assets-crm/vite.config.ts 2>&1 | tail -15
```
Expected: `✓ built in ...ms` with no errors.

- [ ] **Step 6.3: Run scoped test suite**
```
npx vitest run src/components/features/assets/ src/components/features/audit/ src/components/features/catalogs/ src/components/common/shell-parts.test.tsx --reporter verbose 2>&1 | tail -20
```
Expected: all tests pass. If any fail, run the failing test file in isolation to check if it's a pre-existing flake or a regression:
```
npx vitest run <failing-test-file> --reporter verbose 2>&1
```

- [ ] **Step 6.4: Grep-check that no original strings remain in non-parts files**
```
grep -rn "fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60" C:/Users/DELL/Desktop/assets-crm/src/ --include="*.tsx" | grep -v "parts/"
```
Expected: zero results.

```
grep -rn "fixed inset-0 z-\[200\] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" C:/Users/DELL/Desktop/assets-crm/src/ --include="*.tsx"
```
Expected: zero results.

```
grep -rn "absolute inset-0 bg-black/60 backdrop-blur-\[2px\] anim-backdrop-fade" C:/Users/DELL/Desktop/assets-crm/src/ --include="*.tsx"
```
Expected: zero results.

---

## Deliberate Non-extractions (report these)

These patterns were evaluated and deliberately left as-is:

| Pattern | Occurrences | Reason skipped |
|---|---|---|
| `fixed inset-0 z-50 flex items-center justify-center bg-black/60` (no `max-md:items-end`) | 2 (AuthSettingsPanel + PendingUsersPage — but PendingUsersPage also has `backdrop-blur-sm`) | Variants differ from each other and from DIALOG_BACKDROP; effectively 1 each |
| `MODAL_PANEL` (`bg-surface rounded-2xl shadow-2xl ... border-border/60 anim-modal-pop`) | 2 | Below threshold; each has unique width/layout extra classes |
| Dropdown containers (`bg-surface-2 border border-border rounded-xl anim-*`) | 2 (ProfileMenu, NotificationBell) | Below threshold; unique positioning/z-index per instance |
| `ActivateKeyModal.tsx:150` separator | 1 of the 3 `LIST_ROW_SEPARATOR` hits | Embedded in complex template literal with runtime conditional; skip to preserve safety |
| Parts files | Many | Other tab's in-flight code with 11 pre-existing TS errors; surgical avoidance required |

---

## Self-Review Checklist

- [x] Spec coverage: all ≥3 patterns captured; below-threshold patterns documented as deliberate skips.
- [x] No placeholders: every step has exact file paths, exact before/after strings, exact commands.
- [x] Type consistency: `DIALOG_BACKDROP`, `DIALOG_BACKDROP_BLUR`, `MODAL_BACKDROP_ABS`, `LIST_ROW_SEPARATOR`, `LIST_ROW_SEPARATOR_FULL` — same names used in styles.ts definition and in every consumer step.
- [x] cn() usage: every per-instance extra class is preserved via `cn(CONSTANT, 'extra')` — no class is dropped.
- [x] Desktop/mobile classes preserved: all `max-md:` responsive prefixes are inside the constant strings, not stripped.
- [x] Parts files: explicitly excluded in file structure and each task. No task modifies any file under `src/components/features/parts/` or `src/pages/PartsPage.tsx`.
