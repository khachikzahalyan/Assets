import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPartCategoryRepository,
  makeSeededPartCategoryRepository,
} from './inMemoryPartCategoryRepository'
import {
  DEFAULT_PART_CATEGORY_DEFS,
  DEFAULT_STORAGE_VARIANTS,
  DEFAULT_RAM_VARIANTS,
  DEFAULT_DDR_GENERATIONS,
} from '@/domain/part/partCategoryDefaults'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Actor } from '@/domain/asset'
import type { UpdatePartCategoryInput } from '@/domain/part/PartCategoryRepository'

const ACTOR: Actor = { uid: 'u1', role: 'super_admin', displayName: 'Super' }

// ── listAll ──────────────────────────────────────────────────────────────────

describe('InMemoryPartCategoryRepository.listAll', () => {
  it('returns seeded rows sorted by order', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    expect(all.map(d => d.id)).toEqual(['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'])
    for (let i = 1; i < all.length; i++) {
      expect(all[i]!.order).toBeGreaterThanOrEqual(all[i - 1]!.order)
    }
  })

  it('returns empty array when no defs are seeded', async () => {
    const repo = new InMemoryPartCategoryRepository()
    expect(await repo.listAll()).toEqual([])
  })

  it('includes inactive categories (management UI is caller-filtered)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryPartCategoryRepository([], inMemoryAuditContext(store))
    await repo.create(
      { id: 'test', name: { ru: 'Тест', en: 'Test', hy: 'Թեստ' }, icon: 'box', tintToken: 'gray',
        order: 0, behavior: 'single', slotKind: 'test' },
      ACTOR,
    )
    await repo.update('test', { active: false }, ACTOR)
    const all = await repo.listAll()
    expect(all.some(d => d.id === 'test' && !d.active)).toBe(true)
  })
})

// ── create ───────────────────────────────────────────────────────────────────

describe('InMemoryPartCategoryRepository.create', () => {
  let repo: InMemoryPartCategoryRepository
  let store: ReturnType<typeof createInMemoryAuditStore>

  beforeEach(() => {
    store = createInMemoryAuditStore()
    repo = new InMemoryPartCategoryRepository([], inMemoryAuditContext(store))
  })

  it('adds a new category and returns it', async () => {
    const { value } = await repo.create(
      { id: 'psu', name: { ru: 'Блоки', en: 'Power supplies', hy: 'Սնուցման բլոկներ' },
        icon: 'plug', tintToken: 'amber', order: 0, behavior: 'single', slotKind: 'psu' },
      ACTOR,
    )
    expect(value.id).toBe('psu')
    expect(value.active).toBe(true)
    expect(value.behavior).toBe('single')
    expect(value.storageType).toBeNull()
    expect(value.variants).toBeNull()
    expect(value.generations).toBeNull()
    expect(value.familyOverrides).toBeNull()
    expect(value.createdAt).toBeTruthy()
    expect(value.updatedAt).toBeTruthy()
  })

  it('writes a "created" audit log entry with entityType part_category', async () => {
    await repo.create(
      { id: 'cooler', name: { ru: 'Кулеры', en: 'Coolers', hy: 'Հովացուցիչներ' },
        icon: 'fan', tintToken: 'cyan', order: 1, behavior: 'single', slotKind: 'cooler' },
      ACTOR,
    )
    expect(store.logs).toHaveLength(1)
    const log = store.logs[0]!
    expect(log.entityType).toBe('part_category')
    expect(log.entityId).toBe('cooler')
    expect(log.action).toBe('created')
    expect(log.actorUid).toBe(ACTOR.uid)
    expect(log.actorRole).toBe(ACTOR.role)
    expect(log.before).toBeNull()
    expect(log.after).toMatchObject({ id: 'cooler' })
  })

  it('generates an id from the en name when id is absent', async () => {
    const { value } = await repo.create(
      { name: { ru: 'Тест', en: 'My Category', hy: 'Թ' },
        icon: 'box', tintToken: 'gray', order: 0, behavior: 'single', slotKind: 'test' },
      ACTOR,
    )
    expect(value.id).toBe('my-category')
  })

  it('rejects a duplicate id', async () => {
    const input = { id: 'psu', name: { ru: 'X', en: 'X', hy: 'X' },
      icon: 'plug', tintToken: 'amber', order: 0, behavior: 'single' as const, slotKind: 'psu' }
    await repo.create(input, ACTOR)
    await expect(repo.create(input, ACTOR)).rejects.toThrow('PartCategory already exists: psu')
  })

  it('accepts storageType and variants for sized categories', async () => {
    const { value } = await repo.create(
      { id: 'ssd', name: { ru: 'SSD', en: 'SSD', hy: 'SSD' },
        icon: 'hard-drive', tintToken: 'sky', order: 2, behavior: 'sized', slotKind: 'storage',
        storageType: 'SSD', variants: DEFAULT_STORAGE_VARIANTS, generations: null },
      ACTOR,
    )
    expect(value.storageType).toBe('SSD')
    expect(value.variants).toHaveLength(DEFAULT_STORAGE_VARIANTS.length)
  })

  it('returns the auditId from the created audit log entry', async () => {
    const { auditId } = await repo.create(
      { id: 'gpu', name: { ru: 'GPU', en: 'GPU', hy: 'GPU' },
        icon: 'circuit-board', tintToken: 'violet', order: 6, behavior: 'models', slotKind: 'gpu' },
      ACTOR,
    )
    expect(auditId).toBeTruthy()
    expect(store.logs.find(l => l.id === auditId)).toBeTruthy()
  })
})

