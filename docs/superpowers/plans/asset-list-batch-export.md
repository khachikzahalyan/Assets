# Plan — Asset List: Batch Select + Bulk Actions + Excel Export (Migration Step 2b)

Slug: `asset-list-batch-export`
Phase: 1 (MVP). Files only in production app `C:/Users/DELL/Desktop/assets-crm`.

## Goal
Port the two flows deferred from Step 2 of the Asset List migration, faithful to
`C:/Users/DELL/Desktop/Warehouse/prototypes/asset-list.html`:
1. **Client-side Excel export** of the currently-filtered list.
2. **Batch select + bulk actions** mapped to the REAL audited domain (no hard delete,
   no Cloud Functions, no audit bypass).

RUSSIAN-ONLY (only `src/locales/ru/*.json`). Build ON TOP of the Step-2 redesign — do
not regress category icon boxes, remote badge, «Склад» label.

## Verified facts (do not re-investigate)
- Audited write paths already exist and are stable:
  - Write-off: `WriteOffAssetService.writeOff(assetId, actor, comment?)` → `changeStatus(→st_disposed)` + license reconcile (audited).
  - Send to repair: `AssetWriteRepository.changeStatus(assetId, 'st_repair', actor)` (audited).
  - Return: `AssignmentRepository.returnAsset(assetId, actor)` (audited).
  - Transfer to branch: `AssignmentRepository.assign({ assetId, mode:'branch', branchId, invCode }, actor)` (audited).
- `FirestoreAssetRepository` implements both `AssetRepository` & `AssetWriteRepository`.
- `FirestoreAssignmentRepository`, `FirestoreWorkstationLicenseRepository` exist.
- Portal-modal pattern to follow: `src/components/common/SearchPalette.tsx`. No shared Modal primitive exists.
- Prototype export uses `xlsx-js-style@1.2.0`. No xlsx dep currently in production package.json.
- Role gate: bulk mutations require `super_admin | asset_admin` (`canMutate`). Firestore rules already enforce write by super_admin/asset_admin.

## Judgment calls (locked)
- **Export = real `.xlsx`** via `xlsx-js-style` (matches «Экспорт в Excel» + prototype styling exactly: indigo `4F46E5` header, zebra, autofilter, freeze top row, RU filename `АМС-активы-YYYY-MM-DD.xlsx`). Columns = the **visible production table** (no Дата покупки/Стоимость — not in production Asset type): Категория, Бренд, Модель, Инв. код, Серийный №, Статус, Назначен, Филиал.
- **Bulk actions = Write-off, Send to repair, Return to warehouse, Transfer to branch.** Excluded: bulk assign-to-employee (per-asset act-scan + email; prototype doesn't batch it), hard delete (AMS never hard-deletes).
- Each bulk op = **N sequential audited writes** via the existing audited methods; per-asset success/fail tracking + summary. Destructive (write-off) confirmed by modal.

## Data model / types
No Firestore schema change. New UI-only types:
- `BulkActionKind = 'writeoff' | 'repair' | 'return' | 'transfer'`
- `BulkResult = { ok: number; failed: { id: string; invCode: string }[] }`

## File tree (create ✚ / modify ✎)
- ✚ `src/lib/export/assetsExport.ts` — pure builder: `buildAssetExportRows(assets, ref)` → row objects; `exportAssetsXlsx(assets, ref)` → triggers download. Lazy-import `xlsx-js-style`.
- ✚ `src/lib/export/assetsExport.test.ts` — unit tests for row builder (columns, fallbacks, «Склад»/assignee/status resolution) with xlsx mocked.
- ✚ `src/components/features/assets/bulk/useBulkAssetActions.ts` — hook owning audited bulk execution (N audited writes, per-asset try/catch, returns `BulkResult`). Repos injected.
- ✚ `src/components/features/assets/bulk/useBulkAssetActions.test.ts` — verifies each action routes to the correct audited repo method, N calls, partial-failure aggregation, role guard.
- ✚ `src/components/features/assets/bulk/BulkActionBar.tsx` — toolbar shown when ≥1 selected: count, action buttons, clear-selection. Prototype-styled.
- ✚ `src/components/features/assets/bulk/BulkConfirmModal.tsx` — portal modal (SearchPalette pattern) for destructive/transfer confirmation; transfer needs a branch Select.
- ✎ `src/components/features/assets/AssetsTable.tsx` — add checkbox column (select-all header + per-row), `selectedIds`/`onToggle`/`onToggleAll` props. Preserve all Step-2 redesign cells.
- ✎ `src/pages/AssetsPage.tsx` — selection state, wire BulkActionBar + modal + export button in header, run bulk via hook, reload + clear selection on completion.
- ✎ `src/components/features/assets/index.ts` (+ bulk barrel if present) — export new components.
- ✎ `src/locales/ru/assets.json` — new keys under `export`, `bulk`, `bulkConfirm`.
- ✎ `package.json` / lockfile — add `xlsx-js-style` dependency.
- ✎ `src/pages/AssetsPage.test.tsx` — extend for selection + export-button presence (no NEW failures).

## i18n keys (Tier-1, ru only)
```
export.button = "Экспорт в Excel"
export.loading = "Подготовка…"
bulk.selected = "Выбрано: {{n}}"
bulk.clear = "Снять выделение"
bulk.writeOff = "Списать"
bulk.repair = "В ремонт"
bulk.return = "Вернуть на склад"
bulk.transfer = "Переместить в филиал"
bulk.done = "Готово: {{ok}}"
bulk.partial = "Готово: {{ok}}, ошибок: {{failed}}"
bulkConfirm.writeOffTitle = "Списать активы?"
bulkConfirm.writeOffBody = "Будет списано активов: {{n}}. Действие необратимо."
bulkConfirm.repairTitle = "Отправить в ремонт?"
bulkConfirm.returnTitle = "Вернуть на склад?"
bulkConfirm.transferTitle = "Переместить в филиал"
bulkConfirm.transferPickBranch = "Выберите филиал"
bulkConfirm.confirm = "Подтвердить"
bulkConfirm.cancel = "Отмена"
bulkConfirm.count = "Активов: {{n}}"
```

## Audit preservation (HARD)
Every bulk mutation goes through an EXISTING audited repo method — one audit entry per
asset per the existing pattern. No new write path, no batched write that skips audit.
Bulk = a loop of audited single-asset writes. `security-reviewer` must confirm.

## Task breakdown (sequential)
1. **devops-engineer** — add `xlsx-js-style` dep; verify install; `npm run typecheck`.
2. **domain/export (react-ui-engineer)** — `assetsExport.ts` pure builder + download. → test-engineer.
3. **firebase-engineer** — `useBulkAssetActions.ts` audited bulk hook. → test-engineer.
4. **react-ui-engineer** — AssetsTable checkboxes + BulkActionBar + BulkConfirmModal + AssetsPage wiring + export button. → test-engineer.
5. **i18n-engineer** — ru keys. → test-engineer.

## Verification
- `npm run typecheck` → exit 0.
- `npm run test` → no NEW failures vs baseline (93 files / 826 tests green).
- New tests for export builder + bulk hook pass.

## Rollback
All additive except AssetsTable/AssetsPage edits; revert those two files + remove new
files + drop dep to restore Step-2 state.
