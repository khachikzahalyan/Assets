# Asset Detail Screen — Full Parity Plan (`/assets/:id`)

Goal: rebuild `src/pages/AssetDetailPage.tsx` to achieve full **visual + logic parity** with
`C:/Users/DELL/Desktop/Warehouse/prototypes/asset-detail.html`, on the production dark/orange
React 19 + Vite + TS + Firebase app. Data from Firestore via existing audited repos. Russian-only.

## Baseline (verified before any change)
- `npm run typecheck` → exit 0 (clean).
- `npm run test` → 107 files / 974 tests, all green (flaky AssetCreateForm.freekey passed).

## Design source = prototype (canonical). Production tokens (dark/orange) confirmed:
- Surfaces: `#1B1F24` card, `#22272E` soft, `#2A2F36` border, `#3A4048` hover-border, `#111315` page.
- Text: `#F8FAFC` / `#CBD5E1` / `#94A3B8` / `#64748B`.
- Accent orange: `#F97316` / `#FB923C` / `#EA580C`.
- Tile accents (LOCKED palette, dark): CPU=orange `#F97316`, GPU/ГРАФИКА=violet, RAM/ОЗУ=emerald,
  Storage/НАКОПИТЕЛИ=sky, Cooler/ОХЛАЖДЕНИЕ=cyan, PSU/БЛОКИ ПИТАНИЯ=amber, Battery=rose,
  OS/cores/model/color/panel/ports=slate, IMEI=sky.
- Animations: `.anim-fade-slide-in`, `.anim-modal-pop`, `.anim-backdrop-fade` (add to index.css if absent).

## Backend contract (existing, reuse — NO new Cloud Functions)
- `AssetWriteRepository.changeStatus(id, toStatusId, actor, { assignment?, comment? })` — atomic
  status + `asset.assignment` + `status_changed` audit. THIS is the single audited path for
  Transfer / Write-off / Repair / Return.
- `AssetWriteRepository.listAudit(id)` — audit history (asset history tab source).
- `AssetWriteRepository.listUpgrades(id)` / `addUpgrade` — upgrade events (read-only here; parts in parts.html).
- `AssignmentRepository.listAssignments(id)` — assignment doc history.
- `WorkstationLicenseRepository.listForAsset(id)` — device-bound licenses (License block + reveal).
- `WriteOffAssetService.writeOff(id, actor)` — atomic dispose + license decouple/retire.
- `revealLicenseKey('licenses', id)` callable — RAW key reveal (super_admin, server-enforced).

## Domain changes (domain-modeler)
1. `AssetAssignment.mode`: extend to `'employee' | 'department' | 'branch' | 'warehouse' | 'temporary'`.
   - `'warehouse'` and `'temporary'` are detail-page transfer semantics; `'temporary'` carries
     `tempKind` (`'audit' | 'intern'`) + `expiresAt`, references a KIND not a person.
   - Keep existing optional fields (`isTemporary`, `expiresAt`, `tempKind`, `workMode`).
2. Add `AssignmentMode` re-export incl. new members. Update `isAssignmentMode`-style guards if any.
3. Tests: domain assignment-types test asserts the 5 modes + temporary shape.

## Transfer commit mapping (firebase-engineer wires; pure mapping in domain helper `transferRules.ts`)
`buildTransferPatch(prev, next)` → `{ toStatusId, assignment, comment? }` then page calls `changeStatus`.
- warehouse  → status `st_warehouse`, assignment `null`.
- employee   → status `st_assigned`, assignment `{ mode:'employee', employeeId }`; force branch HQ (br_main), deptId = emp.deptId.
- branch     → status `st_assigned`, assignment `{ mode:'branch', branchId }`; branch = chosen branch (ONLY relocating mode).
- department → status `st_assigned`, assignment `{ mode:'department', departmentId }`; force branch HQ.
- temporary  → status `st_assigned`, assignment `{ mode:'temporary', tempKind, expiresAt, isTemporary:true }`; force branch HQ.
- workMode 'remote' only valid for laptop categories (gate in UI; default 'office').
- `HEAD_OFFICE_BRANCH_ID = 'br_main'` (single const). Branch coherence: LocationCard reads asset.branchId/deptId.

