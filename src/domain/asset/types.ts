/** The four canonical AMS asset statuses (CONFIRMED v8). Order = display order. */
export const ASSET_STATUS_IDS = ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'] as const
export type AssetStatusId = (typeof ASSET_STATUS_IDS)[number]

export function isAssetStatusId(v: string): v is AssetStatusId {
  return (ASSET_STATUS_IDS as readonly string[]).includes(v)
}

export type AssignmentMode = 'employee' | 'department' | 'branch'

export interface AssetAssignment {
  mode: AssignmentMode
  employeeId?: string
  departmentId?: string
  branchId?: string
}

export interface AssetSpecs {
  cpu?: string
  ram?: string
  ssd?: string
  gpu?: string
}

/** A single tracked physical item. Mirrors Firestore assets/{id}. */
export interface Asset {
  id: string
  categoryId: string
  brand: string | null
  model: string | null
  invCode: string
  serial: string | null
  statusId: string
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  /** ISO timestamp string. */
  updatedAt: string
  currentSpecs?: AssetSpecs | null
}

/** Reference rows resolved alongside assets so the table can render names. */
export interface RefRow { id: string; name: string }
export interface CategoryRow extends RefRow { group: 'devices' | 'network' | 'furniture'; lucideIcon: string }
export interface StatusRow extends RefRow { color: string }

export interface EmployeeRow {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
}

export type AssetGroupFilter = 'all' | 'devices' | 'network' | 'furniture'
export type AssetSort = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'inv_asc'

export interface AssetListQuery {
  group?: AssetGroupFilter
  statusId?: string | 'all'
  branchId?: string | 'all'
  search?: string
  sort?: AssetSort
}

export function parseInventoryCode(code: string): { prefix: string; number: string } | null {
  const m = /^([^/]+)\/(.+)$/.exec(code)
  if (!m) return null
  return { prefix: m[1]!, number: m[2]! }
}
