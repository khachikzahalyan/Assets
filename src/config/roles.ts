/** The four AMS roles. Order is display order. Localized labels live in nav.json under `roles.*`. */
export const ROLE_IDS = ['super_admin', 'asset_admin', 'tech_admin', 'employee'] as const
export type Role = (typeof ROLE_IDS)[number]

export interface RoleMeta {
  id: Role
  short: string
  accent: 'indigo' | 'emerald' | 'sky' | 'slate'
  /** Per-role icon (lucide name registered in components/ui/icon.tsx). */
  icon: string
}

export const ROLES: readonly RoleMeta[] = [
  { id: 'super_admin', short: 'СА', accent: 'indigo',  icon: 'crown'         },
  { id: 'asset_admin', short: 'АА', accent: 'emerald', icon: 'shield'        },
  { id: 'tech_admin',  short: 'ТА', accent: 'sky',     icon: 'circuit-board' },
  { id: 'employee',    short: 'СО', accent: 'slate',   icon: 'user-check'    },
]

/** Returns the lucide icon name registered for the given role, or 'user' as fallback. */
export function roleIcon(role: Role | null | undefined): string {
  return ROLES.find(r => r.id === role)?.icon ?? 'user'
}
