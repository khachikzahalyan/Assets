import type { AssetAssignment, AssetSpecs } from '@/domain/asset'
import type { UpgradeSlot } from '@/domain/part/types'
import { LAPTOP_CATEGORY_IDS, SERVER_CATEGORY_IDS, categoryHasGpu } from '@/domain/asset/categoryCapabilities'

// ---------------------------------------------------------------------------
// Date / time helpers
// ---------------------------------------------------------------------------

const RU_MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

export function relativeTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime())
  const min   = Math.floor(diffMs / 60_000)
  const hr    = Math.floor(min  / 60)
  const day   = Math.floor(hr   / 24)
  const week  = Math.floor(day  / 7)
  const month = Math.floor(day  / 30)
  const year  = Math.floor(day  / 365)

  if (min   <  1) return 'только что'
  if (hr    <  1) return `${min} мин назад`
  if (day   <  1) return `${hr} ч назад`
  if (week  <  1) return `${day} дней назад`
  if (month <  1) return `${week} нед назад`
  if (year  <  1) return `${month} мес назад`
  return `${year} г назад`
}

export function fmtRuDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const monthName = RU_MONTHS_GENITIVE[d.getMonth()] ?? ''
  return `${d.getDate()} ${monthName} ${d.getFullYear()}`
}

// ---------------------------------------------------------------------------
// Plural helper
// ---------------------------------------------------------------------------

export function pluralRecords(n: number): string {
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod100 >= 11 && mod100 <= 14) return 'записей'
  if (mod10 === 1) return 'запись'
  if (mod10 >= 2 && mod10 <= 4) return 'записи'
  return 'записей'
}

// ---------------------------------------------------------------------------
// Tile accent palette
// ---------------------------------------------------------------------------

export interface TileAccentEntry { bg: string; text: string }

export const TILE_ACCENT: Record<string, TileAccentEntry> = {
  slate:   { bg: 'bg-surface-2',                    text: 'text-text-tertiary'  },
  indigo:  { bg: 'bg-[rgba(249,115,22,0.20)]',      text: 'text-accent'  },  // CPU → orange
  emerald: { bg: 'bg-emerald-500/15',               text: 'text-emerald-300'},
  amber:   { bg: 'bg-amber-500/15',                 text: 'text-amber-300'  },
  sky:     { bg: 'bg-sky-500/15',                   text: 'text-sky-300'    },
  rose:    { bg: 'bg-rose-500/15',                  text: 'text-rose-300'   },
  violet:  { bg: 'bg-violet-500/15',                text: 'text-violet-300' },
  cyan:    { bg: 'bg-cyan-500/15',                  text: 'text-cyan-300'   },
}

// ---------------------------------------------------------------------------
// History event tint palette
// ---------------------------------------------------------------------------

export interface HistoryTintEntry { bg: string; text: string }

export const HISTORY_TINT: Record<string, HistoryTintEntry> = {
  'pencil':           { bg: 'bg-[rgba(249,115,22,0.12)]', text: 'text-accent'  },
  'arrow-right-left': { bg: 'bg-accent/15',             text: 'text-accent-light'  },
  'memory-stick':     { bg: 'bg-[rgba(249,115,22,0.12)]', text: 'text-accent'  },
  'hard-drive':       { bg: 'bg-amber-500/15',             text: 'text-amber-300'  },
  'plug':             { bg: 'bg-sky-500/15',               text: 'text-sky-300'    },
  'fan':              { bg: 'bg-sky-500/15',               text: 'text-sky-300'    },
  'plus':             { bg: 'bg-emerald-500/15',           text: 'text-emerald-300'},
  'archive-x':        { bg: 'bg-rose-500/15',              text: 'text-rose-300'   },
  'hammer':           { bg: 'bg-amber-500/15',             text: 'text-amber-300'  },
  'wrench':           { bg: 'bg-[rgba(249,115,22,0.12)]', text: 'text-accent'  },
  'eye':              { bg: 'bg-surface-2',                text: 'text-text-tertiary'  },
  'inbox':            { bg: 'bg-sky-500/15',               text: 'text-sky-300'    },
  'map-pin':          { bg: 'bg-emerald-500/15',           text: 'text-emerald-300'},
  'clock':            { bg: 'bg-rose-500/15',              text: 'text-rose-300'   },
  'circle':           { bg: 'bg-surface-2',                text: 'text-text-tertiary'  },
  'check-circle':     { bg: 'bg-emerald-500/15',           text: 'text-emerald-300'},
}

