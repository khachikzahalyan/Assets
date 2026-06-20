# Role-Specific Dashboards (lightweight, MVP) — Design Spec

**Date:** 2026-06-20
**Status:** Approved (owner brief is clear; one fork decided owner-style and documented in §7)
**Depends on:** all 11 prior iterations shipped (auth/guards/rules, assets, assignments+act-scan+mail, employees+self-service, pending-users, catalogs, audit viewer, license module).

## 1. Goal

Replace the minimal placeholder `DashboardPage` (4 dash-only KPI tiles showing `—`) with **role-specific dashboards on real data**, gated per role. Phase-1 MVP scope: the spec says dashboards are **lightweight**. The target is simple numeric KPI tiles + a few recent-activity lists with pure-CSS proportion bars — NOT charts, NOT a charting dependency.

`employee` continues to be bounced to `/my-assets` by the existing `RoleGate` on `/dashboard` — that behaviour is unchanged. Only `super_admin`, `asset_admin`, `tech_admin` see `/dashboard`, each with content tailored to their role.

## 2. Architecture — mirror the established pattern exactly

A new **read-only `DashboardRepository` port** aggregates from existing collections. No new business collections, no new write paths, no mutation methods.

```
src/domain/dashboard/types.ts             summary value types (one per section)
src/domain/dashboard/DashboardRepository.ts   read-only port (one method per section)
src/domain/dashboard/index.ts             barrel
src/infra/repositories/inMemoryDashboardRepository.ts    InMemory adapter (mirrors numbers)
src/infra/repositories/firestoreDashboardRepository.ts   Firestore adapter (bounded reads)
src/hooks/useDashboard.ts                  role-aware aggregation hook
src/components/features/dashboard/*        KpiTile, StatusBreakdown, BranchBreakdown,
                                           GroupBreakdown, LicenseStatTile, RecentActivityList,
                                           PeopleTile, index barrel
src/pages/DashboardPage.tsx                rewritten — role-gated section composition
src/locales/{ru,en,hy}/dashboard.json      Tier-1 keys
```

Wiring: extend `domain/index.ts` + `repositories/index.ts` barrels; add `dashboard` namespace to i18n config; register `useDashboard` in `hooks/index.ts`. No route changes (DashboardPage already routed + RoleGated). No nav changes.

**Composition root** mirrors `LicensesPage`: `DashboardPage` accepts an optional `repo?: DashboardRepository` prop (test seam); when absent it builds `useMemo(() => new FirestoreDashboardRepository(db()), [])`. The page imports `db` + the named Firestore repo class from `@/infra/repositories` ONLY in that composition root — no raw `firebase/firestore` calls in the page. This is the same accepted "repo-factory" boundary every other page uses.

### Why a dedicated port (not reuse the 6 existing list ports directly in the page)

A dashboard is an aggregation concern. Calling six list ports from the page and reducing client-side would (a) over-fetch (full asset list, full license list, full employee list just to count), (b) duplicate reduction logic across InMemory/Firestore, (c) leak collection knowledge into the page. A single port with section methods keeps each summary small, keeps reduction in one tested place per adapter, and keeps the page a thin composition of role-gated sections.

### Aggregation strategy: bounded reads, NOT count() aggregation

No file in the codebase uses `getCountFromServer` today. Introducing `count()` aggregation would (a) create a new pattern, (b) make InMemory mirror harder (it would have to special-case "count vs read"), and (c) need its own rules-test consideration. At org scale (hundreds of assets, not millions) bounded `getDocs` reads are correct and cheap. Both adapters read the same docs and reduce identically, so InMemory and Firestore numbers match by construction — which is exactly what makes the InMemory unit tests meaningful for the production numbers.

Bounds: asset stats read the assets collection (hundreds). License stats read the licenses collection. People reads `employees` (count) + `pending_users`/`users` (super_admin only). Recent activity + recent audit are `limit`-bounded reads on `audit_logs` (default 8 rows each).

## 3. Domain — `src/domain/dashboard/types.ts`

