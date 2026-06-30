import type { CategoryGroup, CategoryGroupBehavior } from './categoryGroup-types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateCategoryGroupInput {
  name: string
  behavior?: CategoryGroupBehavior
  lucideIcon?: string
  color?: string
  order?: number
}

export interface UpdateCategoryGroupInput {
  name?: string
  behavior?: CategoryGroupBehavior
  lucideIcon?: string
  color?: string
  order?: number
}

export interface CategoryGroupRepository {
  listCategoryGroups(): Promise<CategoryGroup[]>
  getCategoryGroup(id: string): Promise<CategoryGroup | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of categories whose `categoryGroupId` is this group. Gates delete. */
  countReferences(id: string): Promise<number>
  createCategoryGroup(input: CreateCategoryGroupInput, actor: Actor): Promise<AuditedResult<CategoryGroup>>
  updateCategoryGroup(id: string, patch: UpdateCategoryGroupInput, actor: Actor): Promise<AuditedResult<CategoryGroup>>
  deleteCategoryGroup(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
