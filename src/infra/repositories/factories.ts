import { collection, doc, getDocs, query as fsQuery, where, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FirestoreUserRepository } from './firestoreUserRepository'
import type { UserRepository } from '@/domain/user'
import { FirestorePartRepository } from './firestorePartRepository'
import type { PartRepository, PartWriteRepository } from '@/domain/part/PartRepository'
import { FirestoreAssetRepository } from './firestoreAssetRepository'
import { FirestoreAssignmentRepository } from './firestoreAssignmentRepository'
import { FirestoreAuditLogRepository } from './firestoreAuditLogRepository'
import { FirestoreDashboardRepository } from './firestoreDashboardRepository'
import { FirestoreAuthSettingsRepository } from './firestoreAuthSettingsRepository'
import { FirestoreSubscriptionRepository } from './firestoreSubscriptionRepository'
import { FirestoreWorkstationLicenseRepository } from './firestoreWorkstationLicenseRepository'
import { FirestoreBranchRepository } from './firestoreBranchRepository'
import { FirestoreDepartmentRepository } from './firestoreDepartmentRepository'
import { FirestoreCategoryRepository } from './firestoreCategoryRepository'
import { FirestoreCategoryGroupRepository } from './firestoreCategoryGroupRepository'
import { FirestorePartCategoryRepository } from './firestorePartCategoryRepository'
import { FirestoreEmployeeRepository } from './firestoreEmployeeRepository'

/**
 * Re-syncs the denormalized `deptId` field on all assets currently assigned to
 * the given employee. Called after a successful updateEmployee when departmentId
 * changes. No per-asset audit row is written: deptId is a reflection of
 * employee.departmentId, not an independent asset business event. The change is
 * already captured in the employee 'updated' audit entry.
 */
async function syncAssetDeptId(employeeId: string, newDeptId: string | null): Promise<void> {
  const database = db()
  const snap = await getDocs(fsQuery(
    collection(database, 'assets'),
    where('assignment.employeeId', '==', employeeId),
  ))
  if (snap.empty) return
  const batch = writeBatch(database)
  for (const d of snap.docs) {
    batch.set(doc(database, 'assets', d.id), { deptId: newDeptId, updatedAt: serverTimestamp() }, { merge: true })
  }
  await batch.commit()
}

/** Production default UserRepository, wired to the Firestore singleton. */
export function createDefaultUserRepository(): UserRepository {
  return new FirestoreUserRepository(db())
}

/**
 * Production default PartRepository + PartWriteRepository, wired to the Firestore singleton.
 * Both read and write interfaces are implemented by FirestorePartRepository.
 */
export function createDefaultPartRepository(): PartRepository & PartWriteRepository {
  return new FirestorePartRepository(db())
}

// ── Shared production singletons ─────────────────────────────────────────────
// Keyed lazy cache: each production repository is constructed once and reused
// across navigations, keeping every repo's reference-data cache (and SWR cache
// identity, which keys off the repo reference) stable. Test callers inject their
// own repos via component props and never touch this cache.
const _cache = new Map<string, unknown>()
function shared<T>(key: string, create: () => T): T {
  if (!_cache.has(key)) _cache.set(key, create())
  return _cache.get(key) as T
}

/** Shared AssetRepository singleton (plain — no license side-writes). */
export function getSharedAssetRepository(): FirestoreAssetRepository {
  return shared('asset', () => new FirestoreAssetRepository(db()))
}

/**
 * Shared AssetRepository constructed WITH the shared workstation-license repo, so
 * `createAsset` can create/re-bind device-bound OEM licenses. Used by the create page.
 */
export function getSharedAssetRepositoryWithLicenses(): FirestoreAssetRepository {
  return shared(
    'asset:with-licenses',
    () => new FirestoreAssetRepository(db(), getSharedWorkstationLicenseRepository()),
  )
}

