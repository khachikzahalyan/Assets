import { describe, it, expect } from 'vitest'
import { InMemoryServerLicenseRepository } from './inMemoryServerLicenseRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const TEST_KEY = 'XCVF-7TR5-9HJK-5592'
const MASKED_KEY = '****-****-****-5592'
const RAW_FRAGMENT = '9HJK'

const ACTOR = { uid: 'u1', role: 'super_admin' as const }

function makeRepo() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const repo = new InMemoryServerLicenseRepository(ctx, store)
  return { repo, store }
}

describe('InMemoryServerLicenseRepository', () => {
  // ---- No assignment methods ------------------------------------------------

  it('has NO assignLicense method', () => {
    const { repo } = makeRepo()
    expect((repo as unknown as Record<string, unknown>).assignLicense).toBeUndefined()
  })

  it('has NO decoupleLicense method', () => {
    const { repo } = makeRepo()
    expect((repo as unknown as Record<string, unknown>).decoupleLicense).toBeUndefined()
  })

  // ---- createLicense --------------------------------------------------------

  describe('createLicense', () => {
    it('returned doc has NO key property', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'Windows Server', type: 'Server', rawKey: TEST_KEY },
        ACTOR,
      )
      expect((value as unknown as Record<string, unknown>).key).toBeUndefined()
    })

    it('audit log does NOT contain raw fragment and DOES contain masked key', async () => {
      const { repo, store } = makeRepo()
      await repo.createLicense(
        { name: 'Windows Server', type: 'Server', rawKey: TEST_KEY },
        ACTOR,
      )
      const log = store.logs[store.logs.length - 1]!
      const serialized = JSON.stringify(log)
      expect(serialized).not.toContain(RAW_FRAGMENT)
      expect(serialized).toContain(MASKED_KEY)
    })

    it('audit entityType is "server_license"', async () => {
      const { repo, store } = makeRepo()
      await repo.createLicense({ name: 'SrvLic', type: 'Server' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.entityType).toBe('server_license')
    })

    it('audit action is "created"', async () => {
      const { repo, store } = makeRepo()
      await repo.createLicense({ name: 'SrvLic', type: 'Server' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('created')
    })

    it('stores doc without key field even when rawKey provided', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'Srv', type: 'Infrastructure', rawKey: TEST_KEY },
        ACTOR,
      )
      const fetched = await repo.getLicense(value.id)
      expect(fetched).not.toBeNull()
      expect((fetched as unknown as Record<string, unknown>).key).toBeUndefined()
    })

    it('appends exactly one audit log per createLicense call', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.createLicense({ name: 'L', type: 'Global' }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('persists all fields (environment, host, expiresAt)', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        {
          name: 'Srv',
          type: 'Server',
          vendor: 'Microsoft',
          environment: 'production',
          host: 'dc-01.corp',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
        ACTOR,
      )
      expect(value.vendor).toBe('Microsoft')
      expect(value.environment).toBe('production')
      expect(value.host).toBe('dc-01.corp')
      expect(value.expiresAt).toBe('2027-01-01T00:00:00.000Z')
    })
  })

  // ---- updateLicense --------------------------------------------------------

  describe('updateLicense', () => {
    it('changes patched fields and leaves others intact', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense(
        {
          name: 'Old Name',
          type: 'Server',
          vendor: 'MS',
          environment: 'staging',
          host: 'host-1',
          expiresAt: '2025-01-01T00:00:00.000Z',
        },
        ACTOR,
      )
      const { value: updated } = await repo.updateLicense(
        created.id,
        { name: 'New Name', environment: 'production' },
        ACTOR,
      )
      expect(updated.name).toBe('New Name')
      expect(updated.environment).toBe('production')
      expect(updated.vendor).toBe('MS')
      expect(updated.host).toBe('host-1')
    })

    it('audit action is "updated"', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      await repo.updateLicense(value.id, { name: 'L Updated' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('updated')
      expect(log.entityType).toBe('server_license')
    })

    it('audit before/after reflect the changed fields', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'Original', type: 'Server' }, ACTOR)
      await repo.updateLicense(value.id, { name: 'Modified' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect((log.before as Record<string, unknown>).name).toBe('Original')
      expect((log.after as Record<string, unknown>).name).toBe('Modified')
    })

    it('appends exactly one audit log per updateLicense call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      const before = store.logs.length
      await repo.updateLicense(value.id, { host: 'new-host' }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('throws when license not found', async () => {
      const { repo } = makeRepo()
      await expect(
        repo.updateLicense('nonexistent', { name: 'X' }, ACTOR),
      ).rejects.toThrow('not found')
    })
  })

  // ---- rotateKey ------------------------------------------------------------

  describe('rotateKey', () => {
    const NEW_KEY = 'AAAA-BBBB-CCCC-1234'
    const NEW_MASKED = '****-****-****-1234'
    const NEW_RAW_FRAGMENT = 'CCCC'

    it('audit action is "key_rotated"', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      await repo.rotateKey(value.id, NEW_KEY, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('key_rotated')
      expect(log.entityType).toBe('server_license')
    })

    it('audit log does NOT contain raw fragment and DOES contain masked key', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      await repo.rotateKey(value.id, NEW_KEY, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      const serialized = JSON.stringify(log)
      expect(serialized).not.toContain(NEW_RAW_FRAGMENT)
      expect(serialized).toContain(NEW_MASKED)
    })

    it('doc has NO key field after rotateKey', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      await repo.rotateKey(created.id, NEW_KEY, ACTOR)
      const doc = await repo.getLicense(created.id)
      expect(doc).not.toBeNull()
      expect((doc as unknown as Record<string, unknown>).key).toBeUndefined()
    })

    it('appends exactly one audit log per rotateKey call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      const before = store.logs.length
      await repo.rotateKey(value.id, NEW_KEY, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('throws when license not found', async () => {
      const { repo } = makeRepo()
      await expect(repo.rotateKey('ghost', NEW_KEY, ACTOR)).rejects.toThrow('not found')
    })
  })

  // ---- listLicenses ---------------------------------------------------------

  describe('listLicenses', () => {
    it('returns all licenses when no filter', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'A', type: 'Server' }, ACTOR)
      await repo.createLicense({ name: 'B', type: 'Global' }, ACTOR)
      const list = await repo.listLicenses()
      expect(list).toHaveLength(2)
    })

    it('filters by search over name and vendor', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'Windows Server 2022', vendor: 'Microsoft', type: 'Server' }, ACTOR)
      await repo.createLicense({ name: 'Linux Enterprise', vendor: 'RedHat', type: 'Infrastructure' }, ACTOR)
      const result = await repo.listLicenses({ search: 'redhat' })
      expect(result).toHaveLength(1)
      expect(result[0]!.vendor).toBe('RedHat')
    })

    it('sorts by name ru-locale', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'Б Сервер', type: 'Server' }, ACTOR)
      await repo.createLicense({ name: 'А Сервер', type: 'Server' }, ACTOR)
      const list = await repo.listLicenses()
      expect(list[0]!.name).toBe('А Сервер')
      expect(list[1]!.name).toBe('Б Сервер')
    })

    it('search over name', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'Windows Server', type: 'Server' }, ACTOR)
      await repo.createLicense({ name: 'Oracle DB', type: 'Global' }, ACTOR)
      const result = await repo.listLicenses({ search: 'windows' })
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('Windows Server')
    })
  })

  // ---- getLicense -----------------------------------------------------------

  describe('getLicense', () => {
    it('returns null for unknown id', async () => {
      const { repo } = makeRepo()
      const result = await repo.getLicense('no-such-id')
      expect(result).toBeNull()
    })

    it('returns a cloned doc (no key field)', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'SrvLic', type: 'Server', rawKey: TEST_KEY },
        ACTOR,
      )
      const fetched = await repo.getLicense(value.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.name).toBe('SrvLic')
      expect((fetched as unknown as Record<string, unknown>).key).toBeUndefined()
    })
  })

  // ---- Audit log counts -----------------------------------------------------

  describe('audit log counts', () => {
    it('create + update + rotateKey each append exactly one log', async () => {
      const { repo, store } = makeRepo()
      expect(store.logs.length).toBe(0)

      const { value } = await repo.createLicense({ name: 'L', type: 'Server' }, ACTOR)
      expect(store.logs.length).toBe(1)

      await repo.updateLicense(value.id, { name: 'L Updated' }, ACTOR)
      expect(store.logs.length).toBe(2)

      await repo.rotateKey(value.id, 'XXXX-YYYY-ZZZZ-9999', ACTOR)
      expect(store.logs.length).toBe(3)
    })
  })
})