const FALLBACK_TINT: HistoryTintEntry = { bg: 'bg-surface-2', text: 'text-text-tertiary' }
export function historyTint(icon: string): HistoryTintEntry {
  return HISTORY_TINT[icon] ?? FALLBACK_TINT
}

// ---------------------------------------------------------------------------
// History event VM type helpers
// ---------------------------------------------------------------------------

export interface ProtoHistoryEvent { icon?: string; action?: string; [key: string]: unknown }

export function isCreationEvent(ev: ProtoHistoryEvent): boolean {
  if (ev.kind === 'created') return true
  return ev.icon === 'plus' && ev.action === 'Создан в системе'
}

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------

export const AVATAR_PALETTE: string[] = [
  '#F97316', '#8B5CF6', '#10B981', '#3B82F6',
  '#F59E0B', '#EC4899', '#06B6D4', '#14B8A6',
]

export function avatarColor(id: string | null | undefined): string {
  if (!id) return AVATAR_PALETTE[0]!
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]![0] ?? '?').toUpperCase()
  return ((parts[0]![0] ?? '') + (parts[1]![0] ?? '')).toUpperCase() || '?'
}

// ---------------------------------------------------------------------------
// HistoryEventVM
// ---------------------------------------------------------------------------

export interface HistoryEventVM {
  id?: string
  date: string
  actor: string
  icon: string
  kind?: string
  action?: string
  slotLabel?: string
  before?: string
  after?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// describeAssignment
// ---------------------------------------------------------------------------

export interface AssignmentLabels {
  warehouse: string
  kindAudit: string
  kindIntern: string
  temporary: string
}

export function describeAssignment(
  assignment: AssetAssignment | null | undefined,
  resolvedNames: { employeeName?: string; branchName?: string; deptName?: string },
  labels: AssignmentLabels,
): string {
  if (!assignment) return labels.warehouse

  let base: string
  switch (assignment.mode) {
    case 'employee':
      base = resolvedNames.employeeName ?? '—'
      break
    case 'warehouse':
      base = labels.warehouse
      break
    case 'department':
      base = resolvedNames.deptName ?? '—'
      break
    case 'branch':
      base = resolvedNames.branchName ?? '—'
      break
    case 'temporary': {
      if (assignment.tempKind === 'audit') base = labels.kindAudit
      else if (assignment.tempKind === 'intern') base = labels.kindIntern
      else base = labels.warehouse
      break
    }
    default:
      base = '—'
  }

  if (assignment.isTemporary) {
    base += ` (${labels.temporary})`
  }

  return base
}

// ---------------------------------------------------------------------------
// Storage derivation helpers
// ---------------------------------------------------------------------------

/**
 * Capacity token regex — matches e.g. "512 ГБ", "512 гб", "1 ТБ", "1 тб", "2TB", "256GB".
 * /i only case-folds ASCII; lowercase Cyrillic variants are listed explicitly.
 */
const CAPACITY_RE = /(\d+(?:[.,]\d+)?)\s*(ТБ|тб|ГБ|гб|TB|GB)/i

/** Returns the normalised capacity string (TB/тб→ТБ, GB/гб→ГБ) or null if not found. */
export function extractStorageCapacity(raw: string): string | null {
  const m = CAPACITY_RE.exec(raw)
  if (!m) return null
  const num  = m[1]!
  const unit = m[2]!
  // Normalise to uppercase Cyrillic form
  const normUnit =
    unit === 'TB' || unit === 'тб' ? 'ТБ' :
    unit === 'GB' || unit === 'гб' ? 'ГБ' :
    unit.toUpperCase()
  return `${num} ${normUnit}`
}

/** Returns the detected storage type token or null. */
export function detectStorageType(raw: string): string | null {
  if (/NVMe/i.test(raw))            return 'NVMe'
  if (/M\.2/i.test(raw))            return 'M.2'
  if (/SSD/i.test(raw))             return 'SSD'
  if (/HDD/i.test(raw))             return 'HDD'
  if (/SATA/i.test(raw))            return 'SATA'
  if (/SAS/i.test(raw))             return 'SAS'
  return null
}

/**
 * Maps a storage type label to a badge accent key.
 * SSD/SATA → sky  |  NVMe/M.2 → violet  |  HDD/SAS → amber
 */
export function storageBadgeAccent(typeLabel: string): string {
  if (typeLabel === 'NVMe' || typeLabel === 'M.2') return 'violet'
  if (typeLabel === 'HDD'  || typeLabel === 'SAS')  return 'amber'
  return 'sky'
}

// ---------------------------------------------------------------------------
// Spec lines for TechSpecsCard
// ---------------------------------------------------------------------------

/** A single drive entry inside a multi-slot storage tile. */
export interface StorageSlot {
  badge?:      string
  badgeAccent?: string
  /** Compact display value (e.g. "256 ГБ"). */
  value:       string
  /** Full raw string for clipboard fidelity (e.g. "SSD 256 ГБ"). */
  rawValue?:   string
}

export interface SpecLine {
  /** i18n key to resolve the human-readable label (e.g. 'form.specCpu'). */
  labelKey:       string
  value:          string
  accent:         string
  icon:           string
  badge?:         string
  badgeAccent?:   string
  /**
   * Original unstripped spec string; present only when `value` is a derived
   * subset (e.g. extracted capacity). Used by copy-to-clipboard for full fidelity.
   */
  rawValue?:      string
  /**
   * Optional Tailwind class applied to the value <p> in SpecTile.
   * When absent, the tile defaults to text-text-primary.
   * Used to colour factory-status values (cooling/psu/battery) emerald.
   */
  valueClassName?: string
  /**
   * When present, the tile renders this list of drive entries instead of the
   * single badge+value layout. Used exclusively for storage tiles with 1+ drives.
   * Each entry has its own badge/accent/value triple.
   */
  slots?: StorageSlot[]
}

/**
 * Derives the asset family for the purpose of tech-spec tile rendering.
 *
 * Returns:
 *   - 'laptop'  — LAPTOP_CATEGORY_IDS (gets Battery tile instead of PSU; also Cooling)
 *   - 'server'  — SERVER_CATEGORY_IDS (gets Cooling + PSU tiles; label «Блоки питания»)
 *   - 'desktop' — COMPUTER_CATEGORY_IDS desktops/workstations/AIO/mini-PC (gets Cooling + PSU)
 *   - null      — not a computer-class category (monitors, peripherals, furniture, etc.)
 */
export function specTileFamily(categoryId: string | null | undefined): 'laptop' | 'server' | 'desktop' | null {
  if (!categoryId) return null
  if (LAPTOP_CATEGORY_IDS.has(categoryId)) return 'laptop'
  if (SERVER_CATEGORY_IDS.has(categoryId)) return 'server'
  // Desktop family: cat_computer, cat_desktop, cat_workstation, cat_mini_pc, cat_aio
  const DESKTOP_IDS = new Set([
    'cat_computer', 'cat_desktop', 'cat_workstation', 'cat_mini_pc', 'cat_aio',
  ])
  if (DESKTOP_IDS.has(categoryId)) return 'desktop'
  return null
}

export function buildSpecsLines(
  currentSpecs: AssetSpecs | null | undefined,
  categoryId?: string | null,
  upgradeCurrent?: ReadonlyArray<UpgradeSlot> | null,
): SpecLine[] {
  if (!currentSpecs) return []
  const lines: SpecLine[] = []
  if (currentSpecs.cpu) {
    lines.push({ labelKey: 'form.specCpu', value: currentSpecs.cpu, accent: 'indigo',  icon: 'cpu'           })
  }
  if (currentSpecs.gpu && categoryHasGpu(categoryId)) {
    lines.push({ labelKey: 'form.specGpu', value: currentSpecs.gpu, accent: 'violet',  icon: 'circuit-board' })
  }
  if (currentSpecs.ram) {
    lines.push({ labelKey: 'form.specRam', value: currentSpecs.ram, accent: 'emerald', icon: 'memory-stick'  })
  }
  if (currentSpecs.ssd) {
    // Split composite storage string (e.g. "SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ") into
    // individual slots. All slots are collected into ONE SpecLine to render as a single tile.
    const rawSlots = currentSpecs.ssd.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean)
    const storageSlots: StorageSlot[] = rawSlots.map(rawSlot => {
      const capacity  = extractStorageCapacity(rawSlot)
      const typeLabel = detectStorageType(rawSlot)
      const slot: StorageSlot = {
        value: capacity ?? rawSlot,
        ...(capacity !== null ? { rawValue: rawSlot } : {}),
      }
      if (typeLabel) {
        slot.badge       = typeLabel
        slot.badgeAccent = storageBadgeAccent(typeLabel)
      }
      return slot
    })
    // Use plural label when 2+ drives, singular when exactly 1.
    const storageLabelKey = storageSlots.length >= 2 ? 'form.specSsdPlural' : 'form.specSsd'
    // value = first slot's display value (for copy-text fallback on single slot);
    // for multi-slot the slots array is the source of truth.
    const firstSlot = storageSlots[0]!
    lines.push({
      labelKey:    storageLabelKey,
      value:       firstSlot.value,
      accent:      'sky',
      icon:        'hard-drive',
      ...(firstSlot.rawValue !== undefined ? { rawValue: firstSlot.rawValue } : {}),
      ...(firstSlot.badge    !== undefined ? { badge: firstSlot.badge, badgeAccent: firstSlot.badgeAccent } : {}),
      slots:       storageSlots,
    })
  }

