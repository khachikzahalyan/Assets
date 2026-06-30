import type { CategoryGroupBehavior } from './categoryGroup-types'

export interface Category {
  id: string
  name: string
  /** Inherited capability behavior class (drives `categoryCapabilities.ts`). */
  group: CategoryGroupBehavior
  /** FK to the parent CategoryGroup record (display grouping). */
  categoryGroupId: string
  hasSpecs: boolean
  lucideIcon: string
  createdAt: string
  updatedAt: string
}

export interface CategoryListQuery {
  group?: CategoryGroupBehavior | 'all'
  categoryGroupId?: string
  search?: string
}
