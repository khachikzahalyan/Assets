/**
 * Shared design tokens for the Parts («Запчасти») feature — ported 1:1 from
 * the HTML prototype `Warehouse/prototypes/parts.html` so every parts component
 * renders with the same category / component colour system, icons, and labels.
 *
 * Tailwind classes are LITERAL strings (no `bg-${tone}-500/15` interpolation)
 * so the JIT compiler keeps them.
 */

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
export const PART_CATEGORY_META: PartCatMeta[] = [
  { id: 'psu', label: 'Блоки', icon: 'plug' },
  { id: 'cooler', label: 'Кулеры', icon: 'fan' },
  { id: 'ssd', label: 'SSD', icon: 'hard-drive' },
  { id: 'hdd', label: 'HDD', icon: 'hard-drive' },
  { id: 'nvme', label: 'M.2', icon: 'hard-drive' },
  { id: 'ram', label: 'ОЗУ', icon: 'memory-stick' },
  { id: 'gpu', label: 'Видеокарта', icon: 'circuit-board' },
]
export const PART_CAT_BY_ID: Record<string, PartCatMeta> = {
  ...Object.fromEntries(PART_CATEGORY_META.map(c => [c.id, c])),
  battery: { id: 'battery', label: 'Аккумулятор', icon: 'battery-medium' },
}

/* ── Per-category tint (icon plaque bg + text) ──────────────────────────── */
export interface Tint {
  iconBg: string
  iconText: string
}
export const TINT_FALLBACK: Tint = { iconBg: 'bg-surface-2', iconText: 'text-text-tertiary' }

export const CATEGORY_TINT: Record<string, Tint> = {
  psu: { iconBg: 'bg-amber-500/15', iconText: 'text-amber-300' },
  cooler: { iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-300' },
  ssd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  hdd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  nvme: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  ram: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300' },
  gpu: { iconBg: 'bg-violet-500/15', iconText: 'text-violet-300' },
  battery: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300' },
}
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
  psu: { iconBg: 'bg-amber-500/15', iconText: 'text-amber-300' },
  battery: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300' },
  cooler: { iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-300' },
  ram: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300' },
  ssd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  hdd: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  nvme: { iconBg: 'bg-sky-500/15', iconText: 'text-sky-300' },
  gpu: { iconBg: 'bg-violet-500/15', iconText: 'text-violet-300' },
}
export const installedRowVisual = (cat: string): { icon: string; tint: Tint } => ({
  icon: INSTALLED_ICON[cat] ?? PART_CAT_BY_ID[cat]?.icon ?? 'package',
  tint: INSTALLED_TINT[cat] ?? TINT_FALLBACK,
})

/* Canonical installed-row sort order: psu → battery → cooler → ram → storage → gpu */
export const COMPONENT_ORDER: Record<string, number> = {
  psu: 0, battery: 1, cooler: 2, ram: 3, ssd: 4, nvme: 4, hdd: 4, gpu: 5,
}
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
  desktop: { iconName: 'pc-case', iconBg: 'bg-blue-500/15', iconText: 'text-blue-300', accent: '#3B82F6' },
  laptop: { iconName: 'laptop', iconBg: 'bg-violet-500/15', iconText: 'text-violet-300', accent: '#8B5CF6' },
  server: { iconName: 'server', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300', accent: '#10B981' },
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
  emerald: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300', value: 'text-emerald-300' },
  amber: { iconBg: 'bg-amber-500/15', iconText: 'text-amber-300', value: 'text-amber-300' },
  rose: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300', value: 'text-rose-300' },
  violet: { iconBg: 'bg-violet-500/15', iconText: 'text-violet-300', value: 'text-violet-300' },
  blue: { iconBg: 'bg-blue-500/15', iconText: 'text-blue-300', value: 'text-blue-300' },
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

/* ── Russian pluralisation helper (компонент / компонента / компонентов) ── */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