```ts
import type { AssetStatusId } from '@/domain/asset'
import type { AuditLog } from '@/domain/audit'

export type AssetGroup = 'devices' | 'network' | 'furniture'

export interface BranchCount { branchId: string; name: string; count: number }
export interface GroupCount { group: AssetGroup; count: number }

export interface AssetStats {
  total: number
  byStatus: Record<AssetStatusId, number>   // all 4 keys always present (0 default)
  byGroup: GroupCount[]                      // devices/network/furniture, 0-filled
  topBranches: BranchCount[]                 // top N branches by asset count (default 5)
}

/** One recent assign/return event, derived from audit_logs (entityType:'assignment'). */
export interface AssignmentActivityRow {
  auditId: string
  assetId: string                 // entityId of the assignment audit row's subject asset
  action: 'assigned' | 'returned'
  actorUid: string
  at: string                      // ISO
}

export interface AssignmentActivity {
  currentlyOut: number            // = AssetStats.byStatus['st_assigned']; passed in, not re-queried
  recent: AssignmentActivityRow[]
}

export interface WorkstationLicenseStats {
  total: number
  free: number      // lifecycleStatus active && assignmentType unassigned
  inUse: number     // lifecycleStatus active && assignmentType employee|device
  retired: number   // lifecycleStatus retired
}

export interface PeopleStats {
  employeeCount: number
  pendingUsersCount: number | null   // null when caller is not super_admin
}

/** Bundle returned by the hook; per-section nulls = "not loaded for this role / failed". */
export interface DashboardData {
  assets: AssetStats | null
  assignments: AssignmentActivity | null
  workstationLicenses: WorkstationLicenseStats | null
  serverLicenseCount: number | null
  people: PeopleStats | null
  recentAudit: AuditLog[] | null
}
```

## 4. Port — `src/domain/dashboard/DashboardRepository.ts`

```ts
export interface DashboardRepository {
  loadAssetStats(topBranches?: number): Promise<AssetStats>
  /** Recent assign/return rows from audit_logs (entityType:'assignment'), newest first. */
  loadAssignmentActivity(limitN?: number): Promise<AssignmentActivityRow[]>
  loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats>
  /** super_admin only — caller gates; method itself just counts server_licenses. */
  loadServerLicenseCount(): Promise<number>
  /** pendingUsersCount is queried only when includePending is true (super_admin). */
  loadPeopleStats(includePending: boolean): Promise<PeopleStats>
  /** super_admin only — recent audit rows, newest first. Reuses audit read path; keys already masked. */
  loadRecentAudit(limitN?: number): Promise<AuditLog[]>
}
```

Each method is independently role-gated **at the call site** (the hook). A method a role can't use is never invoked, so its data is never fetched. The Firestore `loadServerLicenseCount` / `loadPeopleStats(true)` / `loadRecentAudit` reads are only reachable for super_admin because the hook never calls them otherwise — and firestore.rules already restrict `server_licenses`, `pending_users`/`users`, and the audit `entityType` scope server-side regardless (defense in depth).

## 5. Role → visible sections (mirrors nav RoleGate exactly)

| Section | super_admin | asset_admin | tech_admin |
|---|---|---|---|
| Asset KPIs: total + byStatus + byGroup + topBranches | yes | yes | yes |
| Assignment activity (recent + currently-out) | yes | yes | yes (read-only view) |
| Workstation license stats (free/in-use/retired) | yes | no | yes |
| Server license count | yes | no | no |
| People: employee count | yes | yes | no |
| Pending users link/count | yes | no | no |
| Recent audit | yes | no | no |

Rationale for the role splits:
- License stats follow `licenses` nav `allow: ['super_admin','tech_admin']`. asset_admin has no license nav → no license tiles.
- Server license count follows server-license rules (super_admin write-only; count is super_admin-only here to match nav, which never shows server licenses to tech_admin).
- People (employees) follows `employees` nav `allow: ['super_admin','asset_admin']`. tech_admin has no employee PII tiles.
- Pending users + recent audit follow `pending-users` / `audit` nav `allow: ['super_admin']`.
- `employee` → unchanged: `RoleGate` on `/dashboard` bounces to `/my-assets`. DashboardPage is never rendered for employees.

The hook computes the permitted-section set from `role` via the SAME `allow` lists used by nav/access (imported, not re-hardcoded where practical) so dashboard gating and nav gating cannot diverge.

## 6. Data hook — `src/hooks/useDashboard.ts`

`useDashboard(repo, role)` →`{ data: DashboardData, loading, error, reload }`.

- On mount / `reload`, fires `Promise.allSettled` over ONLY the section fetches the role permits.
- Each settled section populates its `DashboardData` slot; a rejected section leaves its slot `null` and contributes to a non-fatal per-section error indication (the page renders an `ErrorState` only for the section(s) that failed, never blanks the whole dashboard).
- `currentlyOut` is filled from `assets.byStatus['st_assigned']` after asset stats resolve (no extra query).
- Stable-repo contract identical to `useAssets` (repo must be memoized; documented in JSDoc).
- `loading` is true until all permitted sections settle.