## Component tree (react-ui-engineer) — `src/components/features/assets/detail/`
Compose in `AssetDetailPage.tsx`:
- `DetailHero` — accent bar, category icon box, title, inv-code mono pill, category chip, SN, status chip, «Списать» (rose) → opens WriteOffModal. Breadcrumb + X handled in page header.
- `DetailTabs` — 3 tabs: Тех. характеристики / История / Документы + "Добавлено {date}" on the right. Specs/Docs hidden for furniture.
- `TechSpecsCard` + `SpecTile` — tile grid (TECH_FIELDS order + accents), derived RAM/Storage/Cooler/Battery/PSU, «Скопировать» (buildSpecsCopyText, exact render order), then `LicenseBlock`, footer «Запчасти» link-out.
- `LicenseBlock` — OS license: product + OEM/Manual chip + key (masked when OEM/«Встроен в BIOS») + «Копировать» + RevealKeyButton (super_admin) reusing existing reveal callable + listForAsset.
- `AssignmentCard` + `TransferPanel` + `ModeTile` + `TransferModeForm` — current assignment display (warehouse/employee/branch/department/temporary, avatar/icon) + «Передать» → inline panel, 5 modes, per-mode picker (employee Select / branch Select / department Select / temporary kind Select + DatePopover min=today), commit via buildTransferPatch→changeStatus.
- `LocationCard` — branch (+ landmark/building icon) + optional department, coherent after transfer.
- `RepairCard` — 3 states (idle / form-open[reason+severity] / in-repair[alert+«Вернуть»]); send→changeStatus('st_repair', comment=reason); return→changeStatus('st_assigned'). Reuse existing audited path.
- `WriteOffModal` — backdrop blur + reason textarea + danger confirm + ESC/backdrop close; confirm→WriteOffAssetService.writeOff (atomic dispose + license decouple/retire). (Existing WriteOffConfirmModal is bulk-shaped; build a single-asset modal matching the prototype.)
- `HistoryCard` + `HistoryEvent` — card-per-event, per-icon tint (HISTORY_TINT), creation strip, before→after rose/emerald delta pills, head-label rule, meta (actor · fmtDate · relativeTime). Source = listAudit mapped to event shape via `auditToHistoryEvent.ts`.
- `DocumentsTab` — list act scans from assignments (actStoragePath) → open via actScanUrl; upload affordance DISABLED with «Скоро» notice (Storage not configured). Empty state.
- Shared helpers `detailFormat.ts`: relativeTime, fmtDate(ru short), fmtTime, fmtRuDate, pluralRecords, derived* summaries, buildSpecsCopyText, HISTORY_TINT, TECH_FIELDS, TILE_ACCENT, describeAssignment, initials, avatar palette (reuse AssigneeCell palette if present).

## i18n (i18n-engineer) — RU only, src/locales/ru/assets.json
Add namespaces: `detail.tabs.*`, `detail.specs.*` (labels for TECH_FIELDS + copy button), `detail.license.*`,
`detail.transfer.*` (5 modes + banners + temporary kinds), `detail.repair.*` (states + severity), `detail.writeOff.*`,
`detail.history.*` (creation strip, count plural, no-records), `detail.docs.*` (empty, upload-soon notice),
`detail.location.*`. Reuse existing `assign.*`, `form.*`, `history.action.*` where they already fit.

## Tests (test-engineer, gate each implementer)
- domain: 5-mode assignment + temporary shape; buildTransferPatch mapping (all 5 modes incl. HQ-force + deptId derivation).
- ui/integration on AssetDetailPage (InMemory repos):
  - tab switching (specs/history/docs).
  - spec-copy text equals expected dump (render order).
  - transfer: warehouse/employee/branch/department/temporary → asset.assignment + status + 1 audit entry; branch relocates, others force HQ.
  - write-off modal → st_disposed + reason + license decouple/retire (preserve existing 2 license tests; adapt to modal click + reason).
  - repair: send→st_repair (+reason), return→st_assigned, with audit.
  - history rendering: creation strip + delta pills + count.
  - documents: empty state + upload-soon disabled.
- UPDATE existing tests intentionally changed (list in report):
  - AssetDetailPage.test.tsx write-off tests: now go through WriteOffModal (click «Списать» → type reason → confirm).
  - AssetDetailPage.assignment.test.tsx: assignment now via TransferPanel (5-mode) — adapt selectors; keep audit/mail assertions.

## Reviews
spec-reviewer → code-quality-reviewer → security-reviewer (audit immutability, no audit bypass, reveal gating, no raw key in mock/audit, rules unaffected). Loop on FAIL.

## DoD
- typecheck exit 0; build exit 0; full vitest no NEW failures vs baseline (107/974).
- Visual parity on dark theme. New tests for transfer/write-off/repair mapping, spec-copy, history, tabs.

## Deferred (with reason)
- Documents UPLOAD — Firebase Storage not configured (console step pending). List/empty/open existing scans only; upload disabled with «Скоро» notice. Do NOT fake uploads.
- Full Repairs module (repairs list page) — Phase-2 stub. Per-asset repair action only (status change).
- Parts management (UpgradesPanel write) stays in parts.html; detail Tech Specs is READ-ONLY for parts.
