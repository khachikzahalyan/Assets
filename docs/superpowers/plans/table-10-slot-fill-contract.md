# Table 10-slot fill contract (owner spec 2026-08-04)

## Goal
Every desktop list table shows exactly 10 slots per page and the 10 slots evenly
divide the available card height (no dead zone above pagination, no bloated rows).
Mechanism: `fillHeight` on DataTable gives every real row AND every placeholder
`flex: '1 1 0'` with the existing `minHeight: '3.625rem'` rem floor (restore of
what commit 961dc4f removed). Header stays `2.75rem`.

## Survey result (2026-08-04)
| Surface | State before | Action |
|---|---|---|
| src/components/ui/DataTable.tsx | flex removed by 961dc4f; rem floor + header OK | RESTORE flex on rows + placeholders under fillHeight; update fillHeight doc-comment |
| src/components/ui/TableSkeleton.tsx | already flex 1 1 0 + 3.625rem floor | none |
| Assets (AssetsTable/AssetsPage) | minRows=10 + fillHeight + ListCard Zone 2 | verify only (etalon) |
| Employees (EmployeesTable) | minRows=10, desktop DataTable MISSING fillHeight | add fillHeight; verify EmployeesPage parent = bounded flex column |
| Licenses keys (WindowsKeysSection) | minRows=10 + fillHeight; skeleton 10 rows | verify only |
| Licenses subs (SubscriptionsSection) | card grid | skip (card grids untouched per spec) |
| Audit (AuditTable/AuditPage) | PAGE_SIZE=10, minRows=10, fillHeight | verify only |
| Branches/Departments/Categories (CatalogTable) | PAGE_SIZE=10, minRows=10, fillHeight | verify only |
| Roles (RolesPage DataTable) | PAGE_SIZE=10, minRows=10, fillHeight | verify only |
| Parts warehouse/devices tabs | not list tables (SKU browser + custom history rows); DevicesTab is off-limits (foreign in-flight work) | skip per spec condition |
| WorkstationLicenseTable / ServerLicenseTable | legacy, mounted nowhere | skip (no bounded parent; fillHeight would collapse them) |
| Dashboard AuditTable (recent activity) | explicitly excluded by owner | do not touch |

## Tasks (sequential)
1. **DataTable flex restore + contract test** (react-ui-engineer)
   - DataTable.tsx: add `...(fillHeight ? { flex: '1 1 0' } : {})` to real-row style
     and placeholder style; keep `minHeight: '3.625rem'`; update the `fillHeight`
     JSDoc (rows + placeholders distribute height evenly, rem floor = low-viewport
     safety) and the stale "rows never flex-grow" inline comment.
   - New jsdom test (DataTable.fillHeight.test.tsx or extend existing consumer
     tests): with fillHeight, rows and placeholders have `style.flex === '1 1 0px'`
     (jsdom serialization) and minHeight 3.625rem; without fillHeight — no flex.
2. **EmployeesTable fillHeight + sweep verify** (react-ui-engineer)
   - EmployeesTable.tsx desktop branch: pass `fillHeight` to DataTable.
   - EmployeesTable.test.tsx: extend to assert flex contract on desktop rows.
   - Verify (read-only unless broken): EmployeesPage / LicensesPage / AuditPage /
     Branches / Departments / Categories / RolesPage parents give bounded-height
     flex columns (assets ListCard Zone 2 pattern). Fix only real gaps, reusing
     the /assets pattern — no new components.
3. **Verification**: `npm run build` after each task; targeted tests per task;
   full `npm test` at the end (known flake: src/config/routes.test.tsx under full
   suite — passes in isolation, do not "fix").

## Constraints
- NO git write operations (owner commits).
- Do not touch: dashboard feature files/hooks/pages, untracked foreign files,
  DevicesTab.tsx, PartsPageSkeleton.tsx, locales/*/dashboard.json, index.css root
  formula and mobile blocks, label printing, mobile (<768px) card-list patterns.
- Files may be edited concurrently by another session — re-read before each edit.

## Rollback
Single-commit-sized diff; revert DataTable.tsx + EmployeesTable.tsx + tests.
