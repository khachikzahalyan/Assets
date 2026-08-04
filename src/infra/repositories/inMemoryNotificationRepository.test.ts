import { describe, it, expect } from 'vitest'
import { InMemoryNotificationRepository } from './inMemoryNotificationRepository'
import type { AppNotification } from '@/domain/notification'

const N = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1', type: 'receipt_confirmed', audience: 'admins',
  createdAt: '2026-08-01T10:00:00.000Z', readBy: [],
  ...over,
})

describe('InMemoryNotificationRepository', () => {
  it('listRecent filters by audience and window, newest first', async () => {
    const repo = new InMemoryNotificationRepository([
      N({ id: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
      N({ id: 'adm', createdAt: '2026-08-02T00:00:00.000Z' }),
      N({ id: 'sup', audience: 'super_admin', type: 'role_activated', createdAt: '2026-08-03T00:00:00.000Z' }),
    ])
    const since = '2026-07-05T00:00:00.000Z'

    const adminsOnly = await repo.listRecent(['admins'], since)
    expect(adminsOnly.map(n => n.id)).toEqual(['adm'])

    const superView = await repo.listRecent(['admins', 'super_admin'], since)
    expect(superView.map(n => n.id)).toEqual(['sup', 'adm'])

    expect(await repo.listRecent([], since)).toEqual([])
  })

  it('markRead adds the uid once per doc', async () => {
    const repo = new InMemoryNotificationRepository([N({ id: 'a' }), N({ id: 'b', readBy: ['u1'] })])
    await repo.markRead(['a', 'b', 'missing'], 'u1')
    expect(repo.docs.find(d => d.id === 'a')!.readBy).toEqual(['u1'])
    expect(repo.docs.find(d => d.id === 'b')!.readBy).toEqual(['u1'])
  })

  it('createRoleActivated appends a super_admin-audience event', async () => {
    const repo = new InMemoryNotificationRepository([])
    await repo.createRoleActivated({ userUid: 'u9', userName: 'Анна', userEmail: 'a@x', roleId: 'employee' })
    expect(repo.docs).toHaveLength(1)
    expect(repo.docs[0]).toMatchObject({
      type: 'role_activated', audience: 'super_admin',
      userUid: 'u9', userName: 'Анна', roleId: 'employee', readBy: [],
    })
  })
})
