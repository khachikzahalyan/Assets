# Drawer Asset Transfer Implementation Plan (REVISED — UI-only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let an admin select 1/several/all of an employee's linked assets in the Employee Detail Drawer and transfer them to warehouse / another employee / a department / a branch in one action, persisted with audit.

**Architecture:** REUSE the existing tested backend. The asset-cache layer already models all transfer modes: `buildTransferPatch(target, employeeDeptId)` (pure, `@/domain/asset`) derives `{toStatusId, assignment, branchId, deptId}`; `AssetRepository.changeStatus(id, toStatusId, actor, {assignment, comment})` persists status+assignment+audit atomically (both adapters); `AssetRepository.bulkChangeAssignment(ids, assignment, actor, comment)` does the multi-assign loop. Warehouse return = `changeStatus(id, 'st_warehouse', actor, {assignment:null, comment})`. **No `AssignmentRepository` / `ASSIGNMENT_MODES` / `firestore.rules` changes.** Work is: drawer multi-select UI + page wiring + i18n. «Временно» deferred.

**Tech Stack:** React 19 + Vite + TS (strict), Firebase modular SDK, Vitest + @testing-library/react, i18next (ru/en/hy).

**Spec:** `docs/superpowers/specs/2026-06-23-drawer-asset-transfer-design.md`

> ⚠️ Working tree has large pre-existing uncommitted (modified + untracked) changes from other in-flight work. NEVER `git add -A` / `git add .`. Each commit MUST `git add` only the exact files this plan touches.

---

## File Structure

- `src/locales/{ru,en,hy}/employees.json` — `transfer.*` keys (verify `dest.*` already exist).
- `src/components/features/employees/EmployeeDetailDrawer.tsx` — select mode + transfer bar (+ test).
- `src/pages/EmployeesPage.tsx` — `handleTransferAssets` using `assetRepo`; wire HandoverModal redirected dests (+ test).
- `src/components/features/employees/index.ts` — already exports drawer; no change expected.

No backend files. No rules. No `AssignmentRepository`.

---

## Task 1: i18n — transfer.* keys (i18n-engineer)

**Files:** `src/locales/ru/employees.json`, `src/locales/en/employees.json`, `src/locales/hy/employees.json`

- [ ] **Step 1:** Confirm `dest.warehouse/employee/department/branch/search/notFound` already exist in all three (they do — DestPicker uses them). Do not duplicate.
- [ ] **Step 2:** Add a `transfer` object to all three locales (identical keys, translated values):
  - ru: `select:"Передать"`, `selectMode:"Выбрать"`, `selectDone:"Готово"`, `selectAll:"Выбрать все"`, `deselectAll:"Снять все"`, `nSelected:"Выбрано: {{count}}"`, `action:"Передать"`, `confirmTitle:"Передать {{count}} → {{dest}}?"`, `confirm:"Передать"`, `cancel:"Отмена"`, `toastDone:"Передано: {{count}}"`, `toastFailed:"Не удалось передать"`.
  - en: `select:"Transfer"`, `selectMode:"Select"`, `selectDone:"Done"`, `selectAll:"Select all"`, `deselectAll:"Clear all"`, `nSelected:"Selected: {{count}}"`, `action:"Transfer"`, `confirmTitle:"Transfer {{count}} → {{dest}}?"`, `confirm:"Transfer"`, `cancel:"Cancel"`, `toastDone:"Transferred: {{count}}"`, `toastFailed:"Transfer failed"`.
  - hy: faithful Armenian translations of the same keys.
- [ ] **Step 3:** Run the i18n parity test if present (`npm test -- --run` filtered to locales) OR a quick node check that all three files parse and have identical key sets under `transfer`. → PASS.
- [ ] **Step 4: Commit** (add ONLY the 3 json files): `feat(i18n): transfer.* keys for drawer asset transfer`

---

## Task 2: Drawer UI — select mode + transfer bar (react-ui-engineer)

**Files:**
- Modify: `src/components/features/employees/EmployeeDetailDrawer.tsx`
- Test: `src/components/features/employees/EmployeeDetailDrawer.test.tsx`

**Prop additions** to `EmployeeDetailDrawerProps`:
```ts
import { DestPicker, type Destination } from './DestPicker'
// …
employees: { id: string; name: string; status: string }[]
departments: { id: string; name: string }[]
branches: { id: string; name: string }[]
onTransferAssets: (assetIds: string[], destination: Destination) => void
```

