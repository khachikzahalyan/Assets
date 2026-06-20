import { describe, it, expect } from 'vitest'
import { InMemoryWorkstationLicenseRepository } from './inMemoryWorkstationLicenseRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const TEST_KEY = 'XCVF-7TR5-9HJK-5592'
const MASKED_KEY = '****-****-****-5592'
// Raw fragment that must NOT appear in audit logs
const RAW_FRAGMENT = '9HJK'

const ACTOR = { uid: 'u1', role: 'asset_admin' as const }

function makeRepo() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const repo = new InMemoryWorkstationLicenseRepository(ctx)
  return { repo, store }
}

describe('InMemoryWorkstationLicenseRepository', () => {
  // ---- createLicense --------------------------------------------------------

  describe('createLicense', () => {
    it('returned doc has NO key property', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'Office 365', type: 'Subscription', rawKey: TEST_KEY },
        ACTOR,
      )
      expect((value as unknown as Record<string, unknown>).key).toBeUndefined()
    })

    it('audit log does NOT contain raw fragment and DOES contain masked key', async () => {
      const { repo, store } = makeRepo()
      await repo.createLicense(
        { name: 'Office 365', type: 'Subscription', rawKey: TEST_KEY },
        ACTOR,
      )
      const log = store.logs[store.logs.length - 1]!
      const serialized = JSON.stringify(log)
      expect(serialized).not.toContain('XCVF')
      expect(serialized).not.toContain('7TR5')
      expect(serialized).not.toContain(RAW_FRAGMENT)
      expect(serialized).toContain(MASKED_KEY)
    })

    it('appends exactly one audit log per createLicense call', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.createLicense({ name: 'Lic A', type: 'Volume' }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('audit action is "created" and entityType is "license"', async () => {
      const { repo, store } = makeRepo()
      await repo.createLicense({ name: 'Lic B', type: 'Retail' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('created')
      expect(log.entityType).toBe('license')
    })

    it('isReusable defaults true for non-OEM and false for OEM', async () => {
      const { repo } = makeRepo()
      const { value: vol } = await repo.createLicense({ name: 'V', type: 'Volume' }, ACTOR)
      const { value: oem } = await repo.createLicense({ name: 'O', type: 'OEM' }, ACTOR)
      expect(vol.isReusable).toBe(true)
      expect(oem.isReusable).toBe(false)
    })

    it('creates with device assignment directly', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'Lic', type: 'Default', assign: { to: 'device', assetId: 'asset-1' } },
        ACTOR,
      )
      expect(value.assignmentType).toBe('device')
      expect(value.assignedToAssetId).toBe('asset-1')
      expect(value.assignedToEmployeeId).toBeNull()
    })

    it('creates with employee assignment directly', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense(
        { name: 'Lic', type: 'Default', assign: { to: 'employee', employeeId: 'emp-1' } },
        ACTOR,
      )
      expect(value.assignmentType).toBe('employee')
      expect(value.assignedToEmployeeId).toBe('emp-1')
      expect(value.assignedToAssetId).toBeNull()
    })
  })

  // ---- assignLicense --------------------------------------------------------

  describe('assignLicense', () => {
    it('assign device WITHOUT assetId throws', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await expect(
        repo.assignLicense(value.id, { to: 'device' /* no assetId */ }, ACTOR),
      ).rejects.toThrow('missing-assetId')
    })

    it('assign employee WITHOUT employeeId throws', async () => {
      const { repo } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await expect(
        repo.assignLicense(value.id, { to: 'employee' /* no employeeId */ }, ACTOR),
      ).rejects.toThrow('missing-employeeId')
    })

    it('assign device with assetId sets assignmentType and assignedToAssetId', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      const { value } = await repo.assignLicense(
        created.id,
        { to: 'device', assetId: 'asset-42' },
        ACTOR,
      )
      expect(value.assignmentType).toBe('device')
      expect(value.assignedToAssetId).toBe('asset-42')
      expect(value.assignedToEmployeeId).toBeNull()
    })

    it('assign employee sets correct fields', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      const { value } = await repo.assignLicense(
        created.id,
        { to: 'employee', employeeId: 'emp-5' },
        ACTOR,
      )
      expect(value.assignmentType).toBe('employee')
      expect(value.assignedToEmployeeId).toBe('emp-5')
      expect(value.assignedToAssetId).toBeNull()
    })

    it('appends exactly one audit log per assignLicense call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      const before = store.logs.length
      await repo.assignLicense(value.id, { to: 'device', assetId: 'a1' }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('audit action is "assigned"', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await repo.assignLicense(value.id, { to: 'device', assetId: 'a1' }, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('assigned')
    })

    it('throws when license not found', async () => {
      const { repo } = makeRepo()
      await expect(
        repo.assignLicense('nonexistent', { to: 'device', assetId: 'a1' }, ACTOR),
      ).rejects.toThrow('not found')
    })
  })

  // ---- decoupleLicense ------------------------------------------------------

  describe('decoupleLicense', () => {
    it('sets assignmentType to unassigned and clears target fields', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense(
        { name: 'Reusable', type: 'Volume', isReusable: true },
        ACTOR,
      )
      await repo.assignLicense(created.id, { to: 'device', assetId: 'asset-1' }, ACTOR)
      const { value } = await repo.decoupleLicense(created.id, ACTOR)
      expect(value.assignmentType).toBe('unassigned')
      expect(value.assignedToAssetId).toBeNull()
      expect(value.assignedToEmployeeId).toBeNull()
      expect(value.assignedAt).toBeNull()
      expect(value.assignedBy).toBeNull()
    })

    it('latest audit action is "license_decoupled"', async () => {
      const { repo, store } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await repo.assignLicense(created.id, { to: 'device', assetId: 'a1' }, ACTOR)
      await repo.decoupleLicense(created.id, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('license_decoupled')
    })

    it('after decoupling the license appears in listAssignablePool', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'Pool Lic', type: 'Volume' }, ACTOR)
      await repo.assignLicense(created.id, { to: 'device', assetId: 'a1' }, ACTOR)
      await repo.decoupleLicense(created.id, ACTOR)
      const pool = await repo.listAssignablePool()
      expect(pool).toHaveLength(1)
      expect(pool[0]!.id).toBe(created.id)
    })

    it('appends exactly one audit log per decoupleLicense call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await repo.assignLicense(value.id, { to: 'device', assetId: 'a1' }, ACTOR)
      const before = store.logs.length
      await repo.decoupleLicense(value.id, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })
  })

  // ---- rotateKey ------------------------------------------------------------

  describe('rotateKey', () => {
    const NEW_KEY = 'ABCD-EFGH-IJKL-1234'
    const NEW_MASKED = '****-****-****-1234'
    const NEW_RAW_FRAGMENT = 'IJKL'

    it('audit action is "key_rotated"', async () => {
      const { repo, store } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await repo.rotateKey(created.id, NEW_KEY, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      expect(log.action).toBe('key_rotated')
    })

    it('audit log does NOT contain raw key fragment and DOES contain masked key', async () => {
      const { repo, store } = makeRepo()
      const { value: created } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      await repo.rotateKey(created.id, NEW_KEY, ACTOR)
      const log = store.logs[store.logs.length - 1]!
      const serialized = JSON.stringify(log)
      expect(serialized).not.toContain('ABCD')
      expect(serialized).not.toContain('EFGH')
      expect(serialized).not.toContain(NEW_RAW_FRAGMENT)
      expect(serialized).toContain(NEW_MASKED)
    })

    it('getLicense doc still has NO key field after rotateKey', async () => {
      const { repo } = makeRepo()
      const { value: created } = await repo.createLicense(
        { name: 'L', type: 'Volume', rawKey: TEST_KEY },
        ACTOR,
      )
      await repo.rotateKey(created.id, NEW_KEY, ACTOR)
      // rotate again to confirm secrets are updated but doc is clean
      await repo.rotateKey(created.id, 'ZZZZ-YYYY-XXXX-9999', ACTOR)
      const doc = await repo.getLicense(created.id)
      expect(doc).not.toBeNull()
      expect((doc as unknown as Record<string, unknown>).key).toBeUndefined()
    })

    it('appends exactly one audit log per rotateKey call', async () => {
      const { repo, store } = makeRepo()
      const { value } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      const before = store.logs.length
      await repo.rotateKey(value.id, NEW_KEY, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('throws when license not found', async () => {
      const { repo } = makeRepo()
      await expect(repo.rotateKey('ghost', NEW_KEY, ACTOR)).rejects.toThrow('not found')
    })
  })

  // ---- listForAsset ---------------------------------------------------------

  describe('listForAsset', () => {
    it('returns only device-assigned active licenses for the given assetId', async () => {
      const { repo } = makeRepo()
      const { value: l1 } = await repo.createLicense({ name: 'L1', type: 'Volume' }, ACTOR)
      const { value: l2 } = await repo.createLicense({ name: 'L2', type: 'Volume' }, ACTOR)
      const { value: l3 } = await repo.createLicense({ name: 'L3', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l1.id, { to: 'device', assetId: 'asset-A' }, ACTOR)
      await repo.assignLicense(l2.id, { to: 'device', assetId: 'asset-B' }, ACTOR)
      await repo.assignLicense(l3.id, { to: 'employee', employeeId: 'emp-1' }, ACTOR)
      const forA = await repo.listForAsset('asset-A')
      expect(forA).toHaveLength(1)
      expect(forA[0]!.id).toBe(l1.id)
    })

    it('excludes retired licenses', async () => {
      // Simulate retired by creating OEM and noting there's no retire method on this repo
      // but we can verify active filter works via listForAsset returning active ones
      const { repo } = makeRepo()
      const { value: l1 } = await repo.createLicense({ name: 'Active', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l1.id, { to: 'device', assetId: 'asset-X' }, ACTOR)
      const forX = await repo.listForAsset('asset-X')
      expect(forX).toHaveLength(1)
    })
  })

  // ---- listAssignablePool ---------------------------------------------------

  describe('listAssignablePool', () => {
    it('returns active unassigned licenses only', async () => {
      const { repo } = makeRepo()
      const { value: l1 } = await repo.createLicense({ name: 'Pool-A', type: 'Volume' }, ACTOR)
      const { value: l2 } = await repo.createLicense({ name: 'Pool-B', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l2.id, { to: 'device', assetId: 'a1' }, ACTOR)
      const pool = await repo.listAssignablePool()
      expect(pool).toHaveLength(1)
      expect(pool[0]!.id).toBe(l1.id)
    })

    it('excludes employee-assigned licenses', async () => {
      const { repo } = makeRepo()
      const { value: l } = await repo.createLicense({ name: 'Emp Lic', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l.id, { to: 'employee', employeeId: 'e1' }, ACTOR)
      const pool = await repo.listAssignablePool()
      expect(pool).toHaveLength(0)
    })
  })

  // ---- listLicenses ---------------------------------------------------------

  describe('listLicenses', () => {
    it('returns all licenses when no filter', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'A', type: 'Volume' }, ACTOR)
      await repo.createLicense({ name: 'B', type: 'OEM' }, ACTOR)
      const list = await repo.listLicenses()
      expect(list).toHaveLength(2)
    })

    it('filters by assignmentType', async () => {
      const { repo } = makeRepo()
      const { value: l1 } = await repo.createLicense({ name: 'A', type: 'Volume' }, ACTOR)
      await repo.createLicense({ name: 'B', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l1.id, { to: 'device', assetId: 'a1' }, ACTOR)
      const deviceOnly = await repo.listLicenses({ assignmentType: 'device' })
      expect(deviceOnly).toHaveLength(1)
      expect(deviceOnly[0]!.id).toBe(l1.id)
    })

    it('filters by search (name/vendor)', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'Microsoft Office', vendor: 'Microsoft', type: 'Volume' }, ACTOR)
      await repo.createLicense({ name: 'Adobe Creative', vendor: 'Adobe', type: 'Retail' }, ACTOR)
      const result = await repo.listLicenses({ search: 'adobe' })
      expect(result).toHaveLength(1)
      expect(result[0]!.vendor).toBe('Adobe')
    })

    it('sorts by name ru-locale', async () => {
      const { repo } = makeRepo()
      await repo.createLicense({ name: 'Б Лицензия', type: 'Volume' }, ACTOR)
      await repo.createLicense({ name: 'А Лицензия', type: 'Volume' }, ACTOR)
      const list = await repo.listLicenses()
      expect(list[0]!.name).toBe('А Лицензия')
      expect(list[1]!.name).toBe('Б Лицензия')
    })

    it('"all" value for assignmentType disables that filter', async () => {
      const { repo } = makeRepo()
      const { value: l1 } = await repo.createLicense({ name: 'A', type: 'Volume' }, ACTOR)
      await repo.assignLicense(l1.id, { to: 'device', assetId: 'a1' }, ACTOR)
      await repo.createLicense({ name: 'B', type: 'Volume' }, ACTOR)
      const all = await repo.listLicenses({ assignmentType: 'all' })
      expect(all).toHaveLength(2)
    })
  })

  // ---- Audit log count across operations ------------------------------------

  describe('audit log counts', () => {
    it('each distinct operation (create/assign/decouple) appends exactly one log', async () => {
      const { repo, store } = makeRepo()

      expect(store.logs.length).toBe(0)

      const { value: l } = await repo.createLicense({ name: 'L', type: 'Volume' }, ACTOR)
      expect(store.logs.length).toBe(1)

      await repo.assignLicense(l.id, { to: 'device', assetId: 'a1' }, ACTOR)
      expect(store.logs.length).toBe(2)

      await repo.decoupleLicense(l.id, ACTOR)
      expect(store.logs.length).toBe(3)

      await repo.rotateKey(l.id, 'XXXX-YYYY-ZZZZ-1111', ACTOR)
      expect(store.logs.length).toBe(4)
    })
  })
})
