import type {
  Asset, AssetListQuery, CategoryRow, StatusRow, RefRow, EmployeeRow,
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
}

export interface Actor { uid: string; role: Role }

export interface CreateAssetInput {
  categoryId: string
  brand: string | null
  model: string | null
  type?: string | null
  invCode: string
  serial: string | null
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  currentSpecs?: AssetSpecs | null
  /** STUB seam (license plan): masked OEM key when category has hasOemLicense. */
  oemLicense?: { keyMasked: string } | null
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
}

export interface AssetWriteRepository {
  getAsset(id: string): Promise<Asset | null>
  isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean>
  isSerialTaken(serial: string, exceptId?: string): Promise<boolean>
  createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  updateAsset(id: string, patch: UpdateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts): Promise<AuditedResult<Asset>>
  addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>>
  listUpgrades(id: string): Promise<UpgradeEvent[]>
  /** Audit history for a single entity (asset detail page). */
  listAudit(entityId: string): Promise<AuditLog[]>
}
