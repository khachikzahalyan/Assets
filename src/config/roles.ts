/** The four AMS roles. Order is display order. Localized labels live in nav.json under `roles.*`. */
export const ROLE_IDS = ['super_admin', 'asset_admin', 'tech_admin', 'employee'] as const
export type Role = (typeof ROLE_IDS)[number]

export interface RoleMeta {
  id: Role
  short: string
  accent: 'indigo' | 'emerald' | 'sky' | 'slate'
}

export const ROLES: readonly RoleMeta[] = [
  { id: 'super_admin', short: 'СА', accent: 'indigo' },
  { id: 'asset_admin', short: 'АА', accent: 'emerald' },
  { id: 'tech_admin',  short: 'ТА', accent: 'sky' },
  { id: 'employee',    short: 'СО', accent: 'slate' },
]
