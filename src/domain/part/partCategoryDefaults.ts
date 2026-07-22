/**
 * Canonical default PartCategoryDef rows — single source of truth for BOTH:
 *   1. The idempotent seed (scripts/seed/referenceData.ts imports these).
 *   2. The runtime graceful fallback: if part_categories is empty/not yet seeded,
 *      adapters serve DEFAULT_PART_CATEGORY_DEFS so behavior is byte-for-byte
 *      identical to the old hardcoded 7-value union.
 *
 * The 7 ids (psu, cooler, ssd, hdd, nvme, ram, gpu) are STABLE — existing parts
 * docs, part_movements, and UpgradeSlot.kind values need zero migration.
 *
 * NO Firebase, NO React — pure domain layer.
 */

import type { PartCategoryDef, PartCategoryVariant } from './partCategory-types'

/* ── Storage capacity variants (ascending) ──────────────────────────────────
   Order reproduces STORAGE_VARIANT_ORDER from partsTokens.ts exactly.
   ────────────────────────────────────────────────────────────────────────── */
export const DEFAULT_STORAGE_VARIANTS: PartCategoryVariant[] = [
  { id: '64gb',  label: '64 ГБ',  order: 0 },
  { id: '128gb', label: '128 ГБ', order: 1 },
  { id: '256gb', label: '256 ГБ', order: 2 },
  { id: '512gb', label: '512 ГБ', order: 3 },
  { id: '1tb',   label: '1 ТБ',   order: 4 },
  { id: '2tb',   label: '2 ТБ',   order: 5 },
  { id: '3tb',   label: '3 ТБ',   order: 6 },
  { id: '4tb',   label: '4 ТБ',   order: 7 },
  { id: '5tb',   label: '5 ТБ',   order: 8 },
]

/* ── RAM capacity variants (ascending) ──────────────────────────────────────
   Order reproduces RAM_VARIANT_ORDER from partsTokens.ts exactly.
   ────────────────────────────────────────────────────────────────────────── */
export const DEFAULT_RAM_VARIANTS: PartCategoryVariant[] = [
  { id: '4gb',   label: '4 ГБ',   order: 0 },
  { id: '8gb',   label: '8 ГБ',   order: 1 },
  { id: '16gb',  label: '16 ГБ',  order: 2 },
  { id: '20gb',  label: '20 ГБ',  order: 3 },
  { id: '32gb',  label: '32 ГБ',  order: 4 },
  { id: '40gb',  label: '40 ГБ',  order: 5 },
  { id: '64gb',  label: '64 ГБ',  order: 6 },
  { id: '128gb', label: '128 ГБ', order: 7 },
]

/* ── DDR generations ─────────────────────────────────────────────────────── */
export const DEFAULT_DDR_GENERATIONS: PartCategoryVariant[] = [
  { id: 'ddr3', label: 'DDR3', order: 0 },
  { id: 'ddr4', label: 'DDR4', order: 1 },
  { id: 'ddr5', label: 'DDR5', order: 2 },
]

/**
 * The 7 canonical part-category definitions.
 *
 * Use `satisfies` so TypeScript validates the shape at authoring time without
 * widening to `PartCategoryDef[]` (timestamps are omitted; the writer adds them).
 *
 * tintToken and icon values match the current hardcoded CATEGORY_TINT /
 * PART_CATEGORY_META in partsTokens.ts so the runtime fallback renders identically.
 * ru names match current PART_CATEGORY_META labels; en/hy names added for Tier-2.
 */
export const DEFAULT_PART_CATEGORY_DEFS = [
  {
    id: 'psu',
    name: { ru: 'Блоки', en: 'Power supplies', hy: 'Սնուցման բլոկներ' },
    icon: 'plug',
    tintToken: 'amber',
    order: 0,
    behavior: 'single' as const,
    slotKind: 'psu',
    storageType: null,
    familyOverrides: { laptop: { slotKind: 'battery' } },
    variants: null,
    generations: null,
    active: true,
  },
  {
    id: 'cooler',
    name: { ru: 'Кулеры', en: 'Coolers', hy: 'Հովացուցիչներ' },
    icon: 'fan',
    tintToken: 'cyan',
    order: 1,
    behavior: 'single' as const,
    slotKind: 'cooler',
    storageType: null,
    familyOverrides: null,
    variants: null,
    generations: null,
    active: true,
  },
  {
    id: 'ssd',
    name: { ru: 'SSD', en: 'SSD', hy: 'SSD' },
    icon: 'hard-drive',
    tintToken: 'sky',
    order: 2,
    behavior: 'sized' as const,
    slotKind: 'storage',
    storageType: 'SSD' as const,
    familyOverrides: null,
    variants: DEFAULT_STORAGE_VARIANTS,
    generations: null,
    active: true,
  },
  {
    id: 'hdd',
    name: { ru: 'HDD', en: 'HDD', hy: 'HDD' },
    icon: 'hard-drive',
    tintToken: 'sky',
    order: 3,
    behavior: 'sized' as const,
    slotKind: 'storage',
    storageType: 'HDD' as const,
    familyOverrides: null,
    variants: DEFAULT_STORAGE_VARIANTS,
    generations: null,
    active: true,
  },
  {
    id: 'nvme',
    name: { ru: 'M.2', en: 'M.2', hy: 'M.2' },
    icon: 'hard-drive',
    tintToken: 'sky',
    order: 4,
    behavior: 'sized' as const,
    slotKind: 'storage',
    storageType: 'M.2' as const,
    familyOverrides: null,
    variants: DEFAULT_STORAGE_VARIANTS,
    generations: null,
    active: true,
  },
  {
    id: 'ram',
    name: { ru: 'ОЗУ', en: 'RAM', hy: 'Օպերատիվ հիշողություն' },
    icon: 'memory-stick',
    tintToken: 'emerald',
    order: 5,
    behavior: 'sized' as const,
    slotKind: 'ram',
    storageType: null,
    familyOverrides: null,
    variants: DEFAULT_RAM_VARIANTS,
    generations: DEFAULT_DDR_GENERATIONS,
    active: true,
  },
  {
    id: 'gpu',
    name: { ru: 'Видеокарта', en: 'GPU', hy: 'Վիդեոքարտ' },
    icon: 'circuit-board',
    tintToken: 'violet',
    order: 6,
    behavior: 'models' as const,
    slotKind: 'gpu',
    storageType: null,
    familyOverrides: null,
    variants: null,
    generations: null,
    active: true,
  },
] satisfies Omit<PartCategoryDef, 'createdAt' | 'updatedAt'>[]