## 7. Decided fork (owner-style; documented per protocol)

**Assignment "recent activity" data source.** The `AssignmentRepository` exposes only per-asset / per-employee history — no "recent across all assets" method. Options: (A) add `listRecentAssignments(n)` to the assignment port + adapters + a new index; (B) derive recent assign/return rows from the existing `audit_logs` read path (`entityType:'assignment'`, already ordered by `at desc`, already indexed by the `entityType + at` composite).

**Decision: B.** Reuses an existing indexed read path, adds no assignment-port surface and no new index, keeps the dashboard a pure read-aggregator, and the audit trail is the canonical activity record. The audit row's `action` is `'assigned' | 'returned'`; its `entityId` is the asset id (assignment audits are written with the asset as subject — confirmed by `inMemoryAssignmentRepository`). This is the lightest option and fits the MVP mandate. `currentlyOut` reuses asset status counts — zero extra cost.

## 8. UI — dark/orange, existing primitives

Components in `src/components/features/dashboard/`, all using `SectionCard` / `Icon` / existing `EmptyState` / `LoadingState` / `ErrorState`:

- **KpiTile** — icon badge + label + big tabular number + optional sub-line; wraps a `react-router` link to the section's page.
- **StatusBreakdown** — 4 rows (Warehouse/Assigned/In Repair/Disposed), each a label + count + a pure-CSS proportion bar tinted with the status `color` from reference data. No SVG library.
- **GroupBreakdown** — devices/network/furniture counts (compact bars).
- **BranchBreakdown** — top-5 branches by count, name + count rows.
- **LicenseStatTile** — total + free/in-use/retired chips. Aggregate numbers ONLY — never a key, never a license name list.
- **PeopleTile** — employee count; pending-users count as a secondary line linking to `/pending-users` (super_admin only).
- **RecentActivityList** — generic list for assignment activity + recent audit; each row: icon + action label + relative/DD/Mon/YYYY time + link to the relevant detail page. For audit rows, render the already-masked fields only.

Each section: its own loading / empty / error state. Sections the role can't access are not rendered (no empty placeholder). Layout: responsive grid of KPI tiles on top, breakdown + activity cards below, matching the prototype shell's dark/orange aesthetic.

## 9. i18n

New `dashboard` namespace in `ru` (default), `en`, `hy`. Tier-1 chrome only: section titles, KPI labels ("Total assets", "Currently out", "Free / In use / Retired", "Employees", "Pending", "Recent activity", "Recent audit"), action labels, empty/error copy, relative-time units if any. Status/category/branch display names come from existing reference data (Tier-2, localized at source) — the dashboard does NOT re-translate them.

## 10. Indexes / rules / security

- Recent assignment activity + recent audit both query `audit_logs` ordered by `at` — covered by the existing `entityType + at` composite index. **No new index expected.** If the firebase-engineer finds a query shape needing one, it is added to `firestore.indexes.json`.
- No new collections, no new write paths, audit immutability untouched.
- Rules: every dashboard read targets a collection a signed-in admin can already read under current rules (`assets`, `licenses`, `server_licenses` super_admin, `employees`, `pending_users`/`users` super_admin, `audit_logs` role-scoped). If any new read path is introduced, a rules test is authored for CI (Java unavailable locally → authored, not run).
- **Security invariants (security-reviewer must confirm):** (1) no raw license keys anywhere — only aggregate counts; (2) tech_admin never receives employee PII tiles; (3) server-license count + pending-users + recent-audit fetched ONLY for super_admin (hook never calls them otherwise); (4) no over-fetch beyond what each section needs; (5) audit rows render already-masked fields only.

## 11. Verification

`npm run typecheck`, `npm test -- --run` (577 app baseline must stay green; new tests additive → higher count), `npm run build`. Gates: spec-reviewer → code-quality-reviewer → security-reviewer (mandatory). Per-task commits on `feat/role-dashboards`; owner merges to `master`.

## 12. Out of scope (explicit)

No charts/charting deps. No Phase-2/3 (repairs, parts, write-off approval, inventory walk, notifications matrix). No employee-dashboard (employees use self-service). No real-time `onSnapshot` (dashboards load-on-mount + manual reload — lightweight). No date-range filtering on the dashboard (full-page Audit/Assets pages own filtering).