- [ ] **Step 1: Write failing component tests** (render with `open`, an active `emp`, 3 `linkedAssets`, and the new props; wrap in i18n provider as other employee tests do — copy the harness from `EmployeeDetailDrawer.test.tsx`):
  - Initially no checkboxes; clicking the «Выбрать» toggle (`transfer.selectMode`) enters select mode → each asset row renders a checkbox.
  - «Выбрать все» (`transfer.selectAll`) selects all rows; the selected-count (`transfer.nSelected`) shows 3.
  - With ≥1 selected, the transfer bar appears containing a DestPicker trigger + a «Передать» button (`transfer.action`).
  - Selecting a destination (default warehouse is fine) then clicking «Передать» shows the inline confirm; clicking confirm calls `onTransferAssets` once with the selected ids array + the chosen `Destination`.
  - After confirm, select mode exits and selection clears (assert checkboxes gone, transfer bar gone).
  - Toggling «Готово» (`transfer.selectDone`) exits select mode and clears selection without calling `onTransferAssets`.

- [ ] **Step 2: Run** `npm test -- --run src/components/features/employees/EmployeeDetailDrawer.test.tsx` → FAIL.

- [ ] **Step 3: Implement.**
  - Local state: `const [selectMode,setSelectMode]=useState(false)`, `const [selected,setSelected]=useState<Set<string>>(new Set())`, `const [dest,setDest]=useState<Destination>({kind:'warehouse'})`, `const [confirming,setConfirming]=useState(false)`.
  - Reset all four whenever `emp?.id` changes OR `open` flips to false: `useEffect(()=>{ setSelectMode(false); setSelected(new Set()); setDest({kind:'warehouse'}); setConfirming(false) }, [emp?.id, open])`.
  - Section bar (the `px-5 h-11` block): when `isActive && linkedAssets.length>0`, render a neutral toggle button to the LEFT of the existing «Привязать» CTA. Label = `selectMode ? t('transfer.selectDone') : t('transfer.selectMode')`. Style: `inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[14px] font-semibold text-[#94A3B8] bg-[#22272E] border border-[#2A2F36] hover:bg-[#2A2F36] transition-colors` with an icon (`list-checks` for select, `x` for done). Keep «Привязать» as-is. Wrap both in a `flex items-center gap-2`.
  - Asset row (`<li>`): when `selectMode`, prepend a checkbox span (reuse HandoverModal idiom): `w-5 h-5 rounded-md border-2 transition-colors flex items-center justify-center shrink-0` — emerald when selected (`border-emerald-500 bg-emerald-500` + a white `check` icon size 12), else `border-[#3A4048]`. In select mode the whole `<li>` becomes a button-like toggle: add `role="button" tabIndex={0} aria-pressed={selected.has(a.id)}`, `onClick` toggles membership, `onKeyDown` Enter/Space toggles. Out of select mode keep the row exactly as today (non-interactive). Selected rows get an emerald ring/bg tint like HandoverModal (`ring-emerald-500/30 bg-emerald-500/10`).
  - `toggleAll`: if `selected.size < linkedAssets.length` select all ids else clear.
  - Transfer bar: a pinned block placed BETWEEN the scrollable region and the footer (a new `<div className="px-5 py-3 border-t border-[#2A2F36] bg-[#111315]/60 shrink-0">`), rendered only when `selectMode && selected.size>0`.
    - Normal state (`!confirming`): a row with `[t('transfer.nSelected',{count:selected.size})]` (left), then a `<DestPicker value={dest} onChange={setDest} currentEmpId={emp.id} employees={employees} departments={departments} branches={branches} forceDropUp />`, then a primary «Передать» button (`Btn variant="primary" size="sm"` with `check`/`arrow-right-left` icon) that sets `confirming=true`.
    - Confirm state (`confirming`): swap the row to show `t('transfer.confirmTitle',{count:selected.size, dest: destLabel})` where `destLabel = dest.kind==='warehouse' ? t('dest.warehouse') : dest.label`, plus «Отмена» (ghost → `confirming=false`) and a primary «Передать» (`t('transfer.confirm')`) that runs: `onTransferAssets([...selected], dest)` then `setSelectMode(false); setSelected(new Set()); setConfirming(false); setDest({kind:'warehouse'})`.
  - Footer stays unchanged (the handover/restore footer is separate; the transfer bar sits above it).

- [ ] **Step 4: Run** the drawer test → PASS.

- [ ] **Step 5: Commit** (add ONLY drawer .tsx + its test): `feat(employees): multi-select asset transfer in detail drawer`

---

## Task 3: Page wiring — real persistence (react-ui-engineer)

**Files:**
- Modify: `src/pages/EmployeesPage.tsx`
- Test: `src/pages/EmployeesPage.test.tsx`

Relevant existing context in the page:
- `assetRepo` (= `assetRepository ?? defaultAssetRepo`) exposes `changeStatus` + `bulkChangeAssignment`.
- `buildTransferPatch` is importable from `@/domain/asset`.
- `detailLinkedAssets` is the drawer's list; `handleOpenDetail(detailId)` refreshes it.
- `deptMap`/`branchMap`/`employees` resolve names; `handoverEmployees` is the `{id,name,status}` list.
- `actor` is `{uid,role}`.

