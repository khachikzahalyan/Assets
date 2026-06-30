export const CATEGORY_GROUPS = ['devices', 'network', 'furniture'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export function isCategoryGroup(v: string): v is CategoryGroup {
  return (CATEGORY_GROUPS as readonly string[]).includes(v)
}

export interface Category {
  id: string
  name: string
  group: CategoryGroup
  hasSpecs: boolean
  lucideIcon: string
  createdAt: string
  updatedAt: string
}

export interface CategoryListQuery {
  group?: CategoryGroup | 'all'
  search?: string
}
