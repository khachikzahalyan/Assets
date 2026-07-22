# Code Order Cleanup — 4 mechanical subtasks (owner-approved 2026-07-21)

Constraints (apply to ALL subtasks):
- NO git operations (no add/commit/push). NO deploys.
- NO file edits via PowerShell Get-Content/Set-Content/Add-Content/WriteAllText —
  PS 5.1 on this machine mangles UTF-8-without-BOM Russian text. Only Read/Write/Edit tools.
- Do not touch: functions/, src/locales/** (unless Task 2 forces a key — then sync ru/en/hy),
  AuthSettingsPanel, beforeCreate gate files, docs/ (other than this plan).
- After each subtask: `npm run build` must be clean. After all: full
  `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`.

## Task 1 — Repository registry (factories.ts)

Extend `src/infra/repositories/factories.ts` into a shared lazy-singleton registry
(one exported `getShared<X>Repository()` per repo class, consistent with existing
`createDefaultUserRepository` / `createDefaultPartRepository` style; internally may use a
generic `getShared(key, factory)` memo). Migrate every module-level
`let _shared... / getShared...()` copy-paste and every direct `new Firestore*Repository(db())`
in pages/hooks/components onto factories.

Inventory (from recon, non-test):
- src/pages/assets/AssetsPage.tsx (FirestoreAssetRepository)
- src/pages/assets/AssetCreatePage.tsx (Asset+WorkstationLicense; asset repo built WITH license repo 2nd arg — preserve)
- src/pages/assets/AssetDetailPage.tsx (Asset, Assignment, WorkstationLicense)
- src/pages/audit/AuditPage.tsx (AuditLog)
- src/pages/dashboard/DashboardPage.tsx (Dashboard)
- src/pages/licenses/LicensesPage.tsx (WorkstationLicense, AuditLog, Subscription, Employee, Asset — 5)
- src/pages/scan/ScanPage.tsx (Asset)
- src/pages/settings/SettingsPage.tsx (AuthSettings)
- src/pages/catalogs/BranchesPage.tsx, DepartmentsPage.tsx, CategoriesPage.tsx (Branch, Department, Category + CategoryGroup)
- src/pages/self-service/ProfilePage.tsx (Employee, Asset), MyActsPage.tsx (Assignment), MyAssetsPage.tsx (Asset)
- src/pages/employees/useEmployeesData.ts (Employee w/ countSuperAdmins callback via UserRepository, Asset, Assignment)
- src/pages/parts/PartsPage.tsx (already uses createDefaultPartRepository — fold its local singleton into registry)
- src/components/common/NotificationBell.tsx (Asset)

Rules: pages/hooks/components must no longer import `db` or concrete Firestore* classes;
injected test props (`repository?: X`) stay untouched. `firestoreUserRepository.ts` internal
`new FirestoreEmployeeRepository(this.db)` stays (infra-internal).
Asset repo: keep TWO factories — plain shared asset repo, and asset-repo-with-license-support
for the create flow (constructor 2nd arg optional) — or one shared instance with license repo
wired IF verified behavior-identical for all consumers. Employee repo factory must preserve
the isLastSuperAdmin-style callback exactly.

## Task 2 — Constants instead of magic strings

- `'br_main'` → HEAD_OFFICE_BRANCH_ID (src/domain/asset/transferRules.ts) in non-test files:
  useEmployeesData.ts, AssetsFilterBar.tsx, AssetsTable.tsx (definition file keeps the literal).
- `'st_*'` literals → ASSET_STATUS_IDS / AssetStatusId const usage (src/domain/asset/types.ts) in
  ~16 non-test files (see grep list in session). Where a single id is needed, add/use named
  constants (e.g. an `ASSET_STATUS` map or existing exports from @/domain/asset) — do NOT
  invent per-file string copies. Definition site src/domain/asset/types.ts keeps literals.
- Fix typo'd hardcoded string in src/infra/repositories/firestorePartRepository.reads.ts:86
  `'Сетевые Устройство'`: it is the PartsAsset.kind display-fallback label for server-family
  devices (consumed by DeviceGridCard/InstallModal as fallback text). Move to a documented
  constant in src/domain/part/types.ts (correct spelling «Сетевые устройства»), reference it
  from the repo + update the type comment. Note it is a legacy display fallback; UI prefers
  categoryName.
- Tests keep literals as-is.

## Task 3 — Move shared modules

- features/assets/create/DatePicker.tsx → src/components/ui/DatePicker.tsx, export from
  ui/index.ts; update importers: audit/AuditFilterBar, employees/DestPicker,
  assets/create (ConditionWarranty), assets/detail/TransferPanel, and their tests' import paths.
- features/assets/categoryColors.ts → src/components/common/categoryColors.ts; importers:
  parts/DeviceGridCard, parts/InstalledDetailPanel, parts/DeviceDetailMobileView, assets/*.
- features/assets/create/SpecCombobox.tsx (used by licenses/LicensePicker) → src/components/ui/;
  update importers incl. assets/create/SpecsPanel. Zero logic changes.

## Task 4 — PartMovement type completeness

src/domain/part/types.ts PartMovement already has broken/serviceReplace/note/kindLabel.
Recon confirms NO repository writes `displayType` or `factory`. Add optional
`displayType?: 'move'` and `factory?: boolean` with doc comments stating they are
prototype-parity journal fields not currently written by production repositories (guarded
reads in UI). Then remove ALL `(mv as any)` casts in
src/components/features/parts/InstalledDetailPanel.tsx (~90, 338-340, 369, 377) and
HistoryPanel.tsx (~28). Zero behavior change.

## Verification
- `npm run build` after each task; full vitest run at the end; update any tests
  broken purely by import-path moves.
