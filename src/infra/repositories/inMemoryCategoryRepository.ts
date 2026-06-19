import type {
  Category, CategoryListQuery, CategoryRepository,
  CreateCategoryInput, UpdateCategoryInput,
} from '@/domain/category'
import type { Actor } from '@/domain/asset'
import { EntityInUseError, PrefixLockedError } from '@/domain/shared'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

interface CategoryRefs {
  assets?: { categoryId?: string }[]
}

export class InMemoryCategoryRepository implements CategoryRepository {
  constructor(
    private readonly categories: Category[],
    private readonly refs: CategoryRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listCategories(query: CategoryListQuery = {}): Promise<Category[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.categories.filter(c => {
      if (query.group && query.group !== 'all' && c.group !== query.group) return false
      if (search) {
        const hay = [c.name, c.prefix].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async getCategory(id: string): Promise<Category | null> {
    return this.categories.find(c => c.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.categories.some(c => c.name.trim().toLowerCase() === needle && c.id !== exceptId)
  }

  async isPrefixTaken(prefix: string, exceptId?: string): Promise<boolean> {
    const needle = prefix.trim()
    return this.categories.some(c => c.prefix.trim() === needle && c.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    return (this.refs.assets ?? []).filter(x => x.categoryId === id).length
  }

  async createCategory(input: CreateCategoryInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    if (await this.isPrefixTaken(input.prefix)) throw new Error(`Prefix already in use: ${input.prefix}`)
    const now = new Date().toISOString()
    const id = `cat_${Math.random().toString(36).slice(2, 10)}`
    const category: Category = {
      id,
      name: input.name.trim(),
      group: input.group,
      prefix: input.prefix.trim(),
      hasSpecs: input.hasSpecs,
      lucideIcon: input.lucideIcon ?? 'package',
      createdAt: now,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'category', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: category.name, prefix: category.prefix } as Record<string, unknown>,
      },
      async () => { this.categories.push(category); return { value: category } },
    )
  }

  async updateCategory(id: string, patch: UpdateCategoryInput, actor: Actor) {
    const idx = this.categories.findIndex(c => c.id === id)
    if (idx < 0) throw new Error(`Category not found: ${id}`)
    const before = this.categories[idx]!

    // PREFIX-LOCK: check BEFORE entering withAudit so no audit row is written on failure
    if (patch.prefix !== undefined && patch.prefix.trim() !== before.prefix) {
      const count = await this.countReferences(id)
      if (count > 0) throw new PrefixLockedError(id, count)
    }

    // Re-check name uniqueness if name is changing
    if (patch.name !== undefined && await this.isNameTaken(patch.name, id)) {
      throw new Error(`Name already in use: ${patch.name}`)
    }
    // Re-check prefix uniqueness if prefix is changing (and not locked — already confirmed above)
    if (patch.prefix !== undefined && patch.prefix.trim() !== before.prefix && await this.isPrefixTaken(patch.prefix, id)) {
      throw new Error(`Prefix already in use: ${patch.prefix}`)
    }

    const applied = stripUndefined(patch)
    const next: Category = {
      ...before,
      ...applied,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.prefix !== undefined ? { prefix: patch.prefix.trim() } : {}),
      updatedAt: new Date().toISOString(),
    }

    return withAudit(this.audit,
      {
        entityType: 'category', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, prefix: before.prefix } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.categories[idx] = next; return { value: next } },
    )
  }

  async deleteCategory(id: string, actor: Actor) {
    const idx = this.categories.findIndex(c => c.id === id)
    if (idx < 0) throw new Error(`Category not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('category', id, count)
    const removed = this.categories[idx]!
    return withAudit(this.audit,
      {
        entityType: 'category', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: removed.name } as Record<string, unknown>,
      },
      async () => { this.categories.splice(idx, 1); return { value: { id } } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
