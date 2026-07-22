/**
 * Domain types for the dynamic parts-warehouse category catalog.
 * Mirrors Firestore part_categories/{id}.
 *
 * NO Firebase, NO React imports — pure domain layer.
 */

export const PART_CATEGORY_BEHAVIORS = ['single', 'sized', 'models'] as const
export type PartCategoryBehavior = (typeof PART_CATEGORY_BEHAVIORS)[number]

export function isPartCategoryBehavior(v: string): v is PartCategoryBehavior {
  return (PART_CATEGORY_BEHAVIORS as readonly string[]).includes(v)
}

export interface PartCategoryVariant {
  id: string    // '64gb' … '5tb' / '4gb' … '128gb' / 'ddr3' … 'ddr5'
  label: string // display label (locale-independent for MVP: '64 ГБ', 'DDR4', …)
  order: number
}

/** First-class parts-warehouse category. Mirrors Firestore part_categories/{id}. */
export interface PartCategoryDef {
  id: string
  /** Tier-2 multi-lang display name. */
  name: { ru: string; en: string; hy: string }
  /** Lucide icon name (e.g. 'plug', 'fan', 'hard-drive', 'memory-stick', 'circuit-board'). */
  icon: string
  /** Tint token name — class map stays code-side (e.g. 'amber'|'cyan'|'sky'|'emerald'|'violet'). */
  tintToken: string
  order: number
  /** Data-behavior class. IMMUTABLE after creation — immutability enforced by rules + UpdatePartCategoryInput omission. */
  behavior: PartCategoryBehavior
  /** UpgradeSlot.kind target (e.g. 'psu'|'cooler'|'storage'|'ram'|'gpu'). */
  slotKind: string
  /** Applies to sized storage categories only; null for non-storage. */
  storageType: 'SSD' | 'HDD' | 'M.2' | null
  /**
   * Forward-looking data mirror of code-side family remaps (e.g. psu→battery on laptops).
   * NOT consumed by Phase-2 call sites — seeded as future data.
   */
  familyOverrides: Record<string, { slotKind: string }> | null
  /** Capacity variants for 'sized' categories (ssd/hdd/nvme/ram); null for others. */
  variants: PartCategoryVariant[] | null
  /** DDR generation list for ram only; null for others. */
  generations: PartCategoryVariant[] | null
  active: boolean
  /** ISO timestamp string (adapter converts Firestore Timestamp → ISO string). */
  createdAt: string
  /** ISO timestamp string. */
  updatedAt: string
}

/* ── Derivation helpers ─────────────────────────────────────────────────────
   These are the CANONICAL behavior-dispatch predicates; legacy constants in
   types.ts (SINGLE_SLOT_CATS) are kept only as fallback until Phase-2 converts
   all call sites. New code MUST use these helpers.
   ────────────────────────────────────────────────────────────────────────── */

/** True if the category tracks individual capacity variants (ssd, hdd, nvme, ram). */
export const isSizedCategory = (d: Pick<PartCategoryDef, 'behavior'>): boolean =>
  d.behavior === 'sized'

/** True if the category tracks named model SKUs rather than variants (gpu). */
export const isModelsCategory = (d: Pick<PartCategoryDef, 'behavior'>): boolean =>
  d.behavior === 'models'

/**
 * True if an asset holds at most ONE of this category.
 *
 * IMPORTANT — this is NOT `behavior === 'single'`. The legacy `SINGLE_SLOT_CATS`
 * set is `{psu, cooler, gpu}` where gpu is behavior `'models'`.
 * The correct derivation is `behavior !== 'sized'`.
 * A parity test enforces the derived set equals the legacy set for all 7 seed ids.
 */
export const isSingleSlotCategory = (d: Pick<PartCategoryDef, 'behavior'>): boolean =>
  d.behavior !== 'sized'

/**
 * Rank of a variant within a category definition (ascending order).
 * Returns 999 for unknown variantId or when the category has no variants.
 * Mirrors the legacy `variantRank` fallback in partsTokens.ts.
 *
 * Accepts any object with a `variants` field (including `Omit<PartCategoryDef, 'createdAt'|'updatedAt'>`)
 * so seed/default arrays can be passed directly without stamping timestamps.
 */
export function variantRankOf(
  def: Pick<PartCategoryDef, 'variants'> | undefined,
  variantId: string | null | undefined,
): number {
  const variants = def?.variants
  if (!variants || !variantId) return 999
  const hit = variants.find(v => v.id === variantId)
  return hit !== undefined ? hit.order : 999
}
