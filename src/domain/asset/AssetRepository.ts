import type {
  Asset, AssetListQuery, CategoryRow, CategoryGroupRow, StatusRow, RefRow, EmployeeRow,
  AssetStatusId, AssetAssignment, AssetSpecs,
} from './types'
import type { Role } from '@/config/roles'
import type { UpgradeComponent, UpgradeEvent } from './upgrade-types'
import type { AuditedResult, AuditLog } from '@/domain/audit'

/** Reference data needed to render the assets table without N+1 reads. */
export interface AssetReferenceData {
  statuses: StatusRow[]
  branches: RefRow[]
  departments: RefRow[]
  categories: CategoryRow[]
  employees: EmployeeRow[]
  /** Dynamic top-level category groups — drives GroupTabs; empty array = no tabs rendered. */
  categoryGroups: CategoryGroupRow[]
}

/** Catalog rows a self-service (employee) page can read under the tightened rules.
 *  Excludes /employees (employee cannot list the directory) and any admin-only collection.
 *  Branches + departments are both allow read: isSignedIn() so employees may read them. */
export interface SelfServiceRefData {
  statuses: StatusRow[]
  categories: CategoryRow[]
  branches: RefRow[]
  departments: RefRow[]
}

/**
 * Read-side port for the Assets list. Mutations (create/edit/withAudit) arrive
 * in a later plan. Implementations: firestoreAssetRepository (production),
 * inMemoryAssetRepository (tests/dev).
 */
export interface AssetRepository {
  /** Returns ALL assets matching the query, sorted. Pagination is applied in the UI
   *  layer over the returned set (the dataset is org-scale: hundreds, not millions). */
  listAssets(query: AssetListQuery): Promise<Asset[]>
  /** Loads the reference rows needed to resolve names/colors/icons for the table. */
  loadReferenceData(): Promise<AssetReferenceData>
  /** Assets currently assigned to a given employee (self-service). */
  listAssetsForEmployee(employeeId: string): Promise<Asset[]>
  /** Resolves the first asset whose `invCode` exactly equals the argument, or `null`.
   *  Used by the barcode scanner to navigate from a scanned code to the asset detail. */
  findByInvCode(invCode: string): Promise<Asset | null>
  /** Catalogs an employee may read (statuses, categories, branches, departments) — for self-service pages.
   *  Does NOT read /employees, so it works under the employee-scoped read rules. */
  loadSelfServiceRefData(): Promise<SelfServiceRefData>
}

export interface Actor { uid: string; role: Role }

export interface CreateAssetInput {
  categoryId: string
  brand: string | null
  model: string | null
  type?: string | null
  invCode: string
  serial: string | null
  /** Optional pre-generated barcode from the draft preview so the printed label matches the
   *  preview. If provided AND still free, the repo persists it as-is; otherwise it allocates a fresh one. */
  barcode?: string
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  currentSpecs?: AssetSpecs | null
  /** Condition at registration; 'new' carries purchase + warranty dates. */
  condition?: 'new' | 'used' | null
  /** ISO date (YYYY-MM-DD); only when condition === 'new'. */
  purchaseDate?: string | null
  /** ISO date (YYYY-MM-DD); only when condition === 'new'. */
  warrantyEndsAt?: string | null
  /**
   * OEM license to create or re-bind when the asset is created.
   *
   * - `{ kind: 'manual', rawKey }`: creates a new device-bound Retail workstation
   *   license (type:'Retail', isReusable:true). The raw secret is persisted by the
   *   `setLicenseKey` callable in the page layer (Firestore rules deny `secrets/*`
   *   from the client SDK).
   * - `{ kind: 'oem-digital' }`: creates a firmware-embedded OEM license
   *   (type:'OEM', isReusable:false). No rawKey — the key is burned into firmware.
   * - `{ existingLicenseId }`: the identified license is re-bound to the new asset
   *   as a device assignment (it must currently exist in the workstation-license store).
   * - Absent / null: no license action is taken (backwards-compatible default).
   */
  oemLicense?: { kind: 'manual'; rawKey: string } | { kind: 'oem-digital' } | { existingLicenseId: string } | null
}

export interface UpdateAssetInput {
  brand?: string | null
  model?: string | null
  type?: string | null
  serial?: string | null
  currentSpecs?: AssetSpecs | null
}

export interface ChangeStatusOpts {
  comment?: string
  assignment?: AssetAssignment | null
  branchId?: string
  deptId?: string | null
}

export interface AssetWriteRepository {
  getAsset(id: string): Promise<Asset | null>
  /** Resolves the first asset whose `invCode` exactly equals the argument, or `null` if none exists. */
  findByInvCode(invCode: string): Promise<Asset | null>
  /** Resolves the first asset whose `barcode` equals the argument, or `null`. */
  findByBarcode(barcode: string): Promise<Asset | null>
  /** True if any OTHER asset already uses this barcode. */
  isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean>
  isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean>
  isSerialTaken(serial: string, exceptId?: string): Promise<boolean>
  createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  /**
   * Group registration: creates many assets sharing all fields except inventory
   * code + serial. Enforces dual uniqueness — each invCode/serial is checked against
   * existing assets AND against the other rows in the same batch (GOLDEN RULE). Throws
   * on the first duplicate before any write. Returns the created assets in input order.
   */
  createAssetsBatch(inputs: CreateAssetInput[], actor: Actor): Promise<Asset[]>
  updateAsset(id: string, patch: UpdateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts): Promise<AuditedResult<Asset>>
  addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>>
  listUpgrades(id: string): Promise<UpgradeEvent[]>
  /** Audit history for a single entity (asset detail page). */
  listAudit(entityId: string): Promise<AuditLog[]>
  /**
   * Re-assigns many assets to the same target in one logical operation.
   * Internally loops changeStatus(id, 'st_assigned', actor, { assignment, comment })
   * so each asset gets its own audit entry (assignment + status atomic). Returns the
   * audit ids in input order. Errors propagate (caller decides retry).
   */
  bulkChangeAssignment(
    ids: string[],
    assignment: AssetAssignment,
    actor: Actor,
    comment?: string,
  ): Promise<{ assetId: string; auditId: string }[]>
}
