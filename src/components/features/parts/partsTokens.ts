/**
 * Shared design tokens for the Parts («Запчасти») feature — ported 1:1 from
 * the HTML prototype `Warehouse/prototypes/parts.html` so every parts component
 * renders with the same category / component colour system, icons, and labels.
 *
 * Tailwind classes are LITERAL strings (no `bg-${tone}-500/15` interpolation)
 * so the JIT compiler keeps them.
 */

import type { Part } from '@/domain/part/types'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { variantRankOf } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'

/* ── Surface colours (prototype dark shell) ─────────────────────────────── */
export const SURFACE = {
  card: 'bg-surface',
  cardBorder: 'border-border',
  band: 'bg-surface-2',
  bandSoft: 'bg-surface-2/40',
  field: 'bg-bg',
  textPrimary: 'text-text-primary',
  textMuted: 'text-text-tertiary',
  textFaint: 'text-text-subtle',
  accent: '#F97316',
  accentLight: '#FB923C',
} as const

/* ── Warehouse category catalog (order matters — matches prototype) ──────── */
export interface PartCatMeta {
  id: string
  label: string
  icon: string
}

/* ── Per-category tint (icon plaque bg + text) ──────────────────────────── */
export interface Tint {
  iconBg: string
  iconText: string
}
export const TINT_FALLBACK: Tint = { iconBg: 'bg-surface-2', iconText: 'text-text-tertiary' }

/**
 * Code-side map from tintToken string → Tint.
 * Tailwind class strings MUST be literals so JIT keeps them.
 * Unknown tokens fall back to TINT_FALLBACK at call sites.
 */
export const TINT_BY_TOKEN: Record<string, Tint> = {
  amber:   { iconBg: 'bg-amber-500/15',   iconText: 'text-amber-300 light:text-amber-700' },
  cyan:    { iconBg: 'bg-cyan-500/15',    iconText: 'text-cyan-300 light:text-cyan-700' },
  sky:     { iconBg: 'bg-sky-500/15',     iconText: 'text-sky-300 light:text-sky-700' },
  emerald: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300 light:text-emerald-700' },
  violet:  { iconBg: 'bg-violet-500/15',  iconText: 'text-violet-300 light:text-violet-700' },
  rose:    { iconBg: 'bg-rose-500/15',    iconText: 'text-rose-300 light:text-rose-700' },
  blue:    { iconBg: 'bg-blue-500/15',    iconText: 'text-blue-300 light:text-blue-700' },
  orange:  { iconBg: 'bg-orange-500/15',  iconText: 'text-orange-300 light:text-orange-700' },
  slate:   { iconBg: 'bg-surface-2',      iconText: 'text-text-tertiary' },
}

/**
 * Build the display meta array from a live catalog.
 * Active only, sorted by `order` ascending.
 * `localizeName` is called at CALL SITES (components) — this function is locale-independent.
 */
export function buildPartCatMeta(
  defs: PartCategoryDef[],
  localizeName: (name: { ru: string; en: string; hy: string }) => string,
): PartCatMeta[] {
  return defs
    .filter(d => d.active)
    .sort((a, b) => a.order - b.order)
    .map(d => ({ id: d.id, label: localizeName(d.name), icon: d.icon }))
}

/**
 * Build a per-category-id tint lookup from a live catalog.
 * tintToken → TINT_BY_TOKEN lookup; unknown token → TINT_FALLBACK.
 * Battery stays code-side (not a category).
 */
export function buildCategoryTint(defs: PartCategoryDef[]): Record<string, Tint> {
  const out: Record<string, Tint> = {
    battery: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300 light:text-rose-700' },
  }
  for (const d of defs) {
    out[d.id] = TINT_BY_TOKEN[d.tintToken] ?? TINT_FALLBACK
  }
  return out
}

/**
 * Build the installed-row sort order from a live catalog.
 * Reproduces today's COMPONENT_ORDER for the 7 default ids.
 * Battery injected code-side (rank 1, between psu and cooler).
 * Custom categories land at rank = def.order + 2 (after gpu at 5).
 */