  // Status-only tiles for computer-class families: Cooling → Battery (laptop) /
  // PSU (desktop/server). A factory part shows «Заводское/Заводская/Заводской»
  // green; once a part change marks the slot replaced, the tile flips to
  // «Заменено» amber — mirrors the Parts «Установлено» list (single source: the
  // asset's resolved upgradeCurrent). A replaced kind is one with replaced:true.
  const FACTORY_GREEN = 'text-emerald-300'
  const REPLACED_AMBER = 'text-amber-300'
  const replacedKinds = new Set(
    (upgradeCurrent ?? []).filter(s => s.replaced).map(s => s.kind),
  )
  const family = specTileFamily(categoryId)
  if (family !== null) {
    // ОХЛАЖДЕНИЕ — all computer-class families (laptop, desktop, server)
    const coolerReplaced = replacedKinds.has('cooler')
    lines.push({
      labelKey:       'detail.specs.cooling',
      value:          coolerReplaced ? 'Заменено' : 'Заводское',
      accent:         'cyan',
      icon:           'fan',
      valueClassName: coolerReplaced ? REPLACED_AMBER : FACTORY_GREEN,
    })

    if (family === 'laptop') {
      // БАТАРЕЯ/АККУМУЛЯТОР — laptops only (no PSU)
      const batteryReplaced = replacedKinds.has('battery')
      lines.push({
        labelKey:       'detail.specs.battery',
        value:          batteryReplaced ? 'Заменено' : 'Заводская',
        accent:         'rose',
        icon:           'battery-medium',
        valueClassName: batteryReplaced ? REPLACED_AMBER : FACTORY_GREEN,
      })
    } else {
      // БЛОКИ ПИТАНИЯ — desktop and server families
      const psuReplaced = replacedKinds.has('psu')
      lines.push({
        labelKey:       family === 'server' ? 'detail.specs.psuPlural' : 'detail.specs.psu',
        value:          psuReplaced ? 'Заменено' : 'Заводской',
        accent:         'amber',
        icon:           'plug',
        valueClassName: psuReplaced ? REPLACED_AMBER : FACTORY_GREEN,
      })
    }
  }

  return lines
}

/**
 * Builds the clipboard copy text for the given spec lines.
 * @param lines   - spec lines from buildSpecsLines
 * @param resolve - a function that resolves a labelKey to its display string
 *                  (pass `t` from useTranslation('assets') in the component)
 */
export function buildSpecsCopyText(
  lines: SpecLine[],
  resolve: (key: string) => string,
): string {
  return lines.map(l => {
    if (l.slots && l.slots.length > 0) {
      // Multi-slot storage: join all drives in one line: "Накопители: SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ"
      const driveParts = l.slots.map(s => s.rawValue ?? s.value)
      return `${resolve(l.labelKey)}: ${driveParts.join(' + ')}`
    }
    return `${resolve(l.labelKey)}: ${l.rawValue ?? l.value}`
  }).join('\n')
}
