import type { Category, CategoryGroup, CategoryListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateCategoryInput {
  name: string
  group: CategoryGroup
  hasSpecs: boolean
  lucideIcon?: string
}

export interface UpdateCategoryInput {
  name?: string
  group?: CategoryGroup
  hasSpecs?: boolean
  lucideIcon?: string
}

export interface CategoryRepository {
  listCategories(query?: CategoryListQuery): Promise<Category[]>
  getCategory(id: string): Promise<Category | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of assets with this categoryId. Gates delete. */
  countReferences(id: string): Promise<number>
  createCategory(input: CreateCategoryInput, actor: Actor): Promise<AuditedResult<Category>>
  updateCategory(id: string, patch: UpdateCategoryInput, actor: Actor): Promise<AuditedResult<Category>>
  deleteCategory(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
