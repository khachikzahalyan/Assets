import type {
  CategoryGroup, CategoryGroupRepository,
  CreateCategoryGroupInput, UpdateCategoryGroupInput,
} from '@/domain/category'
import type { Actor } from '@/domain/asset'
import { EntityInUseError } from '@/domain/shared'
import {
  withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext,
} from '@/lib/audit'
import { stripUndefined } from './inMemoryUtils'

interface CategoryGroupRefs {
  categories?: { categoryGroupId?: string }[]
}

export class InMemoryCategoryGroupRepository implements CategoryGroupRepository {
  constructor(
    private readonly groups: CategoryGroup[],
    private readonly refs: CategoryGroupRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listCategoryGroups(): Promise<CategoryGroup[]> {
    return [...this.groups].sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name, 'ru')
    })
  }

  async getCategoryGroup(id: string): Promise<CategoryGroup | null> {
    return this.groups.find(g => g.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.groups.some(g => g.name.trim().toLowerCase() === needle && g.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    return (this.refs.categories ?? []).filter(c => c.categoryGroupId === id).length
  }

  async createCategoryGroup(input: CreateCategoryGroupInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const now = new Date().toISOString()
    const id = `grp_${Math.random().toString(36).slice(2, 10)}`
    const group: CategoryGroup = {
      id,
      name: input.name.trim(),
      behavior: input.behavior ?? 'devices',
      lucideIcon: input.lucideIcon ?? 'package',
      color: input.color ?? 'gray',
      order: input.order ?? this.groups.length,
      createdAt: now,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: group.name } as Record<string, unknown>,
      },
      async () => { this.groups.push(group); return { value: group } },
    )
  }

  async updateCategoryGroup(id: string, patch: UpdateCategoryGroupInput, actor: Actor) {
    const idx = this.groups.findIndex(g => g.id === id)
    if (idx < 0) throw new Error(`CategoryGroup not found: ${id}`)
    const before = this.groups[idx]!

    if (patch.name !== undefined && await this.isNameTaken(patch.name, id)) {
      throw new Error(`Name already in use: ${patch.name}`)
    }

    const applied = stripUndefined(patch)
    const next: CategoryGroup = {
      ...before,
      ...applied,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedAt: new Date().toISOString(),
    }

    return withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.groups[idx] = next; return { value: next } },
    )
  }

  async deleteCategoryGroup(id: string, actor: Actor) {
    const idx = this.groups.findIndex(g => g.id === id)
    if (idx < 0) throw new Error(`CategoryGroup not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('categoryGroup', id, count)
    const removed = this.groups[idx]!
    return withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: removed.name } as Record<string, unknown>,
      },
      async () => { this.groups.splice(idx, 1); return { value: { id } } },
    )
  }
}
