import type { Role } from '@/config/roles'

/** Replaceable-component SKU categories tracked by the parts warehouse. */
export const PART_CATEGORIES = ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'] as const
export type PartCategory = (typeof PART_CATEGORIES)[number]

export function isPartCategory(v: string): v is PartCategory {
  return (PART_CATEGORIES as readonly string[]).includes(v)
}

/** Categories an asset can hold at most ONE of (non-server). */
export const SINGLE_SLOT_CATS: ReadonlySet<PartCategory> = new Set<PartCategory>(['psu', 'cooler', 'gpu'])

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

/** Read-model projection of an upgradeable asset (UPGRADEABLE_CATEGORIES). */
export interface PartsAsset {
  id: string            // invCode (display id, e.g. 'LAP/00035')
  assetId: string       // internal slug
  categoryId: string
  kind: string          // server family → 'Сетевые Устройство'; else category name
  name: string          // brand + model
  user: string          // assignee display
  upgradeCurrent: UpgradeSlot[]
}
