import type { UpgradeSlot } from '@/domain/part/types'

/** The four canonical AMS asset statuses (CONFIRMED v8). Order = display order. */
export const ASSET_STATUS_IDS = ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'] as const
export type AssetStatusId = (typeof ASSET_STATUS_IDS)[number]

export function isAssetStatusId(v: string): v is AssetStatusId {
  return (ASSET_STATUS_IDS as readonly string[]).includes(v)
}

/**
 * The transfer modes available from the Asset Detail screen.
 *
 * - `'employee'`    — assigned to a person (employeeId). May be office/remote.
 * - `'department'`  — attributed to a department (shared asset).
 * - `'branch'`      — relocated to a branch (the ONLY mode that moves the asset's branchId).
 * - `'warehouse'`   — unassigned-on-shelf. This is a transfer INTENT only; the persisted
 *                     `asset.assignment` becomes `null` (see {@link Asset.assignment}). There is
 *                     no stored assignment object whose `mode === 'warehouse'`.
 * - `'temporary'`   — temporary hold referencing a KIND (tempKind: audit / intern), NOT a person.
 *                     Requires `expiresAt`.
 */
export type AssignmentMode = 'employee' | 'department' | 'branch' | 'warehouse' | 'temporary'

export interface AssetAssignment {
  mode: AssignmentMode
  employeeId?: string
  departmentId?: string
  branchId?: string
  workMode?: 'office' | 'remote' | null   // carried through from Firestore by the raw-cast repo
  /** Forward-compatible temporary-assignment attribute (AMS schema §5 assignments.isTemporary). */
  isTemporary?: boolean
  /**
   * ISO string; required when `mode === 'temporary'` (and whenever `isTemporary === true`).
   */
  expiresAt?: string | null
  /**
   * Role tag for temporary holders (auditor / intern). When `mode === 'temporary'` the
   * assignment references this KIND, never an employee — `employeeId` is left unset.
   */
  tempKind?: 'audit' | 'intern' | 'staff' | null
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
  /** Furniture free-text type (e.g. «Стол»); null for devices/network. */
  type?: string | null
  invCode: string
  serial: string | null
  /** System-generated unique numeric barcode (Code 128 label). Optional: null/absent for legacy assets. */
  barcode?: string | null
  statusId: string
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  /** ISO timestamp string. */
  updatedAt: string
  currentSpecs?: AssetSpecs | null
  /**
   * Live hardware-slot snapshot maintained by the parts module (install/uninstall flow);
   * complements currentSpecs (which stays the create-form spec object).
   */
  upgradeCurrent?: UpgradeSlot[] | null
  /** Condition at registration: 'new' captures purchase date + warranty; 'used' omits them. */
  condition?: 'new' | 'used' | null
  /** ISO date (YYYY-MM-DD); set when condition === 'new'. */
  purchaseDate?: string | null
  /** ISO date (YYYY-MM-DD); set when condition === 'new'. */
  warrantyEndsAt?: string | null
}

/** Reference rows resolved alongside assets so the table can render names. */
export interface RefRow { id: string; name: string }
export interface CategoryRow extends RefRow {
  group: 'devices' | 'network' | 'furniture'
  lucideIcon: string
  /** When true, the asset-create form renders the OEM License Key section. */
  hasOemLicense?: boolean
  /** When true, the form renders the Характеристики (specs) panel. */
  hasSpecs?: boolean
  /** When true, a Серийный номер is required (devices/network); false for furniture. */
  requiresSerial?: boolean
  /** When true, the form renders the single «Тип» field instead of Brand+Model (furniture). */
  hasTypeField?: boolean
}
export interface StatusRow extends RefRow { color: string }

export interface EmployeeRow {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  departmentId?: string | null
  position?: string | null
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
