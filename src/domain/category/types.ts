import type { CategoryGroupBehavior } from './categoryGroup-types'

export interface Category {
  id: string
  name: string
  /** Inherited capability behavior class (drives `categoryCapabilities.ts`). */
  group: CategoryGroupBehavior
  /** FK to the parent CategoryGroup record (display grouping). */
  categoryGroupId: string
  hasSpecs: boolean
  /**
   * Admin override: asset-create form shows the «Лицензия ОС» (product key)
   * section for this category. undefined → fall back to the static taxonomy
   * (resolveCategoryCapabilities).
   */
  hasOemLicense?: boolean
  lucideIcon: string
  createdAt: string
  updatedAt: string
}

export interface CategoryListQuery {
  group?: CategoryGroupBehavior | 'all'
  categoryGroupId?: string
  search?: string
}
