/**
 * Tests for the asset-create OEM license seam.
 *
 * Verifies that InMemoryAssetRepository correctly creates or re-binds a
 * device-bound workstation license when `input.oemLicense` is supplied and a
 * WorkstationLicenseRepository is injected.
 */
import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import { InMemoryWorkstationLicenseRepository } from './inMemoryWorkstationLicenseRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [],
  branches: [{ id: 'b_main', name: 'HQ' }],
  departments: [],
  categories: [{ id: 'cat_laptop', name: 'Laptop', group: 'devices', lucideIcon: 'laptop' }],
  employees: [],
}

const ACTOR = { uid: 'u_admin', role: 'asset_admin' as const }

const BASE_INPUT = {
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'XPS 15',
  invCode: 'LAP/OEM/001',
  serial: 'SN-OEM-001',
  assignment: null,
  branchId: 'b_main',
  deptId: null,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepos() {
  // One shared audit store so we can assert BOTH asset and license audit entries.
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(ctx)
  const assetRepo = new InMemoryAssetRepository([], REF, ctx, licenseRepo)
  return { assetRepo, licenseRepo, store }
}

// ---------------------------------------------------------------------------
// Suite 1: rawKey branch — new device-bound OEM license created on asset create
// ---------------------------------------------------------------------------

describe('createAsset with oemLicense: { rawKey } (new OEM license)', () => {
  it('creates a device-bound OEM workstation license for the new asset', async () => {
    const { assetRepo, licenseRepo } = makeRepos()

    const { value: asset } = await assetRepo.createAsset(
      { ...BASE_INPUT, oemLicense: { rawKey: 'WIN-1122-3344-5566' } },
      ACTOR,
    )

    const bound = await licenseRepo.listForAsset(asset.id)
    expect(bound).toHaveLength(1)
    expect(bound[0]!.type).toBe('OEM')
    expect(bound[0]!.isReusable).toBe(false)
    expect(bound[0]!.assignmentType).toBe('device')
    expect(bound[0]!.assignedToAssetId).toBe(asset.id)
    expect(bound[0]!.lifecycleStatus).toBe('active')
  })

  it('writes TWO audit entries: asset:created + license:created', async () => {
    const { assetRepo, store } = makeRepos()

    await assetRepo.createAsset(
      { ...BASE_INPUT, oemLicense: { rawKey: 'WIN-1122-3344-5566' } },
      ACTOR,
    )

    expect(store.logs).toHaveLength(2)
    const assetLog = store.logs.find(l => l.entityType === 'asset' && l.action === 'created')
    const licenseLog = store.logs.find(l => l.entityType === 'license' && l.action === 'created')
    expect(assetLog).toBeDefined()
    expect(licenseLog).toBeDefined()
  })

  it('license-create audit is masked: WIN-1122 fragment NOT in serialized audit log', async () => {
    const { assetRepo, store } = makeRepos()

    await assetRepo.createAsset(
      { ...BASE_INPUT, oemLicense: { rawKey: 'WIN-1122-3344-5566' } },
      ACTOR,
    )

    const serialized = JSON.stringify(store.logs)
    // Raw prefix must not appear verbatim; only the last 4 alnum chars ('5566') survive masking.
    expect(serialized).not.toContain('WIN-1122')
    expect(serialized).not.toContain('3344')
    // Confirm the masked suffix IS present so we know the audit entry is there.
    expect(serialized).toContain('5566')
  })

  it('the asset doc itself contains no license key field', async () => {
    const { assetRepo } = makeRepos()

    const { value: asset } = await assetRepo.createAsset(
      { ...BASE_INPUT, oemLicense: { rawKey: 'WIN-1122-3344-5566' } },
      ACTOR,
    )

    // The domain Asset type has no key field; verify the object has no suspicious key property.
    expect((asset as unknown as Record<string, unknown>).key).toBeUndefined()
    expect((asset as unknown as Record<string, unknown>).rawKey).toBeUndefined()
    expect((asset as unknown as Record<string, unknown>).oemLicense).toBeUndefined()
  })

  it('license name is derived from brand + model', async () => {
    const { assetRepo, licenseRepo } = makeRepos()

    const { value: asset } = await assetRepo.createAsset(
      { ...BASE_INPUT, oemLicense: { rawKey: 'WIN-1122-3344-5566' } },
      ACTOR,
    )

    const bound = await licenseRepo.listForAsset(asset.id)
    expect(bound[0]!.name).toBe('OEM — Dell XPS 15')
  })
})

// ---------------------------------------------------------------------------
// Suite 2: existingLicenseId branch — pre-existing license re-bound to new asset
// ---------------------------------------------------------------------------

describe('createAsset with oemLicense: { existingLicenseId }', () => {
  it('re-binds an existing unassigned license to the new asset as a device assignment', async () => {
    const { assetRepo, licenseRepo, store } = makeRepos()

    // Pre-create an unassigned OEM license.
    const { value: lic } = await licenseRepo.createLicense(
      { name: 'Windows 11 Pro', type: 'OEM', isReusable: false },
      ACTOR,
    )
    expect(lic.assignmentType).toBe('unassigned')
    store.logs.length = 0 // reset audit counter so the asset-create is the first entry below

    const { value: asset } = await assetRepo.createAsset(
      { ...BASE_INPUT, invCode: 'LAP/OEM/002', serial: 'SN-OEM-002', oemLicense: { existingLicenseId: lic.id } },
      ACTOR,
    )

    const bound = await licenseRepo.listForAsset(asset.id)
    expect(bound).toHaveLength(1)
    expect(bound[0]!.id).toBe(lic.id)
    expect(bound[0]!.assignmentType).toBe('device')
    expect(bound[0]!.assignedToAssetId).toBe(asset.id)
  })

  it('writes TWO audit entries: asset:created + license:assigned', async () => {
    const { assetRepo, licenseRepo, store } = makeRepos()

    const { value: lic } = await licenseRepo.createLicense(
      { name: 'Windows 11 Pro', type: 'OEM', isReusable: false },
      ACTOR,
    )
    store.logs.length = 0

    await assetRepo.createAsset(
      { ...BASE_INPUT, invCode: 'LAP/OEM/003', serial: 'SN-OEM-003', oemLicense: { existingLicenseId: lic.id } },
      ACTOR,
    )

    expect(store.logs).toHaveLength(2)
    const assetLog = store.logs.find(l => l.entityType === 'asset' && l.action === 'created')
    const licLog = store.logs.find(l => l.entityType === 'license' && l.action === 'assigned')
    expect(assetLog).toBeDefined()
    expect(licLog).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Suite 3: regression — no oemLicense / no licenses repo
// ---------------------------------------------------------------------------

describe('createAsset regression: no oemLicense, no licenses repo', () => {
  it('creates asset with one audit entry when no oemLicense is provided', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    // No licenses repo injected — must behave exactly as before.
    const assetRepo = new InMemoryAssetRepository([], REF, ctx)

    const { value } = await assetRepo.createAsset(BASE_INPUT, ACTOR)
    expect(value.statusId).toBe('st_warehouse')
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]!.action).toBe('created')
    expect(store.logs[0]!.entityType).toBe('asset')
  })

  it('createAsset with oemLicense but NO licenses repo injected produces one audit + no license', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    // No licenses repo — oemLicense is silently ignored (guard: `this.licenses` is falsy).
    const assetRepo = new InMemoryAssetRepository([], REF, ctx)

    const { value } = await assetRepo.createAsset(
      { ...BASE_INPUT, invCode: 'LAP/OEM/REG', serial: 'SN-REG', oemLicense: { rawKey: 'WIN-9999-8888-7777-6666' } },
      ACTOR,
    )
    expect(value.id).toBeTruthy()
    expect(store.logs).toHaveLength(1)
  })
})