export function buildComponentOrder(defs: PartCategoryDef[]): Record<string, number> {
  const out: Record<string, number> = { battery: 1 }
  // Rank each def: storage defs (slotKind === 'storage') share rank 4.
  // Other defs use a fixed mapping by slotKind, then fall through to def.order + 2.
  const SLOT_RANK: Record<string, number> = {
    psu: 0, cooler: 2, ram: 3, storage: 4, gpu: 5,
  }
  for (const d of defs) {
    const slotRank = SLOT_RANK[d.slotKind]
    out[d.id] = slotRank !== undefined ? slotRank : d.order + 2
  }
  return out
}

/**
 * Rank a SKU within its category by capacity (ascending) using a live PartCategoryDef.
 * Falls back to 999 when def is undefined.
 */
export function variantRankDef(
  def: PartCategoryDef | undefined,
  variantId: string | null | undefined,
): number {
  if (def) return variantRankOf(def, variantId)
  return 999
}

/**
 * Group parts by category using a live catalog (active defs only, sorted by order).
 * Falls back to PART_CATEGORY_META order when defs is empty.
 */
export function groupSkusByCategoryDef(
  parts: Part[],
  defs: PartCategoryDef[],
): Record<string, Part[]> {
  const activeDefs = defs.filter(d => d.active).sort((a, b) => a.order - b.order)
  const catIds = activeDefs.length > 0
    ? activeDefs.map(d => d.id)
    : PART_CATEGORY_META.map(c => c.id)
  const map: Record<string, Part[]> = {}
  for (const id of catIds) { map[id] = [] }
  for (const p of parts) {
    if (!map[p.category]) map[p.category] = []
    map[p.category]!.push(p)
  }
  return map
}

/**
 * @deprecated Legacy fallback — derived data lives in part_categories Firestore.
 * Re-derived from DEFAULT_PART_CATEGORY_DEFS so there is ONE hand-written copy of the data.
 */
export const PART_CATEGORY_META: PartCatMeta[] = buildPartCatMeta(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
  (name) => name.ru,
)

/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 * Battery is injected code-side (not a part category).
 */
export const PART_CAT_BY_ID: Record<string, PartCatMeta> = {
  ...Object.fromEntries(PART_CATEGORY_META.map(c => [c.id, c])),
  battery: { id: 'battery', label: 'Аккумулятор', icon: 'battery-medium' },
}

/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 */
export const CATEGORY_TINT: Record<string, Tint> = buildCategoryTint(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)

export const categoryTint = (cat: string): Tint => CATEGORY_TINT[cat] ?? TINT_FALLBACK
export const categoryIcon = (cat: string): string => PART_CAT_BY_ID[cat]?.icon ?? 'package'

