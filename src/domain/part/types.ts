import type { Role } from '@/config/roles'

/**
 * Seed/fallback set of the 7 canonical part-category ids.
 * These ids are STABLE — existing parts docs, part_movements, and UpgradeSlot.kind
 * values need zero migration.
 * @see src/domain/part/partCategoryDefaults.ts for the full PartCategoryDef rows.
 */
export const PART_CATEGORIES = ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'] as const

/**
 * A part-category id. Relaxed to `string` to accept dynamic categories from
 * the Firestore part_categories catalog. `PART_CATEGORIES` above is the legacy
 * seed/fallback set; do NOT use it to reject custom category ids.
 */
export type PartCategory = string

/**
 * Returns true if `v` is one of the 7 legacy default category ids.
 * Use ONLY when the legacy fallback path explicitly needs to check membership;
 * general code must accept any `PartCategory` string (which is now just `string`).
 * Do NOT use this guard to reject custom categories created via the catalog.
 */
export function isPartCategory(v: string): v is PartCategory {
  return (PART_CATEGORIES as readonly string[]).includes(v)
}

/**
 * LEGACY fallback — categories an asset holds at most ONE of: {psu, cooler, gpu}.
 * New code MUST use `isSingleSlotCategory` from `./partCategory-types` instead
 * (derived as `behavior !== 'sized'`; parity test enforces equivalence for all
 * 7 seed ids). This constant is kept only until Phase-2 converts all call sites.
 */
export const SINGLE_SLOT_CATS: ReadonlySet<string> = new Set<string>(['psu', 'cooler', 'gpu'])

/** Movement journal event types. Append-only; stock derives from these.
 *  'service' is a SKU-less, stock-neutral journal event (see deriveStock skip). */
export const MOVEMENT_TYPES = ['receive', 'install', 'uninstall', 'service'] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export function isMovementType(v: string): v is MovementType {
  return (MOVEMENT_TYPES as readonly string[]).includes(v)
}

/** A catalog SKU. Mirrors Firestore parts/{id}. */
export interface Part {
  id: string                       // e.g. 'sku_ram_16gb_ddr4', 'gpu_<slug>'
  name: string                     // Tier-4 EN-only free text
  category: PartCategory
  variantId?: string | null        // e.g. '16gb' (RAM/storage variants)
  variantLabel?: string | null     // e.g. '16 ГБ'
  ddr?: string | null              // RAM only: 'DDR3' | 'DDR4' | 'DDR5'
  unit: string                     // 'шт'
  onHand: number                   // DERIVED snapshot, recomputed every write
  broken: number                   // DERIVED snapshot, recomputed every write
  lowStockThreshold: number        // default 5 (3 for variant SKUs per prototype)
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/** One journal event. Mirrors Firestore part_movements/{id} — append-only. */
export interface PartMovement {
  id: string
  type: MovementType
  skuId: string
  qty: number                      // always positive
  broken: boolean                  // uninstall only; scrap when true (false otherwise)
  assetId: string | null           // internal asset slug (install/uninstall target)
  assetInvCode: string | null      // denormalised for journal display
  serviceReplace: boolean          // true → stock NOT debited (service device)
  note: string | null              // Tier-3
  reason: string | null            // human label (matches prototype 'reason' strings)
  kindId?: string | null           // service movements only: component-kind id being serviced
  kindLabel?: string | null        // service movements only: human label for the kind
  /** service movements only: display name of the person who performed the work.
   *  Separate from audit actorUid/actorRole — those track the admin who recorded
   *  the event; this is the field technician who actually carried out the service.
   *  Absent on non-service movements. */
  serviceActorName?: string
  /** Prototype-parity display hint ('move' rows in the journal). Not written by any
   *  current repository — toMovement() drops unknown fields, so this is always absent
   *  at runtime. Read defensively by parts history UI for future-proofing. */
  displayType?: 'move' | null
  /** Prototype-parity flag: install row represents a factory (pre-installed) part.
   *  Not written by any current repository. Read defensively by parts history UI. */
  factory?: boolean | null
  /** Replace-install only: denormalised spec of the OLD slot content that this
   *  install overwrote (e.g. 'SSD 128 ГБ'). Absent on plain installs/adds and
   *  when the overwritten slot was an empty factory slot. */
  replacedSpec?: string
  /** Replace-install only: storageType of the replaced slot ('SSD'|'HDD'|'M.2'), null for non-storage. */
  replacedStorageType?: string | null
  /** Replace-install only: index into upgradeCurrent that was overwritten. */
  replacedSlotIndex?: number
  /** Replace-install only: fate of the old part. 'kept' is a RECORD-ONLY note —
   *  warehouse stock is NOT credited (unlike a real uninstall). 'broken' likewise
   *  does not touch the broken counter; it selects the scrap wording/audit. */
  oldDisposal?: 'kept' | 'broken' | null
  actorUid: string
  actorRole: Role
  at: string                       // ISO timestamp
}

/** Derived stock view for a single SKU. */
export interface PartStock {
  onHand: number
  broken: number
}

/** One entry of the asset's live hardware snapshot. Mirrors prototype upgradeCurrent. */
export interface UpgradeSlot {
  kind: string                 // 'ram' | 'storage' | 'cooler' | 'psu' | 'battery'
  spec: string                 // '' = empty factory slot (still a real component)
  storageType?: string | null  // 'SSD' | 'HDD' | 'M.2' for storage slots
  installedAt?: string | null
  replaced?: boolean
}

/**
 * Legacy display-fallback for PartsAsset.kind on server-family devices.
 * UI prefers `categoryName` (from the categories collection); this label only
 * shows when category metadata is missing. Kept in domain (not infra) because
 * it is a user-visible string, not a storage concern.
 */
export const SERVER_FAMILY_KIND_LABEL = 'Сетевые устройства'

/** Read-model projection of an upgradeable asset (UPGRADEABLE_CATEGORIES). */
export interface PartsAsset {
  id: string            // invCode (display id, e.g. 'LAP/00035')
  assetId: string       // internal slug
  categoryId: string
  kind: string          // server family → SERVER_FAMILY_KIND_LABEL; else category name
  name: string          // brand + model
  user: string          // assignee display
  upgradeCurrent: UpgradeSlot[]
  /** Category display name from the categories collection (e.g. «Ноутбук»). */
  categoryName?: string
  /** Category lucide icon name from the categories collection (e.g. 'laptop'). */
  categoryIcon?: string
}
