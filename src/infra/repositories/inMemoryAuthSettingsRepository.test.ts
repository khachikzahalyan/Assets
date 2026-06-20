import { describe, it, expect } from 'vitest'
import { InMemoryAuthSettingsRepository } from './inMemoryAuthSettingsRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const actor = { uid: 'u_super', role: 'super_admin' as const }

describe('InMemoryAuthSettingsRepository', () => {
  // ---- existing baseline tests ----

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
    expect(store.logs[0]).toMatchObject({
      before: { allowedEmailDomains: ['old.com'] },
      after: { allowedEmailDomains: ['new.com'] },
    })
  })

  // ---- strengthened tests ----

  it('two sequential updates write exactly two audit rows; second before equals first after', async () => {
    // Arrange
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAuthSettingsRepository(
      { allowedEmailDomains: ['first.com'] },
      inMemoryAuditContext(store),
    )

    // Act
    await repo.updateAllowedDomains(['second.com'], actor)
    await repo.updateAllowedDomains(['third.com'], actor)

    // Assert — exactly two audit rows, one per call
    expect(store.logs).toHaveLength(2)
    // Second call's `before` must equal first call's `after`
    expect(store.logs[1]!.before).toEqual(store.logs[0]!.after)
    // And the values themselves are correct
    expect(store.logs[0]!.before).toEqual({ allowedEmailDomains: ['first.com'] })
    expect(store.logs[0]!.after).toEqual({ allowedEmailDomains: ['second.com'] })
    expect(store.logs[1]!.before).toEqual({ allowedEmailDomains: ['second.com'] })
    expect(store.logs[1]!.after).toEqual({ allowedEmailDomains: ['third.com'] })
  })

  it('getAuthSettings returns a copy — mutating the returned array does not mutate repo state', async () => {
    // Arrange
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['safe.com'] })

    // Act — get, mutate the returned value, then get again
    const first = await repo.getAuthSettings()
    first.allowedEmailDomains.push('injected.com')
    const second = await repo.getAuthSettings()

    // Assert — repo is unchanged
    expect(second.allowedEmailDomains).toEqual(['safe.com'])
  })

  it('update collapses scheme/path/@ noise to a single normalized domain', async () => {
    // Arrange — 'HTTPS://WWW.Acme.COM/login' and '@acme.com' both normalize to 'acme.com'
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: [] })

    // Act
    const r = await repo.updateAllowedDomains(
      ['HTTPS://WWW.Acme.COM/login', '@acme.com'],
      actor,
    )

    // Assert — normalize + dedupe together yields exactly one entry
    expect(r.value.allowedEmailDomains).toEqual(['acme.com'])
  })

  it('update with whitespace-only and empty-string entries yields an empty list', async () => {
    // Arrange
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['existing.com'] })

    // Act
    const r = await repo.updateAllowedDomains(['  ', ''], actor)

    // Assert — filter(Boolean) drops all entries after normalization
    expect(r.value.allowedEmailDomains).toEqual([])
  })

  it('returned value updatedBy equals the actor uid', async () => {
    // Arrange
    const actorBob = { uid: 'u_bob', role: 'asset_admin' as const }
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: [] })

    // Act
    const r = await repo.updateAllowedDomains(['example.test'], actorBob)

    // Assert
    expect(r.value.updatedBy).toBe('u_bob')
  })
})