/* ── Installed-component visuals (mirrors asset-detail tech tiles) ───────── */
export const INSTALLED_ICON: Record<string, string> = {
  psu: 'plug',
  battery: 'battery-medium',
  cooler: 'fan',
  ram: 'memory-stick',
  ssd: 'hard-drive',
  hdd: 'hard-drive',
  nvme: 'hard-drive',
  gpu: 'circuit-board',
}
export const INSTALLED_TINT: Record<string, Tint> = {
  psu: { iconBg: 'bg-amber-500/15', iconText: 'text-amber-300 light:text-amber-700' },
  battery: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300 light:text-rose-700' },
  cooler: { iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-300 light:text-cyan-700' },
  ram: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300 light:text-emerald-700' },
  ssd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300 light:text-sky-700' },
  hdd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300 light:text-sky-700' },
  nvme: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300 light:text-sky-700' },
  gpu: { iconBg: 'bg-violet-500/15', iconText: 'text-violet-300 light:text-violet-700' },
}
export const installedRowVisual = (cat: string): { icon: string; tint: Tint } => ({
  icon: INSTALLED_ICON[cat] ?? PART_CAT_BY_ID[cat]?.icon ?? 'package',
  tint: INSTALLED_TINT[cat] ?? TINT_FALLBACK,
})

/* ── Canonical variant order (ascending capacity) ───────────────────────── */
export const STORAGE_VARIANT_ORDER = ['64gb', '128gb', '256gb', '512gb', '1tb', '2tb', '3tb', '4tb', '5tb']
export const RAM_VARIANT_ORDER = ['4gb', '8gb', '16gb', '20gb', '32gb', '40gb', '64gb', '128gb']
/** Rank a SKU within its category by capacity (ascending). Unknown → last. */
export function variantRank(categoryId: string, variantId: string | null | undefined): number {
  const order = categoryId === 'ram' ? RAM_VARIANT_ORDER : STORAGE_VARIANT_ORDER
  const i = variantId ? order.indexOf(variantId) : -1
  return i === -1 ? 999 : i
}

/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 */
export const COMPONENT_ORDER: Record<string, number> = buildComponentOrder(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)

export const componentRank = (cat: string | undefined): number =>
  cat != null && COMPONENT_ORDER[cat] != null ? COMPONENT_ORDER[cat] : 99

/* ── Device family chip (Devices tab cards) ─────────────────────────────── */
export interface FamilyChip {
  iconName: string
  iconBg: string
  iconText: string
  accent: string
}
export const FAMILY_CHIP: Record<string, FamilyChip> = {
  desktop: { iconName: 'pc-case', iconBg: 'bg-blue-500/15', iconText: 'text-blue-300 light:text-blue-700', accent: '#3B82F6' },
  laptop: { iconName: 'laptop', iconBg: 'bg-violet-500/15', iconText: 'text-violet-300 light:text-violet-700', accent: '#8B5CF6' },
  server: { iconName: 'server', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300 light:text-emerald-700', accent: '#10B981' },
}
export const FAMILY_CHIP_FALLBACK: FamilyChip = {
  iconName: 'cpu', iconBg: 'bg-surface-2', iconText: 'text-text-tertiary', accent: '#F97316',
}
export const familyChip = (family: string): FamilyChip => FAMILY_CHIP[family] ?? FAMILY_CHIP_FALLBACK

/* ── Stat-tile tones (page header metric cards) ─────────────────────────── */
export interface StatTone {
  iconBg: string
  iconText: string
  value: string
}
export const STAT_TONES: Record<string, StatTone> = {
  emerald: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300 light:text-emerald-700', value: 'text-emerald-300 light:text-emerald-700' },
  amber: { iconBg: 'bg-amber-500/15', iconText: 'text-amber-300 light:text-amber-700', value: 'text-amber-300 light:text-amber-700' },
  rose: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300 light:text-rose-700', value: 'text-rose-300 light:text-rose-700' },
  violet: { iconBg: 'bg-violet-500/15', iconText: 'text-violet-300 light:text-violet-700', value: 'text-violet-300 light:text-violet-700' },
  blue: { iconBg: 'bg-blue-500/15', iconText: 'text-blue-300 light:text-blue-700', value: 'text-blue-300 light:text-blue-700' },
  slate: { iconBg: 'bg-surface-2', iconText: 'text-text-tertiary', value: 'text-text-primary' },
}

/* ── Date format — fixed DD/Mon/YYYY (e.g. 12/Dec/2025), locale-independent ─ */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtPartsDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  return `${dd}/${MON[d.getMonth()]}/${d.getFullYear()}`
}

/**
 * True when an install movement REPLACED an existing part (vs added alongside).
 * Derived from the movement `reason` — a fixed domain constant the install txn
 * writes ('Установка в актив' for add, '…взамен…' / 'Заменено через сервис' for
 * replace). Works for both new and pre-existing movements with no schema change,
 * so the history label can show «Заменено» only on real replacements.
 */
export function isReplacementInstall(reason: string | null | undefined): boolean {
  return /взамен|через сервис/i.test(reason ?? '')
}

/* ── SKU grouping helper (shared by WarehouseTab + PartsPage) ────────────── */
/** @deprecated Use groupSkusByCategoryDef with live catalog. */
export function groupSkusByCategory(parts: Part[]): Record<string, Part[]> {
  return groupSkusByCategoryDef(parts, DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
}

/* ── Russian pluralisation helper (компонент / компонента / компонентов) ── */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