// ── update ───────────────────────────────────────────────────────────────────

describe('InMemoryPartCategoryRepository.update', () => {
  let repo: InMemoryPartCategoryRepository
  let store: ReturnType<typeof createInMemoryAuditStore>

  beforeEach(async () => {
    store = createInMemoryAuditStore()
    repo = new InMemoryPartCategoryRepository([], inMemoryAuditContext(store))
    // Seed two categories
    await repo.create(
      { id: 'psu', name: { ru: 'Блоки', en: 'Power supplies', hy: 'Սնուցման բլոկներ' },
        icon: 'plug', tintToken: 'amber', order: 0, behavior: 'single', slotKind: 'psu' },
      ACTOR,
    )
    await repo.create(
      { id: 'ram', name: { ru: 'ОЗУ', en: 'RAM', hy: 'Օ' },
        icon: 'memory-stick', tintToken: 'emerald', order: 5, behavior: 'sized', slotKind: 'ram',
        variants: DEFAULT_RAM_VARIANTS, generations: DEFAULT_DDR_GENERATIONS },
      ACTOR,
    )
    // Clear audit log after seeding so we can assert on update entries only
    store.logs.length = 0
  })

  it('renames a category', async () => {
    const newName = { ru: 'Блоки питания', en: 'PSU', hy: 'ԲՊ' }
    const { value } = await repo.update('psu', { name: newName }, ACTOR)
    expect(value.name).toEqual(newName)
  })

  it('changes order', async () => {
    const { value } = await repo.update('psu', { order: 99 }, ACTOR)
    expect(value.order).toBe(99)
  })

  it('deactivates a category (active: false)', async () => {
    const { value } = await repo.update('psu', { active: false }, ACTOR)
    expect(value.active).toBe(false)
  })

  it('reactivates a category (active: true)', async () => {
    await repo.update('psu', { active: false }, ACTOR)
    store.logs.length = 0
    const { value } = await repo.update('psu', { active: true }, ACTOR)
    expect(value.active).toBe(true)
  })

  it('writes an "updated" audit log entry with entityType part_category', async () => {
    await repo.update('psu', { active: false }, ACTOR)
    expect(store.logs).toHaveLength(1)
    const log = store.logs[0]!
    expect(log.entityType).toBe('part_category')
    expect(log.entityId).toBe('psu')
    expect(log.action).toBe('updated')
    expect(log.actorUid).toBe(ACTOR.uid)
    // before snapshot captures active flip
    expect((log.before as Record<string, unknown>).active).toBe(true)
    expect((log.after as Record<string, unknown>).active).toBe(false)
  })

  it('update does NOT change behavior (behavior is immutable)', async () => {
    // The type-level guard means behavior is not in UpdatePartCategoryInput,
    // but we verify at runtime that even if we force-cast a patch with behavior,
    // the stored value is unchanged.
    const forcePatch = { active: true, behavior: 'models' } as unknown as UpdatePartCategoryInput
    const { value } = await repo.update('psu', forcePatch, ACTOR)
    // psu was created with behavior 'single' — must remain 'single'
    expect(value.behavior).toBe('single')
  })

  it('update preserves slotKind, storageType, familyOverrides (not in patch type)', async () => {
    const before = (await repo.listAll()).find(d => d.id === 'psu')!
    await repo.update('psu', { order: 10 }, ACTOR)
    const after = (await repo.listAll()).find(d => d.id === 'psu')!
    expect(after.slotKind).toBe(before.slotKind)
    expect(after.storageType).toBe(before.storageType)
    expect(after.familyOverrides).toEqual(before.familyOverrides)
  })

  it('update can clear variants by passing null', async () => {
    const { value } = await repo.update('ram', { variants: null }, ACTOR)
    expect(value.variants).toBeNull()
  })

  it('update can clear generations by passing null', async () => {
    const { value } = await repo.update('ram', { generations: null }, ACTOR)
    expect(value.generations).toBeNull()
  })

  it('update preserves variants when patch omits them', async () => {
    const { value } = await repo.update('ram', { order: 10 }, ACTOR)
    expect(value.variants).toHaveLength(DEFAULT_RAM_VARIANTS.length)
  })

  it('updates the updatedAt timestamp', async () => {
    const before = (await repo.listAll()).find(d => d.id === 'psu')!
    await repo.update('psu', { order: 1 }, ACTOR)
    const after = (await repo.listAll()).find(d => d.id === 'psu')!
    // updatedAt should be >= createdAt
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(before.createdAt).getTime())
  })

  it('throws when id not found', async () => {
    await expect(repo.update('nonexistent', { active: false }, ACTOR)).rejects.toThrow(
      'PartCategory not found: nonexistent',
    )
  })
})

