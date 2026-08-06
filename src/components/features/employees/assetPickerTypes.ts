// ── Types and constants shared by AssetPickerSheet and its sub-components ─────

export interface PickerStockRow {
  id: string
  categoryId: string
  title: string
  invCode: string
  cat: string
  icon: string
  group: string
}

export interface AssetPickerSheetProps {
  open: boolean
  emp: {
    id: string
    firstName: string
    lastName: string
    position: string | null
    departmentName: string | null
    branchName: string | null
  } | null
  stock: PickerStockRow[]
  onConfirm: (assetIds: string[]) => void
  onClose: () => void
}

// ── Asset groups config ───────────────────────────────────────────────────────

export const ASSET_GROUPS = [
  { id: 'devices', label: 'Устройства', icon: 'laptop', tone: 'indigo' },
  { id: 'network', label: 'Сетевые устройства', icon: 'router', tone: 'sky' },
  { id: 'furniture', label: 'Мебель', icon: 'armchair', tone: 'emerald' },
] as const

export type GroupToneKey = 'indigo' | 'sky' | 'emerald'

export const ASSET_GROUP_BY_ID = Object.fromEntries(ASSET_GROUPS.map((g) => [g.id, g]))

export const ASSET_GROUP_TONES: Record<
  GroupToneKey,
  { tile: string; border: string; hoverBorder: string; hoverBg: string }
> = {
  indigo: {
    tile: 'bg-accent/10 text-accent',
    border: 'border-accent',
    hoverBorder: 'hover:border-accent',
    hoverBg: 'hover:bg-accent/10',
  },
  sky: {
    tile: 'bg-sky-500/10 text-sky-300 light:text-sky-700',
    border: 'border-sky-500/30',
    hoverBorder: 'hover:border-sky-500/40',
    hoverBg: 'hover:bg-sky-500/10',
  },
  emerald: {
    tile: 'bg-emerald-500/10 text-emerald-300 light:text-emerald-700',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/40',
    hoverBg: 'hover:bg-emerald-500/10',
  },
}

export type StepKind = 'group' | 'category' | 'items' | 'review'
