import { describe, it, expect } from 'vitest'
import { WriteOffAssetService } from './WriteOffAssetService'
import { InMemoryAssetRepository } from '@/infra/repositories/inMemoryAssetRepository'
import { InMemoryWorkstationLicenseRepository } from '@/infra/repositories/inMemoryWorkstationLicenseRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'

const ACTOR = { uid: 'u1', role: 'asset_admin' as const }

const REF: AssetReferenceData = {
  statuses: [],
  branches: [{ id: 'b_main', name: 'HQ' }],
  departments: [],
  categories: [{ id: 'cat_computer', name: 'Computer', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'monitor' }],
  employees:      [],
  categoryGroups: [],
}

const baseAsset = {
  categoryId: 'cat_computer',
  brand: 'Dell',
  model: 'OptiPlex',
  invCode: '450/1',
  serial: 'SN1',
  assignment: null,
  branchId: 'b_main',
  deptId: null,
}

/** Asset repo + license repo share ONE in-memory audit store/context. */
function makeHarness() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const assetRepo = new InMemoryAssetRepository([], REF, ctx)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(ctx)
  const service = new WriteOffAssetService(assetRepo, licenseRepo)
  return { store, ctx, assetRepo, licenseRepo, service }
}

describe('WriteOffAssetService', () => {
  it('decouples reusable + retires OEM + disposes asset, leaving NO orphan license (no-orphan invariant)', async () => {
    const { assetRepo, licenseRepo, service } = makeHarness()

    const { value: asset } = await assetRepo.createAsset(baseAsset, ACTOR)

    const { value: reusable } = await licenseRepo.createLicense(
      { name: 'Volume Office', type: 'Volume', isReusable: true, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )
    const { value: oem } = await licenseRepo.createLicense(
      { name: 'OEM Windows', type: 'OEM', isReusable: false, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )

    expect(await licenseRepo.listForAsset(asset.id)).toHaveLength(2)

    await service.writeOff(asset.id, ACTOR, 'end of life')

    // Asset disposed
    const after = await assetRepo.getAsset(asset.id)
    expect(after?.statusId).toBe('st_disposed')

    // Reusable -> decoupled
    const reusableAfter = await licenseRepo.getLicense(reusable.id)
    expect(reusableAfter?.assignmentType).toBe('unassigned')
    expect(reusableAfter?.assignedToAssetId).toBeNull()
    expect(reusableAfter?.lifecycleStatus).toBe('active')

    // OEM -> retired with asset
    const oemAfter = await licenseRepo.getLicense(oem.id)
    expect(oemAfter?.lifecycleStatus).toBe('retired')
    expect(oemAfter?.retiredWithAssetId).toBe(asset.id)
    expect(oemAfter?.assignedToAssetId).toBeNull()

    // No orphan: nothing still points at the disposed asset
    expect(await licenseRepo.listForAsset(asset.id)).toEqual([])
  })

  it('emits license_decoupled and license_retired_with_asset audit actions', async () => {
    const { store, assetRepo, licenseRepo, service } = makeHarness()

    const { value: asset } = await assetRepo.createAsset(baseAsset, ACTOR)
    await licenseRepo.createLicense(
      { name: 'Volume Office', type: 'Volume', isReusable: true, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )
    await licenseRepo.createLicense(
      { name: 'OEM Windows', type: 'OEM', isReusable: false, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )

    await service.writeOff(asset.id, ACTOR)

    const actions = store.logs.map(l => l.action)
    expect(actions).toContain('license_decoupled')
    expect(actions).toContain('license_retired_with_asset')
  })

  it('mid-loop failure: asset is disposed first; idempotent re-run reaps straggler licenses', async () => {
    const { assetRepo, licenseRepo, service } = makeHarness()

    const { value: asset } = await assetRepo.createAsset(
      { ...baseAsset, invCode: '450/midloop', serial: 'SN_midloop' },
      ACTOR,
    )

    // Create TWO device-bound licenses: one reusable, one OEM (non-reusable)
    const { value: reusable } = await licenseRepo.createLicense(
      { name: 'Volume Office', type: 'Volume', isReusable: true, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )
    const { value: oem } = await licenseRepo.createLicense(
      { name: 'OEM Windows', type: 'OEM', isReusable: false, assign: { to: 'device', assetId: asset.id } },
      ACTOR,
    )

    // Build a proxy repo that delegates all reads to the real licenseRepo but
    // throws on the 2nd reconcile (decoupleLicense/retireLicense) call.
    let reconcileCalls = 0
    const faultingLicenseRepo: WorkstationLicenseRepository = {
      getLicense: (id) => licenseRepo.getLicense(id),
      listLicenses: (q) => licenseRepo.listLicenses(q),
      listForAsset: (assetId) => licenseRepo.listForAsset(assetId),
      listAssignablePool: () => licenseRepo.listAssignablePool(),
      createLicense: (input, actor) => licenseRepo.createLicense(input, actor),
      assignLicense: (id, input, actor) => licenseRepo.assignLicense(id, input, actor),
      rotateKey: (id, rawKey, actor) => licenseRepo.rotateKey(id, rawKey, actor),
      decoupleLicense: async (id, actor) => {
        reconcileCalls++
        if (reconcileCalls >= 2) throw new Error('simulated mid-loop failure')
        return licenseRepo.decoupleLicense(id, actor)
      },
      retireLicense: async (id, assetId, actor) => {
        reconcileCalls++
        if (reconcileCalls >= 2) throw new Error('simulated mid-loop failure')
        return licenseRepo.retireLicense(id, assetId, actor)
      },
    }

    const faultingSvc = new WriteOffAssetService(assetRepo, faultingLicenseRepo)

    // First run: should reject (second reconcile throws)
    await expect(faultingSvc.writeOff(asset.id, ACTOR, 'end of life')).rejects.toThrow('simulated mid-loop failure')

    // ASSERT: asset IS already disposed (dispose happened first)
    const afterFault = await assetRepo.getAsset(asset.id)
    expect(afterFault?.statusId).toBe('st_disposed')

    // Idempotent re-run using the REAL service (all calls succeed)
    await service.writeOff(asset.id, ACTOR)

    // All stragglers reaped — no license still active for this asset
    const remainingBound = await licenseRepo.listForAsset(asset.id)
    expect(remainingBound).toHaveLength(0)

    // Verify individual license states are consistent (no double-retire)
    const reusableAfter = await licenseRepo.getLicense(reusable.id)
    const oemAfter = await licenseRepo.getLicense(oem.id)
    // Both should be properly reconciled: reusable decoupled, oem retired
    expect(reusableAfter?.assignmentType).toBe('unassigned')
    expect(reusableAfter?.lifecycleStatus).toBe('active')
    expect(oemAfter?.lifecycleStatus).toBe('retired')
    expect(oemAfter?.retiredWithAssetId).toBe(asset.id)
  })

  it('asset with zero bound licenses: just flips status to st_disposed, no license audits', async () => {
    const { store, assetRepo, service } = makeHarness()

    const { value: asset } = await assetRepo.createAsset(baseAsset, ACTOR)
    const logsBefore = store.logs.length

    await service.writeOff(asset.id, ACTOR)

    const after = await assetRepo.getAsset(asset.id)
    expect(after?.statusId).toBe('st_disposed')

    const newActions = store.logs.slice(logsBefore).map(l => l.action)
    expect(newActions).not.toContain('license_decoupled')
    expect(newActions).not.toContain('license_retired_with_asset')
    // exactly one new audit: the status change
    expect(newActions).toEqual(['status_changed'])
  })
})