/** Shared AssignmentRepository singleton. */
export function getSharedAssignmentRepository(): FirestoreAssignmentRepository {
  return shared('assignment', () => new FirestoreAssignmentRepository(db()))
}

/** Shared AuditLogRepository singleton. */
export function getSharedAuditLogRepository(): FirestoreAuditLogRepository {
  return shared('auditLog', () => new FirestoreAuditLogRepository(db()))
}

/** Shared DashboardRepository singleton. */
export function getSharedDashboardRepository(): FirestoreDashboardRepository {
  return shared('dashboard', () => new FirestoreDashboardRepository(db()))
}

/** Shared AuthSettingsRepository singleton. */
export function getSharedAuthSettingsRepository(): FirestoreAuthSettingsRepository {
  return shared('authSettings', () => new FirestoreAuthSettingsRepository(db()))
}

/** Shared SubscriptionRepository singleton. */
export function getSharedSubscriptionRepository(): FirestoreSubscriptionRepository {
  return shared('subscription', () => new FirestoreSubscriptionRepository(db()))
}

/** Shared WorkstationLicenseRepository singleton. */
export function getSharedWorkstationLicenseRepository(): FirestoreWorkstationLicenseRepository {
  return shared('workstationLicense', () => new FirestoreWorkstationLicenseRepository(db()))
}

/** Shared BranchRepository singleton. */
export function getSharedBranchRepository(): FirestoreBranchRepository {
  return shared('branch', () => new FirestoreBranchRepository(db()))
}

/** Shared DepartmentRepository singleton. */
export function getSharedDepartmentRepository(): FirestoreDepartmentRepository {
  return shared('department', () => new FirestoreDepartmentRepository(db()))
}

/** Shared CategoryRepository singleton. */
export function getSharedCategoryRepository(): FirestoreCategoryRepository {
  return shared('category', () => new FirestoreCategoryRepository(db()))
}

/** Shared CategoryGroupRepository singleton. */
export function getSharedCategoryGroupRepository(): FirestoreCategoryGroupRepository {
  return shared('categoryGroup', () => new FirestoreCategoryGroupRepository(db()))
}

/** Shared UserRepository singleton (concrete Firestore type). */
export function getSharedUserRepository(): FirestoreUserRepository {
  return shared('user', () => new FirestoreUserRepository(db()))
}

/** Shared plain EmployeeRepository singleton (no last-super-admin guard). */
export function getSharedEmployeeRepository(): FirestoreEmployeeRepository {
  return shared('employee', () => new FirestoreEmployeeRepository(db()))
}

/**
 * Shared EmployeeRepository singleton wired with the last-super-admin guard AND
 * the active-assets guard AND the dept-change resync callback:
 * - lastSuperAdminCheck: resolves true when terminating the target uid would leave zero super admins.
 * - activeAssetsCheck: resolves true when the employee has active asset assignments that must be returned first.
 * - onDeptChange: re-syncs deptId on all assets assigned to the employee (denormalized field, no per-asset audit).
 */
export function getSharedEmployeeRepositoryWithGuard(): FirestoreEmployeeRepository {
  return shared(
    'employee:with-guard',
    () =>
      new FirestoreEmployeeRepository(
        db(),
        async (targetUid: string) =>
          (await getSharedUserRepository().countSuperAdmins(targetUid)) === 0,
        async (employeeId: string) =>
          (await getSharedAssetRepository().listAssetsForEmployee(employeeId)).length > 0,
        syncAssetDeptId,
      ),
  )
}

/** Shared PartRepository + PartWriteRepository singleton. */
export function getSharedPartRepository(): PartRepository & PartWriteRepository {
  return shared('part', () => new FirestorePartRepository(db()))
}

/** Shared PartCategoryRepository singleton (super_admin management + runtime catalog). */
export function getSharedPartCategoryRepository(): FirestorePartCategoryRepository {
  return shared('partCategory', () => new FirestorePartCategoryRepository(db()))
}
