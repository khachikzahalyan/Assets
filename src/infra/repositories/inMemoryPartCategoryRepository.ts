import type { Actor } from '@/domain/asset'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import type {
  PartCategoryRepository,
  CreatePartCategoryInput,
  UpdatePartCategoryInput,
} from '@/domain/part/PartCategoryRepository'
import {
  withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext,
  type InMemoryAuditStore,
} from '@/lib/audit'
import { stripUndefined } from './inMemoryUtils'
import {
  DEFAULT_PART_CATEGORY_DEFS,
} from '@/domain/part/partCategoryDefaults'

/** slug-safe id fragment: lower-case, spaces+special → dash, max 40 chars. */
function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яёА-ЯЁ]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export class InMemoryPartCategoryRepository implements PartCategoryRepository {
  private readonly defs: PartCategoryDef[]

  constructor(
    initial: PartCategoryDef[] = [],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {
    this.defs = [...initial]
  }

  async listAll(): Promise<PartCategoryDef[]> {
    return [...this.defs].sort((a, b) => a.order - b.order)
  }

  async create(input: CreatePartCategoryInput, actor: Actor) {
    const id = input.id ?? makeSlug(input.name.en || input.name.ru)
    if (!id) throw new Error('PartCategory id could not be derived from input name')

    if (this.defs.some(d => d.id === id)) throw new Error(`PartCategory already exists: ${id}`)

    const now = new Date().toISOString()
    const def: PartCategoryDef = {
      id,
      name: input.name,
      icon: input.icon,
      tintToken: input.tintToken,
      order: input.order,
      behavior: input.behavior,
      slotKind: input.slotKind,
      storageType: input.storageType ?? null,
      familyOverrides: null,
      variants: input.variants ?? null,
      generations: input.generations ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    return withAudit(this.audit,
      {
        entityType: 'part_category', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: null,
        after: { id, name: input.name } as Record<string, unknown>,
      },
      async () => { this.defs.push(def); return { value: def } },
    )
  }

  async update(id: string, patch: UpdatePartCategoryInput, actor: Actor) {
    const idx = this.defs.findIndex(d => d.id === id)
    if (idx < 0) throw new Error(`PartCategory not found: ${id}`)
    const before = this.defs[idx]!

    const applied = stripUndefined(patch)
    const next: PartCategoryDef = {
      ...before,
      ...applied,
      // behavior is immutable — always preserved from current doc.
      behavior: before.behavior,
      // variants/generations: null is a valid patch value (clears the list);
      // undefined means "leave as-is".
      variants: patch.variants !== undefined
        ? (patch.variants ?? null)
        : before.variants,
      generations: patch.generations !== undefined
        ? (patch.generations ?? null)
        : before.generations,
      updatedAt: new Date().toISOString(),
    }

    return withAudit(this.audit,
      {
        entityType: 'part_category', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { name: before.name, active: before.active, order: before.order } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.defs[idx] = next; return { value: next } },
    )
  }
}

/**
 * Convenience factory that seeds DEFAULT_PART_CATEGORY_DEFS with a fixed ISO
 * timestamp so tests get deterministic, non-empty starting state.
 *
 * Returns both the repository and the raw audit store so callers can inspect
 * audit rows without an extra abstraction layer.
 */
export function makeSeededPartCategoryRepository(nowIso = '2026-01-01T00:00:00.000Z'): {
  repo: InMemoryPartCategoryRepository
  store: InMemoryAuditStore
} {
  const store = createInMemoryAuditStore()
  const defs: PartCategoryDef[] = DEFAULT_PART_CATEGORY_DEFS.map(d => ({
    ...d,
    createdAt: nowIso,
    updatedAt: nowIso,
  }))
  return {
    repo: new InMemoryPartCategoryRepository(defs, inMemoryAuditContext(store)),
    store,
  }
}
