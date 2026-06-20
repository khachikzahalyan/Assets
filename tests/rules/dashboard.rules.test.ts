import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { authedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests scoped to the read paths that the
 * role-dashboards feature (Tasks 1–7) depends on. All tests use collection
 * queries — getDocs(collection(...)) — because that is what the aggregation
 * adapters actually issue, not single-document getDoc calls.
 *
 * These tests do NOT duplicate secrets deny-all coverage (in licenses.rules.test.ts)
 * or single-doc read coverage (in firestore.rules.test.ts). They focus on whether
 * LISTING a collection succeeds or fails for each role.
 *
 * NOTE: requires the Firestore emulator (JVM). Run via `npm run test:rules`.
 * Excluded from the default `vitest run` by vitest.config.ts exclude glob.
 */

const SUPER = 'dash_super1'
const ASSET = 'dash_asset1'
const TECH = 'dash_tech1'
const EMP = 'dash_emp1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await makeTestEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Re-seed user role docs after every clear — required because the rules
  // resolve roles via get(/users/{uid}).data.role on every request.
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
})

afterAll(async () => {
  await env.cleanup()
})

// ---------------------------------------------------------------------------
// 1. dashboard asset-stats read path
//    Dashboard section: AssetStatsCard (total / by-status / by-category counts)
//    Adapter: firestoreDashboardRepository.getAssetStats() — getDocs(collection('assets'))
//    Also reads branches + categories as reference data for stat labels.
// ---------------------------------------------------------------------------

describe('dashboard asset-stats read path', () => {
  beforeEach(async () => {
    await seedDoc(env, 'assets/dash_a1', { name: 'Laptop A', statusId: 'st1', categoryId: 'cat1' })
    await seedDoc(env, 'assets/dash_a2', { name: 'Monitor B', statusId: 'st2', categoryId: 'cat2' })
    await seedDoc(env, 'branches/br1', { name: 'HQ' })
    await seedDoc(env, 'categories/cat1', { name: 'Laptop', group: 'devices', lucideIcon: 'laptop' })
    await seedDoc(env, 'categories/cat2', { name: 'Monitor', group: 'devices', lucideIcon: 'monitor' })
  })

  // Assets collection — admins must be able to list for stats aggregation.
  it('super_admin CAN list /assets (asset-stats card)', async () => {
    // Protects: AssetStatsCard total/by-status counts for super_admin dashboard.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'assets')))
  })

  it('asset_admin CAN list /assets (asset-stats card)', async () => {
    // Protects: AssetStatsCard for asset_admin dashboard.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'assets')))
  })

  it('tech_admin CAN list /assets (asset-stats card)', async () => {
    // Protects: AssetStatsCard for tech_admin dashboard (read: isAnyAdmin()).
    await assertSucceeds(getDocs(collection(authedDb(env, TECH), 'assets')))
  })

  it('employee CANNOT list /assets (employees never reach the dashboard)', async () => {
    // Confirms the dashboard never leaks the full asset collection to employees.
    // The /assets rule grants list only to isAnyAdmin() or the specific assigned employee
    // doc read — a collection query for an employee resolves to deny (fail-closed).
    await assertFails(getDocs(collection(authedDb(env, EMP), 'assets')))
  })

  // Branches — any signed-in user CAN read per the /branches rule (isSignedIn()).
  it('super_admin CAN list /branches (reference data for branch filter on stats)', async () => {
    // Protects: branch reference lookup used in asset distribution by branch.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'branches')))
  })

  it('asset_admin CAN list /branches (reference data for branch filter on stats)', async () => {
    // Same rule: allow read: if isSignedIn() — asset_admin is signed in.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'branches')))
  })

  // Categories — any signed-in user CAN read per the /categories rule (isSignedIn()).
  it('super_admin CAN list /categories (reference data for category breakdown on stats)', async () => {
    // Protects: category name resolution in the asset-stats breakdown.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'categories')))
  })

  it('asset_admin CAN list /categories (reference data for category breakdown on stats)', async () => {
    // Same rule: allow read: if isSignedIn() — asset_admin is signed in.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'categories')))
  })
})

// ---------------------------------------------------------------------------
// 2. dashboard workstation-license stats read path
//    Dashboard section: LicenseStatsCard (workstation/employee licenses)
//    Adapter: firestoreDashboardRepository.getLicenseStats() — getDocs(collection('licenses'))
//    Rule: allow read: if isAnyAdmin() — covers all three admin roles.
// ---------------------------------------------------------------------------

