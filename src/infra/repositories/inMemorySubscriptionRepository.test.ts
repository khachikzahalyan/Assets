import { describe, it, expect } from 'vitest'
import { InMemorySubscriptionRepository } from './inMemorySubscriptionRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Subscription } from '@/domain/subscription'

const ACTOR = { uid: 'u1', role: 'super_admin' as const }

function makeRepo(seed: Subscription[] = []) {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const repo = new InMemorySubscriptionRepository(ctx, seed)
  return { repo, store }
}

describe('InMemorySubscriptionRepository', () => {
  // ---- createSubscription ---------------------------------------------------

  describe('createSubscription', () => {
    it('returns the created subscription with correct fields', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createSubscription(
        { name: 'Microsoft 365', seatsTotal: 10, vendorEmail: 'vendor@ms.com' },
        ACTOR,
      )
      expect(value.name).toBe('Microsoft 365')
      expect(value.seatsTotal).toBe(10)
      expect(value.vendorEmail).toBe('vendor@ms.com')
      expect(value.assignedEmployeeIds).toEqual([])
    })

    it('seatsUsed is derived (assignedEmployeeIds.length), not stored', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createSubscription(
        { name: 'Slack', seatsTotal: 5, assignedEmployeeIds: ['emp1', 'emp2'] },
        ACTOR,
      )
      expect(value.assignedEmployeeIds).toHaveLength(2)
      expect((value as unknown as Record<string, unknown>).seatsUsed).toBeUndefined()
    })

    it('defaults assignedEmployeeIds to [] when not provided', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createSubscription(
        { name: 'Figma', seatsTotal: 3 },
        ACTOR,
      )
      expect(value.assignedEmployeeIds).toEqual([])
    })

    it('audit action is "subscription_created" and entityType is "subscription"', async () => {
      const { repo, store } = makeRepo()
      await repo.createSubscription({ name: 'Sub', seatsTotal: 1 }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('subscription_created')
      expect(log.entityType).toBe('subscription')
    })

    it('audit after contains assignedCount', async () => {
      const { repo, store } = makeRepo()
      await repo.createSubscription(
        { name: 'Sub', seatsTotal: 5, assignedEmployeeIds: ['e1', 'e2', 'e3'] },
        ACTOR,
      )
      const log = store.logs[store.logs.length - 1]!
      expect((log.after as Record<string, unknown>).assignedCount).toBe(3)
    })

    it('appends exactly one audit log per createSubscription call', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.createSubscription({ name: 'S', seatsTotal: 1 }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('persists purchaseDate and expiryDate', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createSubscription(
        {
          name: 'Adobe CC',
          seatsTotal: 2,
          purchaseDate: '2024-01-01T00:00:00.000Z',
          expiryDate: '2025-01-01T00:00:00.000Z',
        },
        ACTOR,
      )
      expect(value.purchaseDate).toBe('2024-01-01T00:00:00.000Z')
      expect(value.expiryDate).toBe('2025-01-01T00:00:00.000Z')
    })
  })

  // ---- updateAssignees ------------------------------------------------------

  describe('updateAssignees', () => {
    it('replaces the assignedEmployeeIds', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createSubscription(
        { name: 'Slack', seatsTotal: 5, assignedEmployeeIds: ['emp1'] },
        ACTOR,
      )
      const { value: updated } = await repo.updateAssignees(
        created.id,
        ['emp1', 'emp2', 'emp3'],
        ACTOR,
      )
      expect(updated.assignedEmployeeIds).toEqual(['emp1', 'emp2', 'emp3'])
    })

    it('can clear all assignees', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createSubscription(
        { name: 'Zoom', seatsTotal: 10, assignedEmployeeIds: ['emp1', 'emp2'] },
        ACTOR,
      )
      const { value: updated } = await repo.updateAssignees(created.id, [], ACTOR)
      expect(updated.assignedEmployeeIds).toEqual([])
    })

    it('audit action is "subscription_assignees_changed"', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createSubscription({ name: 'S', seatsTotal: 5 }, ACTOR)
      await repo.updateAssignees(value.id, ['e1'], ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('subscription_assignees_changed')
      expect(log.entityType).toBe('subscription')
    })

    it('audit before/after contain assignedCount', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createSubscription(
        { name: 'S', seatsTotal: 5, assignedEmployeeIds: ['e1', 'e2'] },
        ACTOR,
      )
      await repo.updateAssignees(value.id, ['e1', 'e2', 'e3'], ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect((log.before as Record<string, unknown>).assignedCount).toBe(2)
      expect((log.after as Record<string, unknown>).assignedCount).toBe(3)
    })

    it('appends exactly one audit log per updateAssignees call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createSubscription({ name: 'S', seatsTotal: 3 }, ACTOR)
      const before = store.logs.length
      await repo.updateAssignees(value.id, ['e1'], ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('throws when subscription not found', async () => {
      const { repo } = makeRepo()
      await expect(
        repo.updateAssignees('nonexistent', ['e1'], ACTOR),
      ).rejects.toThrow('not found')
    })
  })

  // ---- listSubscriptions ----------------------------------------------------

  describe('listSubscriptions', () => {
    it('returns all subscriptions when no filter', async () => {
      const { repo } = makeRepo()
      await repo.createSubscription({ name: 'A', seatsTotal: 1 }, ACTOR)
      await repo.createSubscription({ name: 'B', seatsTotal: 2 }, ACTOR)
      const list = await repo.listSubscriptions()
      expect(list).toHaveLength(2)
    })

    it('filters by search over name and vendorEmail', async () => {
      const { repo } = makeRepo()
      await repo.createSubscription(
        { name: 'Microsoft 365', seatsTotal: 10, vendorEmail: 'ms@example.com' },
        ACTOR,
      )
      await repo.createSubscription(
        { name: 'Slack Pro', seatsTotal: 5, vendorEmail: 'slack@example.com' },
        ACTOR,
      )
      const result = await repo.listSubscriptions({ search: 'slack' })
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('Slack Pro')
    })

    it('sorts by name ru-locale', async () => {
      const { repo } = makeRepo()
      await repo.createSubscription({ name: 'Б Подписка', seatsTotal: 1 }, ACTOR)
      await repo.createSubscription({ name: 'А Подписка', seatsTotal: 1 }, ACTOR)
      const list = await repo.listSubscriptions()
      expect(list[0]!.name).toBe('А Подписка')
      expect(list[1]!.name).toBe('Б Подписка')
    })

    it('returns empty array when no subscriptions exist', async () => {
      const { repo } = makeRepo()
      const list = await repo.listSubscriptions()
      expect(list).toHaveLength(0)
    })
  })

  // ---- getSubscription ------------------------------------------------------

  describe('getSubscription', () => {
    it('returns null for unknown id', async () => {
      const { repo } = makeRepo()
      expect(await repo.getSubscription('no-such-id')).toBeNull()
    })

    it('returns a cloned doc', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createSubscription(
        { name: 'Sub', seatsTotal: 5, assignedEmployeeIds: ['e1'] },
        ACTOR,
      )
      const fetched = await repo.getSubscription(value.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.name).toBe('Sub')
      expect(fetched!.assignedEmployeeIds).toEqual(['e1'])
    })
  })

  // ---- Seed -----------------------------------------------------------------

  describe('constructor seed', () => {
    it('seeds initial rows passed to constructor', async () => {
      const now = new Date().toISOString()
      const seeded: Subscription = {
        id: 'sub_seeded',
        name: 'Seeded Sub',
        vendorEmail: null,
        seatsTotal: 20,
        assignedEmployeeIds: [],
        purchaseDate: null,
        expiryDate: null,
        createdAt: now,
        updatedAt: now,
        createdBy: 'system',
        updatedBy: 'system',
      }
      const { repo } = makeRepo([seeded])
      const list = await repo.listSubscriptions()
      expect(list).toHaveLength(1)
      expect(list[0]!.name).toBe('Seeded Sub')
    })
  })

  // ---- listSubscriptionsForEmployee -----------------------------------------

  describe('listSubscriptionsForEmployee', () => {
    it('returns only subscriptions whose assignedEmployeeIds include the given id', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.createSubscription(
        { name: 'Figma', seatsTotal: 5, assignedEmployeeIds: ['emp_1', 'emp_2'] },
        ACTOR,
      )
      await repo.createSubscription(
        { name: 'Slack', seatsTotal: 10, assignedEmployeeIds: ['emp_2'] },
        ACTOR,
      )
      await repo.createSubscription(
        { name: 'Notion', seatsTotal: 3, assignedEmployeeIds: [] },
        ACTOR,
      )

      // Act
      const results = await repo.listSubscriptionsForEmployee('emp_1')

      // Assert
      expect(results).toHaveLength(1)
      expect(results[0]!.name).toBe('Figma')
    })

    it('returns empty array when no subscriptions contain the given employee id', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.createSubscription(
        { name: 'Jira', seatsTotal: 20, assignedEmployeeIds: ['emp_other'] },
        ACTOR,
      )

      // Act
      const results = await repo.listSubscriptionsForEmployee('emp_nobody')

      // Assert
      expect(results).toHaveLength(0)
    })

    it('returns subscriptions sorted by name (ru locale) when multiple match', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.createSubscription(
        { name: 'Zoom', seatsTotal: 5, assignedEmployeeIds: ['emp_1'] },
        ACTOR,
      )
      await repo.createSubscription(
        { name: 'Adobe CC', seatsTotal: 2, assignedEmployeeIds: ['emp_1'] },
        ACTOR,
      )
      await repo.createSubscription(
        { name: 'Microsoft 365', seatsTotal: 50, assignedEmployeeIds: ['emp_1'] },
        ACTOR,
      )

      // Act
      const results = await repo.listSubscriptionsForEmployee('emp_1')

      // Assert
      expect(results).toHaveLength(3)
      expect(results[0]!.name).toBe('Adobe CC')
      expect(results[1]!.name).toBe('Microsoft 365')
      expect(results[2]!.name).toBe('Zoom')
    })

    it('returns empty array when the repository has no subscriptions at all', async () => {
      // Arrange
      const { repo } = makeRepo()

      // Act
      const results = await repo.listSubscriptionsForEmployee('emp_1')

      // Assert
      expect(results).toHaveLength(0)
    })

    it('does not mutate the stored assignedEmployeeIds (returns clones)', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.createSubscription(
        { name: 'Slack', seatsTotal: 10, assignedEmployeeIds: ['emp_1'] },
        ACTOR,
      )

      // Act
      const results = await repo.listSubscriptionsForEmployee('emp_1')
      results[0]!.assignedEmployeeIds.push('mutated')

      // Assert — re-fetching returns the original, unmutated array
      const again = await repo.listSubscriptionsForEmployee('emp_1')
      expect(again[0]!.assignedEmployeeIds).toEqual(['emp_1'])
    })
  })

  // ---- Audit log counts -----------------------------------------------------

  describe('audit log counts', () => {
    it('create + updateAssignees each append exactly one log', async () => {
      const { repo, store } = makeRepo()
      expect(store.logs.length).toBe(0)

      const { value } = await repo.createSubscription({ name: 'S', seatsTotal: 5 }, ACTOR)
      expect(store.logs.length).toBe(1)

      await repo.updateAssignees(value.id, ['e1'], ACTOR)
      expect(store.logs.length).toBe(2)
    })
  })
})
