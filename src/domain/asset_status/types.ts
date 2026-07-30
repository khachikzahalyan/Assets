export interface AssetStatus {
  id: string
  name: string
  color: string
  isFinal: boolean
  isSystem: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface AssetStatusListQuery { search?: string }

/** The canonical system statuses (incl. st_pending = «Ожидание»). */
export const SYSTEM_STATUS_IDS = ['st_warehouse', 'st_pending', 'st_assigned', 'st_repair', 'st_disposed'] as const

export function isSystemStatusId(v: string): boolean {
  return (SYSTEM_STATUS_IDS as readonly string[]).includes(v)
}