// ── makeSeededPartCategoryRepository ─────────────────────────────────────────

describe('makeSeededPartCategoryRepository', () => {
  it('seeds all 7 DEFAULT_PART_CATEGORY_DEFS', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    expect(all).toHaveLength(DEFAULT_PART_CATEGORY_DEFS.length)
    expect(all.map(d => d.id)).toEqual(['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'])
  })

  it('seeds with the provided timestamp', async () => {
    const ts = '2025-06-01T12:00:00.000Z'
    const { repo } = makeSeededPartCategoryRepository(ts)
    const all = await repo.listAll()
    expect(all.every(d => d.createdAt === ts && d.updatedAt === ts)).toBe(true)
  })

  it('sized cats carry exact storage variant sets and orders', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    for (const id of ['ssd', 'hdd', 'nvme'] as const) {
      const def = all.find(d => d.id === id)!
      expect(def.variants).toHaveLength(DEFAULT_STORAGE_VARIANTS.length)
      expect(def.variants!.map(v => v.order)).toEqual(DEFAULT_STORAGE_VARIANTS.map(v => v.order))
      expect(def.variants!.map(v => v.id)).toEqual(DEFAULT_STORAGE_VARIANTS.map(v => v.id))
    }
  })

  it('ram carries 3 DDR generations', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    const ram = all.find(d => d.id === 'ram')!
    expect(ram.generations).toHaveLength(DEFAULT_DDR_GENERATIONS.length)
    expect(ram.generations!.map(g => g.id)).toEqual(['ddr3', 'ddr4', 'ddr5'])
  })

  it('gpu has behavior "models"', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    expect(all.find(d => d.id === 'gpu')!.behavior).toBe('models')
  })

  it('psu has familyOverrides.laptop.slotKind = "battery"', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    const psu = all.find(d => d.id === 'psu')!
    expect(psu.familyOverrides?.laptop?.slotKind).toBe('battery')
  })

  it('every row is active: true', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    const all = await repo.listAll()
    expect(all.every(d => d.active)).toBe(true)
  })
})
