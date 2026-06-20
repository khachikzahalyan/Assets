import { describe, it, expect } from 'vitest'
import { InMemoryAuthSettingsRepository } from './inMemoryAuthSettingsRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const actor = { uid: 'u_super', role: 'super_admin' as const }

describe('InMemoryAuthSettingsRepository', () => {
  it('get returns fail-closed default when no doc', async () => {
    const repo = new InMemoryAuthSettingsRepository()
    expect((await repo.getAuthSettings()).allowedEmailDomains).toEqual([])
  })
  it('update normalizes + dedupes + writes one audit row', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: [] }, inMemoryAuditContext(store))
    const r = await repo.updateAllowedDomains(['  @A.com', 'a.com', 'B.io'], actor)
    expect(r.value.allowedEmailDomains).toEqual(['a.com', 'b.io'])
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityType: 'settings', action: 'updated' })
  })
  it('merge preserves untouched fields', async () => {
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['x.com'], emailLinkActionUrl: 'https://app/finish' })
    const r = await repo.updateAllowedDomains(['y.com'], actor)
    expect(r.value.emailLinkActionUrl).toBe('https://app/finish')
    expect(r.value.allowedEmailDomains).toEqual(['y.com'])
  })
  it('allows empty list (fail-closed save)', async () => {
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['z.com'] })
    const r = await repo.updateAllowedDomains([], actor)
    expect(r.value.allowedEmailDomains).toEqual([])
  })
  it('audit before/after carry the domain lists', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['old.com'] }, inMemoryAuditContext(store))
    await repo.updateAllowedDomains(['new.com'], actor)
    expect(store.logs[0]).toMatchObject({ before: { allowedEmailDomains: ['old.com'] }, after: { allowedEmailDomains: ['new.com'] } })
  })
})