- [ ] **Step 1: Write failing tests** in `EmployeesPage.test.tsx` (use the existing test harness + inMemory repos; copy how other tests inject `assetRepository`/`assignmentRepository`/`repository`). A spy/inMemory asset repo whose `changeStatus`/`bulkChangeAssignment` are observable:
  - Open detail for an employee with ≥1 linked asset, enter select mode, select 1, keep dest=Склад, confirm → `assetRepo.changeStatus(assetId, 'st_warehouse', actor, {assignment:null, comment})` (or equivalent warehouse path) called once; `toast` shows `transfer.toastDone`; drawer list refreshed (asset removed).
  - Same but choose another employee dest → asset persisted with `assignment:{mode:'employee', employeeId}` and `statusId:'st_assigned'` (via `bulkChangeAssignment` or `changeStatus`). Assert the resulting asset cache via the inMemory repo.
  - Choose a department dest → asset persisted with `assignment:{mode:'department', departmentId}`.
  - (Regression) HandoverModal confirm with a redirected employee destination → that asset ends up assigned to the new employee (no longer a silent no-op).

- [ ] **Step 2: Run** `npm test -- --run src/pages/EmployeesPage.test.tsx` → FAIL.

- [ ] **Step 3: Implement.**
  - Import: `import { buildTransferPatch, type TransferTarget } from '@/domain/asset'`.
  - Add `handleTransferAssets(assetIds: string[], dest: Destination)`:
    ```ts
    async function handleTransferAssets(assetIds: string[], dest: Destination) {
      try {
        // Map DestPicker.Destination → TransferTarget
        const empDeptId = dest.kind === 'employee'
          ? (employees.find(e => e.id === dest.id)?.departmentId ?? null) : null
        for (const id of assetIds) {
          if (dest.kind === 'warehouse') {
            await assetRepo.changeStatus(id, 'st_warehouse', actor, { assignment: null })
          } else {
            const target: TransferTarget =
              dest.kind === 'employee'   ? { mode: 'employee',   employeeId: dest.id }   :
              dest.kind === 'department' ? { mode: 'department', departmentId: dest.id } :
                                           { mode: 'branch',     branchId: dest.id }
            const patch = buildTransferPatch(target, empDeptId)
            await assetRepo.changeStatus(id, patch.toStatusId, actor, { assignment: patch.assignment })
          }
        }
        showToast(t('transfer.toastDone', { count: assetIds.length }))
        if (detailId) await handleOpenDetail(detailId)
        if (!assetCountsProp) { const counts = await defaultLoadAssetCounts(); setAssetCounts(counts) }
      } catch {
        showToast(t('transfer.toastFailed'))
      }
    }
    ```
    (Use `bulkChangeAssignment` for the non-warehouse, multi-asset case if you prefer fewer round-trips — but per-id `changeStatus` is fine and keeps the warehouse/non-warehouse code symmetric. Pick one; tests assert the resulting cache, not the call shape.)
  - Pass new props to `<EmployeeDetailDrawer>`: `employees={handoverEmployees}`, `departments={departments}`, `branches={branches}`, `onTransferAssets={(ids,dst)=>{ void handleTransferAssets(ids,dst) }}`.
    - Note: `handoverEmployees` lacks `departmentId`. For the employee-dest department lookup, either (a) build a richer list `employees.map(e=>({id, name, status, departmentId}))` passed to the drawer, OR (b) resolve `empDeptId` from the page's full `employees` state inside `handleTransferAssets` (preferred — `employees` state has `departmentId`). Use (b).
  - Update `handleHandoverConfirm`: for rows where `r.received && r.destination.kind !== 'warehouse'`, call the same transfer logic (build target → `changeStatus`/`buildTransferPatch`) instead of the current no-op comment. Warehouse rows keep `returnAsset` OR `changeStatus(id,'st_warehouse',…)`. Keep the subsequent `repo.setStatus(handoverTarget.id,'terminated',actor)`.

- [ ] **Step 4: Run** the page test → PASS.

- [ ] **Step 5: Commit** (add ONLY `EmployeesPage.tsx` + its test): `feat(employees): wire drawer + handover transfers to persistence`

---

## Task 4: Verify + reviews

- [ ] `npm run build` clean for touched files; targeted tests green (`EmployeeDetailDrawer`, `EmployeesPage`, locales).
- [ ] spec-reviewer → code-quality-reviewer → security-reviewer (even though no rules change, security-reviewer confirms the asset write path + that no new collection/secret is touched and the audit invariant holds via `changeStatus`).
- [ ] Final report: design summary, what backend was REUSED (not built), UI changes, reviewer verdicts, «Временно» deferred status + open decisions, commit list, NOT merged.