describe('dashboard workstation-license stats read path', () => {
  beforeEach(async () => {
    await seedDoc(env, 'licenses/lic1', { name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active' })
    await seedDoc(env, 'licenses/lic2', { name: 'Office 365', assignmentType: 'unassigned', lifecycleStatus: 'expiring_soon' })
  })

  it('super_admin CAN list /licenses (license-stats card)', async () => {
    // Protects: LicenseStatsCard active/expiring counts for super_admin.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'licenses')))
  })

  it('tech_admin CAN list /licenses (license-stats card)', async () => {
    // Protects: LicenseStatsCard for tech_admin — tech manages licenses per role matrix.
    await assertSucceeds(getDocs(collection(authedDb(env, TECH), 'licenses')))
  })

  it('asset_admin CAN list /licenses (rules allow isAnyAdmin; hook restricts for asset_admin)', async () => {
    // The /licenses rule grants read to isAnyAdmin(), so asset_admin CAN list.
    // Defense-in-depth note: the dashboard aggregation hook does NOT call getLicenseStats()
    // for asset_admin (the hook filters by role before issuing the query). The rule is
    // intentionally permissive; restriction is enforced at the application layer.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'licenses')))
  })

  it('employee CANNOT list /licenses (no employee access to license collection)', async () => {
    // Protects: employees have no path to license data; the /licenses rule requires isAnyAdmin().
    await assertFails(getDocs(collection(authedDb(env, EMP), 'licenses')))
  })
})

// ---------------------------------------------------------------------------
// 3. dashboard server-license count read path
//    Dashboard section: ServerLicenseStatsCard (company-wide server licenses)
//    Adapter: firestoreDashboardRepository.getServerLicenseCount() — getDocs(collection('server_licenses'))
//    Rule: allow read: if isAnyAdmin() — all three admin roles can list.
//    Hook note: the dashboard hook only calls getServerLicenseCount() for super_admin.
// ---------------------------------------------------------------------------

describe('dashboard server-license count read path', () => {
  beforeEach(async () => {
    await seedDoc(env, 'server_licenses/srv1', { name: 'Windows Server 2022', lifecycleStatus: 'active' })
    await seedDoc(env, 'server_licenses/srv2', { name: 'SQL Server 2022', lifecycleStatus: 'expiring_soon' })
  })

  it('super_admin CAN list /server_licenses (server-license count card)', async () => {
    // Protects: ServerLicenseStatsCard for super_admin — primary consumer of this stat.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'server_licenses')))
  })

  it('tech_admin CAN list /server_licenses (rules allow isAnyAdmin; hook restricts)', async () => {
    // The /server_licenses rule grants read to isAnyAdmin(), so tech_admin CAN list.
    // Hook note: the dashboard aggregation hook restricts server-license count display
    // to super_admin only. The rule is permissive; restriction is at the application layer.
    await assertSucceeds(getDocs(collection(authedDb(env, TECH), 'server_licenses')))
  })

  it('asset_admin CAN list /server_licenses (rules allow isAnyAdmin; hook restricts)', async () => {
    // Same as tech_admin: rules permit, hook suppresses.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'server_licenses')))
  })

  it('employee CANNOT list /server_licenses (no employee access)', async () => {
    // Protects: employees have no path to server license data; rule requires isAnyAdmin().
    await assertFails(getDocs(collection(authedDb(env, EMP), 'server_licenses')))
  })
})

// ---------------------------------------------------------------------------
// 4. dashboard people + pending read path
//    Dashboard section: PeopleStatsCard (employee count + pending-user count)
//    Adapters:
//      - firestoreDashboardRepository.getEmployeeCount() — getDocs(collection('employees'))
//      - firestoreDashboardRepository.getPendingUserCount() — getDocs(query('users', where('status','==','no-role')))
//    Rule for employees: isAnyAdmin() | self-read. Collection query = deny for employee.
//    Rule for users: self or super_admin. Query requires super_admin to succeed.
// ---------------------------------------------------------------------------

describe('dashboard people + pending read path', () => {
  beforeEach(async () => {
    await seedDoc(env, 'employees/emp_seed1', { firstName: 'Alice', lastName: 'Smith', email: 'alice@ams.test', status: 'active' })
    await seedDoc(env, 'employees/emp_seed2', { firstName: 'Bob', lastName: 'Jones', email: 'bob@ams.test', status: 'active' })
    // Seed a no-role pending user so the pending query has a doc to return.
    // seedUser would set status:'active'; use seedDoc for the no-role shape.
    await seedDoc(env, 'users/pending_u1', { email: 'pending@ams.test', displayName: 'Pending', status: 'no-role' })
  })

  it('super_admin CAN list /employees (people-stats card employee count)', async () => {
    // Protects: PeopleStatsCard total employee count for super_admin.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'employees')))
  })

  it('asset_admin CAN list /employees (people-stats card employee count)', async () => {
    // Protects: PeopleStatsCard for asset_admin — manages employees per role matrix.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'employees')))
  })

  it('employee CANNOT list /employees (only own doc is readable for employees)', async () => {
    // Confirms employees cannot enumerate the employee directory from the dashboard.
    // The /employees rule grants collection list only to isAnyAdmin(); employees get
    // self-read of a single doc only, which does not permit a collection query.
    await assertFails(getDocs(collection(authedDb(env, EMP), 'employees')))
  })

  it('super_admin CAN query /users where status==no-role (pending-users count)', async () => {
    // Protects: PeopleStatsCard pending-users badge for super_admin.
    // The /users rule: allow read: if isSignedIn() && (uid==self || isSuperAdmin()).
    // A collection query where the caller is super_admin satisfies isSuperAdmin() for
    // every document in the result set, so the query is permitted.
    await assertSucceeds(
      getDocs(query(collection(authedDb(env, SUPER), 'users'), where('status', '==', 'no-role'))),
    )
  })

  it('asset_admin CANNOT query /users where status==no-role (not super_admin)', async () => {
    // The /users read rule requires uid==self OR isSuperAdmin(). An asset_admin reading
    // other users' docs fails the rule, so the collection query is denied.
    // This confirms the pending-user count is super_admin-only as intended.
    await assertFails(
      getDocs(query(collection(authedDb(env, ASSET), 'users'), where('status', '==', 'no-role'))),
    )
  })
})

// ---------------------------------------------------------------------------
// 5. dashboard recent-audit read path
//    Dashboard section: RecentActivityCard (last N audit events)
//    Adapter: firestoreDashboardRepository.getRecentAudit(limit) — getDocs(collection('audit_logs'))
//    Rule: allow read: if isAnyAdmin() | employee-scoped-assignment row.
//    Hook note: the dashboard only calls getRecentAudit() for super_admin.
//    Employee-scoped audit reads are already covered in firestore.rules.test.ts.
// ---------------------------------------------------------------------------

describe('dashboard recent-audit read path', () => {
  beforeEach(async () => {
    await seedDoc(env, 'audit_logs/recent1', {
      entityType: 'asset',
      entityId: 'a1',
      action: 'created',
      actorUid: ASSET,
      actorRole: 'asset_admin',
      before: null,
      after: { name: 'Laptop A' },
    })
    await seedDoc(env, 'audit_logs/recent2', {
      entityType: 'employee',
      entityId: 'emp1',
      action: 'created',
      actorUid: SUPER,
      actorRole: 'super_admin',
      before: null,
      after: { firstName: 'Alice' },
    })
  })

  it('super_admin CAN list /audit_logs (recent-activity card)', async () => {
    // Protects: RecentActivityCard ordered audit stream for super_admin.
    // The dashboard aggregation hook only calls getRecentAudit() for super_admin —
    // other admin roles see a scoped or empty recent-activity section. This assertion
    // pins that the underlying rule permits the query.
    // NOTE: employee-scoped audit reads (single-doc, entityType==assignment) are
    // already tested in 'audit_logs employee-scoped read' in firestore.rules.test.ts.
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'audit_logs')))
  })

  it('asset_admin CAN list /audit_logs (isAnyAdmin grants read)', async () => {
    // Rules permit isAnyAdmin() to list audit_logs. The dashboard hook may or may
    // not surface the full audit stream for asset_admin — that is a hook-layer
    // decision, not a rules-layer restriction.
    await assertSucceeds(getDocs(collection(authedDb(env, ASSET), 'audit_logs')))
  })

  it('tech_admin CAN list /audit_logs (isAnyAdmin grants read)', async () => {
    // Same as asset_admin above — rules allow, hook may restrict.
    await assertSucceeds(getDocs(collection(authedDb(env, TECH), 'audit_logs')))
  })
})
