/**
 * Unit tests for InMemoryPartRepository.
 * Covers the §10 acceptance scenarios and §3 invariant (one audit entry per mutating call).
 *
 * Stock math reference (deriveStock):
 *   serviceReplace movements → skipped, never affect stock.
 *   receive   → +onHand
 *   install   → −onHand  (unless serviceReplace)
 *   uninstall → broken ? +broken : +onHand  (unless serviceReplace)
 */

import { describe, it, expect } from 'vitest'
import { InMemoryPartRepository } from './inMemoryPartRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Part, PartMovement, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import { isInsufficientStockError, isInvalidCategoryBehaviorError } from '@/domain/part/errors'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

const ACTOR: Actor = { uid: 'u_admin', role: 'asset_admin' }

/** Build a minimal Part SKU for tests. */
function makePart(overrides: Partial<Part> & Pick<Part, 'id' | 'category'>): Part {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    name: 'Generic Part',
    variantLabel: null,
    unit: 'шт',
    onHand: 0,
    broken: 0,
    lowStockThreshold: 5,
    createdAt: now,
    updatedAt: now,
    createdBy: 'u_admin',
    updatedBy: 'u_admin',
    ...overrides,
  }
}

/** Build a minimal PartsAsset for tests. */
function makePartsAsset(
  assetId: string,
  categoryId: string,
  upgradeCurrent: UpgradeSlot[] = [],
): PartsAsset {
  return {
    id: `INV/${assetId}`,
    assetId,
    categoryId,
    kind: 'desktop',
    name: 'Test Asset',
    user: '',
    upgradeCurrent,
  }
}

/** SKU fixtures */
const SKU_SSD = makePart({ id: 'sku_ssd_256', category: 'ssd', name: 'SSD 256 ГБ', variantLabel: '256 ГБ' })
const SKU_NVME = makePart({ id: 'sku_nvme_512', category: 'nvme', name: 'NVMe 512 ГБ', variantLabel: '512 ГБ' })
const SKU_RAM = makePart({ id: 'sku_ram_16', category: 'ram', name: 'RAM', variantLabel: '16 ГБ' })
const SKU_PSU = makePart({ id: 'sku_psu_650', category: 'psu', name: 'PSU 650W' })

/**
 * Category ids (production-grade, from categoryCapabilities.ts):
 *   desktop   → cat_desktop  (in-house, stock debited)
 *   laptop    → cat_laptop   (service-only, stock NOT debited)
 *   server    → cat_server   (in-house, stock debited)
 */
const CAT_DESKTOP = 'cat_desktop'
const CAT_LAPTOP = 'cat_laptop'
const CAT_SERVER = 'cat_server'

/** Asset fixtures */
const ASSET_DESKTOP_ID = 'asset_desktop_1'
const ASSET_LAPTOP_ID = 'asset_laptop_1'
const ASSET_SERVER_ID = 'asset_server_1'

/** Create a repo with seeded stock and asset projections. */
function makeRepo(
  extraParts: Part[] = [],
  extraMovements: PartMovement[] = [],
  extraAssets: PartsAsset[] = [],
) {
  const store = createInMemoryAuditStore()
  const audit = inMemoryAuditContext(store)

  const parts: Part[] = [SKU_SSD, SKU_NVME, SKU_RAM, SKU_PSU, ...extraParts].map(p => ({ ...p }))
  const movements: PartMovement[] = [...extraMovements]
  const partsAssets: PartsAsset[] = [
    makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP),
    makePartsAsset(ASSET_LAPTOP_ID, CAT_LAPTOP),
    makePartsAsset(ASSET_SERVER_ID, CAT_SERVER),
    ...extraAssets,
  ]

  const repo = new InMemoryPartRepository(parts, movements, partsAssets, audit)
  return { repo, store }
}

// ---------------------------------------------------------------------------
// Helpers for seeding stock without going through the repo (direct movement push)
// is NOT available — we use receiveParts to seed stock.
// ---------------------------------------------------------------------------

async function seedStock(
  repo: InMemoryPartRepository,
  skuId: string,
  qty: number,
) {
  await repo.receiveParts([{ skuId, qty }], ACTOR)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryPartRepository', () => {

  // -------------------------------------------------------------------------
  // receiveParts
  // -------------------------------------------------------------------------

  describe('receiveParts', () => {
    it('bumps onHand for the SKU and writes exactly ONE audit entry', async () => {
      // Arrange
      const { repo, store } = makeRepo()

      // Act
      const logsBefore = store.logs.length
      await repo.receiveParts([{ skuId: SKU_SSD.id, qty: 10 }], ACTOR)

      // Assert — audit
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('part_received')

      // Assert — stock reflected in loadReferenceData
      const ref = await repo.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      expect(ssd?.onHand).toBe(10)
    })

    it('handles multiple items in one call and writes exactly ONE audit entry', async () => {
      // Arrange
      const { repo, store } = makeRepo()

      // Act
      await repo.receiveParts(
        [{ skuId: SKU_SSD.id, qty: 5 }, { skuId: SKU_RAM.id, qty: 8 }],
        ACTOR,
      )

      // Assert — single audit entry even for multi-item receive
      expect(store.logs).toHaveLength(1)

      // Assert — both SKUs received
      const ref = await repo.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      const ram = ref.parts.find(p => p.id === SKU_RAM.id)
      expect(ssd?.onHand).toBe(5)
      expect(ram?.onHand).toBe(8)
    })

    it('throws when all items have qty < 1 and writes no audit', async () => {
      // Arrange
      const { repo, store } = makeRepo()

      // Act + Assert
      await expect(repo.receiveParts([{ skuId: SKU_SSD.id, qty: 0 }], ACTOR)).rejects.toThrow()
      expect(store.logs).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // installPart — desktop (in-house): debits onHand
  // -------------------------------------------------------------------------

  describe('installPart on DESKTOP (in-house)', () => {
    it('debits onHand −1 and mutates upgradeCurrent, writing exactly ONE audit entry', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 5) // onHand = 5, 1 audit entry
      const logsBefore = store.logs.length

      // Act
      await repo.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/asset_desktop_1',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      // Assert — exactly one new audit entry
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('part_installed')

      // Assert — onHand decremented
      const ref = await repo.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      expect(ssd?.onHand).toBe(4)

      // Assert — upgradeCurrent slot added
      const pa = ref.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)
      expect(pa?.upgradeCurrent).toHaveLength(1)
      expect(pa?.upgradeCurrent[0]!.kind).toBe('storage')
      expect(pa?.upgradeCurrent[0]!.storageType).toBe('SSD')
    })
  })

  // -------------------------------------------------------------------------
  // installPart — laptop (service-only): stock UNCHANGED
  // -------------------------------------------------------------------------

  describe('installPart on LAPTOP (serviceReplace:true)', () => {
    it('leaves onHand UNCHANGED but still mutates upgradeCurrent and writes ONE audit entry', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 5)
      const logsBefore = store.logs.length

      // Act
      await repo.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_LAPTOP_ID,
        assetInvCode: 'INV/asset_laptop_1',
        assetCategoryId: CAT_LAPTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: true,
      }, ACTOR)

      // Assert — one audit entry
      expect(store.logs).toHaveLength(logsBefore + 1)

      // Assert — onHand UNCHANGED (service, not debited)
      const ref = await repo.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      expect(ssd?.onHand).toBe(5)

      // Assert — upgradeCurrent slot still added
      const pa = ref.partsAssets.find(a => a.assetId === ASSET_LAPTOP_ID)
      expect(pa?.upgradeCurrent).toHaveLength(1)
    })

    it('isServiceOnly is derived from assetCategoryId (cat_laptop) even when serviceReplace:false', async () => {
      // Arrange — laptop category forces service-only regardless of the flag
      const { repo } = makeRepo()
      await seedStock(repo, SKU_RAM.id, 3)
      const onHandBefore = (await repo.loadReferenceData()).parts.find(p => p.id === SKU_RAM.id)?.onHand ?? 0

      // Act — serviceReplace:false but category is laptop → still service-only
      await repo.installPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_LAPTOP_ID,
        assetInvCode: 'INV/asset_laptop_1',
        assetCategoryId: CAT_LAPTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false, // adapter should override this for laptops
      }, ACTOR)

      // Assert — stock unchanged because category is laptop (service-only)
      const ref = await repo.loadReferenceData()
      const ram = ref.parts.find(p => p.id === SKU_RAM.id)
      expect(ram?.onHand).toBe(onHandBefore)
    })
  })

  // -------------------------------------------------------------------------
  // installPart replace — oldIsBroken:true → audit action part_scrapped
  // -------------------------------------------------------------------------

  describe('installPart replace with oldIsBroken:true', () => {
    it('overwrites the existing slot in-place and records part_scrapped audit action', async () => {
      // Arrange — desktop already has one SSD slot installed
      const existingSlot: UpgradeSlot = {
        kind: 'storage',
        spec: 'SSD 128 ГБ',
        storageType: 'SSD',
        installedAt: '2026-01-01T00:00:00.000Z',
        replaced: false,
      }
      // Build a fresh repo with just this asset (makeRepo includes duplicates of the default assets)
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_SSD }]
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP, [{ ...existingSlot }])]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)
      await repo2.receiveParts([{ skuId: SKU_SSD.id, qty: 5 }], ACTOR) // onHand = 5
      const logsBefore = store2.logs.length

      // Act — replace with broken old part
      await repo2.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'replace',
        replaceUcIndex: 0,
        oldIsBroken: true,
        serviceReplace: false,
      }, ACTOR)

      // Assert — ONE audit entry written
      expect(store2.logs).toHaveLength(logsBefore + 1)

      // Assert — audit action is part_scrapped (old part was broken)
      expect(store2.logs[store2.logs.length - 1]!.action).toBe('part_scrapped')

      // Assert — slot overwritten in-place (still 1 slot, not 2)
      const ref = await repo2.loadReferenceData()
      const pa = ref.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)
      expect(pa?.upgradeCurrent).toHaveLength(1)
      expect(pa?.upgradeCurrent[0]!.replaced).toBe(true)
      expect(pa?.upgradeCurrent[0]!.spec).toContain('SSD')
    })
  })

  // -------------------------------------------------------------------------
  // installPart replace — oldIsBroken:false → audit action part_returned
  // -------------------------------------------------------------------------

  describe('installPart replace with oldIsBroken:false', () => {
    it('overwrites existing slot and records part_returned audit action', async () => {
      // Arrange
      const existingSlot: UpgradeSlot = {
        kind: 'storage',
        spec: 'SSD 128 ГБ',
        storageType: 'SSD',
        installedAt: '2026-01-01T00:00:00.000Z',
        replaced: false,
      }
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_SSD }]
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP, [{ ...existingSlot }])]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)
      await repo2.receiveParts([{ skuId: SKU_SSD.id, qty: 5 }], ACTOR)
      const logsBefore = store2.logs.length

      // Act — replace with working old part
      await repo2.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'replace',
        replaceUcIndex: 0,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      // Assert — ONE audit entry
      expect(store2.logs).toHaveLength(logsBefore + 1)

      // Assert — audit action is part_returned (old part was working)
      expect(store2.logs[store2.logs.length - 1]!.action).toBe('part_returned')

      // Assert — slot overwritten in-place
      const ref = await repo2.loadReferenceData()
      const pa = ref.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)
      expect(pa?.upgradeCurrent).toHaveLength(1)
      expect(pa?.upgradeCurrent[0]!.replaced).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // uninstallPart — in-house, broken:false → returns +1 to onHand
  // -------------------------------------------------------------------------

  describe('uninstallPart in-house broken:false', () => {
    it('returns part to onHand, removes upgradeCurrent slot, writes ONE audit entry (part_returned)', async () => {
      // Arrange — install first so there is a slot to remove
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_SSD }]
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)
      await repo2.receiveParts([{ skuId: SKU_SSD.id, qty: 5 }], ACTOR)
      await repo2.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR) // onHand = 4, 1 slot
      const onHandAfterInstall = (await repo2.loadReferenceData()).parts.find(p => p.id === SKU_SSD.id)?.onHand ?? 0
      const logsBefore = store2.logs.length

      // Act
      await repo2.uninstallPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        broken: false,
        serviceReplace: false,
      }, ACTOR)

      // Assert — ONE audit entry
      expect(store2.logs).toHaveLength(logsBefore + 1)
      expect(store2.logs[store2.logs.length - 1]!.action).toBe('part_returned')

      // Assert — onHand +1 (returned to stock)
      const ref = await repo2.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      expect(ssd?.onHand).toBe(onHandAfterInstall + 1)

      // Assert — slot removed from upgradeCurrent
      const pa = ref.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)
      expect(pa?.upgradeCurrent).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // uninstallPart — in-house, broken:true → +1 broken, onHand unchanged
  // -------------------------------------------------------------------------

  describe('uninstallPart in-house broken:true', () => {
    it('increments broken count, leaves onHand unchanged, writes ONE audit entry (part_scrapped)', async () => {
      // Arrange
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_RAM }]
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)
      await repo2.receiveParts([{ skuId: SKU_RAM.id, qty: 3 }], ACTOR)
      await repo2.installPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)
      // After receive(3) + install(1): onHand = 2
      const onHandAfterInstall = (await repo2.loadReferenceData()).parts.find(p => p.id === SKU_RAM.id)?.onHand ?? 0
      const brokenBefore = (await repo2.loadReferenceData()).parts.find(p => p.id === SKU_RAM.id)?.broken ?? 0
      const logsBefore = store2.logs.length

      // Act
      await repo2.uninstallPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        broken: true,
        serviceReplace: false,
      }, ACTOR)

      // Assert — ONE audit entry
      expect(store2.logs).toHaveLength(logsBefore + 1)
      expect(store2.logs[store2.logs.length - 1]!.action).toBe('part_scrapped')

      // Assert — onHand UNCHANGED
      const ref = await repo2.loadReferenceData()
      const ram = ref.parts.find(p => p.id === SKU_RAM.id)
      expect(ram?.onHand).toBe(onHandAfterInstall)

      // Assert — broken +1
      expect(ram?.broken).toBe(brokenBefore + 1)
    })
  })

  // -------------------------------------------------------------------------
  // uninstallPart — serviceReplace:true → stock unchanged, audit written
  // -------------------------------------------------------------------------

  describe('uninstallPart serviceReplace:true', () => {
    it('leaves stock unchanged and writes ONE audit entry', async () => {
      // Arrange — laptop with one SSD slot installed via service
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_SSD }]
      const movements: PartMovement[] = []
      const installedSlot: UpgradeSlot = {
        kind: 'storage',
        spec: 'SSD 256 ГБ',
        storageType: 'SSD',
        installedAt: '2026-01-01T00:00:00.000Z',
        replaced: false,
      }
      const partsAssets = [makePartsAsset(ASSET_LAPTOP_ID, CAT_LAPTOP, [{ ...installedSlot }])]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)
      await repo2.receiveParts([{ skuId: SKU_SSD.id, qty: 3 }], ACTOR)
      const onHandBefore = (await repo2.loadReferenceData()).parts.find(p => p.id === SKU_SSD.id)?.onHand ?? 0
      const logsBefore = store2.logs.length

      // Act
      await repo2.uninstallPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_LAPTOP_ID,
        assetInvCode: 'INV/laptop',
        assetCategoryId: CAT_LAPTOP,
        broken: false,
        serviceReplace: true,
      }, ACTOR)

      // Assert — ONE audit entry
      expect(store2.logs).toHaveLength(logsBefore + 1)

      // Assert — stock UNCHANGED (service operation)
      const ref = await repo2.loadReferenceData()
      const ssd = ref.parts.find(p => p.id === SKU_SSD.id)
      expect(ssd?.onHand).toBe(onHandBefore)
    })
  })

  // -------------------------------------------------------------------------
  // createGpu
  // -------------------------------------------------------------------------

  describe('createGpu', () => {
    it('registers a new GPU SKU and writes ONE audit entry (gpu_created)', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      const logsBefore = store.logs.length

      // Act
      const { value: newGpu } = await repo.createGpu(
        { name: 'NVIDIA RTX 4060', initialQty: 0 },
        ACTOR,
      )

      // Assert — ONE audit entry
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('gpu_created')

      // Assert — new SKU in catalog with category 'gpu'
      const ref = await repo.loadReferenceData()
      const gpu = ref.parts.find(p => p.id === newGpu.id)
      expect(gpu).toBeDefined()
      expect(gpu?.category).toBe('gpu')
      expect(gpu?.name).toBe('NVIDIA RTX 4060')
    })

    it('with initialQty > 0 the derived onHand equals initialQty via seeded receive movement', async () => {
      // Arrange
      const { repo, store } = makeRepo()

      // Act
      const { value: newGpu } = await repo.createGpu(
        { name: 'AMD RX 7900', initialQty: 4 },
        ACTOR,
      )

      // Assert — onHand reflects the seeded receive
      const ref = await repo.loadReferenceData()
      const gpu = ref.parts.find(p => p.id === newGpu.id)
      expect(gpu?.onHand).toBe(4)

      // Assert — still only ONE audit entry (createGpu wraps everything in one withAudit)
      expect(store.logs.filter(l => l.action === 'gpu_created')).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // deleteGpu
  // -------------------------------------------------------------------------

  describe('deleteGpu', () => {
    it('succeeds and removes the GPU SKU when not currently installed on any asset', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      const { value: gpu } = await repo.createGpu({ name: 'GPU To Delete', initialQty: 2 }, ACTOR)
      const logsBefore = store.logs.length

      // Act
      await repo.deleteGpu(gpu.id, ACTOR)

      // Assert — ONE audit entry
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('deleted')

      // Assert — GPU no longer in catalog
      const ref = await repo.loadReferenceData()
      const gone = ref.parts.find(p => p.id === gpu.id)
      expect(gone).toBeUndefined()
    })

    it('throws when the GPU is currently installed on an asset (blocked)', async () => {
      // Arrange — create GPU, seed stock, then "install" it on a desktop
      // We simulate having a gpu installed by pushing a net-positive install movement.
      // The adapter computes: totalReceived − onHand − broken = installedCount.
      // So: receive(2) + install(1) → totalReceived=2, onHand=1, installedCount=1.
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts: Part[] = []
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)

      // Create GPU with initialQty=2 (receive movement added)
      const { value: gpu } = await repo2.createGpu({ name: 'Installed GPU', initialQty: 2 }, ACTOR)

      // Install 1 unit onto the desktop
      await repo2.installPart({
        skuId: gpu.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      // Act + Assert — must throw because 1 unit is installed
      await expect(repo2.deleteGpu(gpu.id, ACTOR)).rejects.toThrow(/installed/i)
    })

    it('throws when SKU id does not exist', async () => {
      // Arrange
      const { repo } = makeRepo()

      // Act + Assert
      await expect(repo.deleteGpu('nonexistent_gpu', ACTOR)).rejects.toThrow(/not found/i)
    })

    it('throws when SKU is not a GPU category', async () => {
      // Arrange
      const { repo } = makeRepo()

      // Act + Assert
      await expect(repo.deleteGpu(SKU_SSD.id, ACTOR)).rejects.toThrow(/not a gpu/i)
    })
  })

  // -------------------------------------------------------------------------
  // Audit invariant: every mutating call writes exactly ONE entry
  // -------------------------------------------------------------------------

  describe('Audit invariant (§3) — every mutating call writes exactly 1 log entry', () => {
    it('receiveParts delta is +1', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.receiveParts([{ skuId: SKU_SSD.id, qty: 1 }], ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('installPart delta is +1', async () => {
      const { repo, store } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 5)
      const before = store.logs.length
      await repo.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('uninstallPart delta is +1', async () => {
      const { repo, store } = makeRepo()
      await seedStock(repo, SKU_RAM.id, 5)
      await repo.installPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)
      const before = store.logs.length
      await repo.uninstallPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        broken: false,
        serviceReplace: false,
      }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('createGpu delta is +1 regardless of initialQty', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.createGpu({ name: 'GPU Audit Test', initialQty: 10 }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })

    it('deleteGpu delta is +1', async () => {
      const { repo, store } = makeRepo()
      const { value: gpu } = await repo.createGpu({ name: 'GPU Del', initialQty: 0 }, ACTOR)
      const before = store.logs.length
      await repo.deleteGpu(gpu.id, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // loadReferenceData always reflects current state
  // -------------------------------------------------------------------------

  describe('loadReferenceData snapshot consistency', () => {
    it('returns freshly recomputed snapshots after each mutation', async () => {
      // Arrange
      const { repo } = makeRepo()

      // Act — receive then install
      await repo.receiveParts([{ skuId: SKU_NVME.id, qty: 6 }], ACTOR)
      let ref = await repo.loadReferenceData()
      expect(ref.parts.find(p => p.id === SKU_NVME.id)?.onHand).toBe(6)

      await repo.installPart({
        skuId: SKU_NVME.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      ref = await repo.loadReferenceData()
      expect(ref.parts.find(p => p.id === SKU_NVME.id)?.onHand).toBe(5)
    })
  })

  // -------------------------------------------------------------------------
  // Error paths — SKU not found, partsAsset not found
  // -------------------------------------------------------------------------

  describe('error paths', () => {
    it('installPart throws when SKU not found', async () => {
      const { repo } = makeRepo()
      await expect(repo.installPart({
        skuId: 'nonexistent_sku',
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)).rejects.toThrow(/not found/i)
    })

    it('installPart throws when partsAsset not found', async () => {
      const { repo } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 5)
      await expect(repo.installPart({
        skuId: SKU_SSD.id,
        assetId: 'nonexistent_asset',
        assetInvCode: 'INV/x',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)).rejects.toThrow(/not found/i)
    })

    it('uninstallPart throws when SKU not found', async () => {
      const { repo } = makeRepo()
      await expect(repo.uninstallPart({
        skuId: 'nonexistent_sku',
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        broken: false,
        serviceReplace: false,
      }, ACTOR)).rejects.toThrow(/not found/i)
    })
  })

  // -------------------------------------------------------------------------
  // recordService
  // -------------------------------------------------------------------------

  describe('recordService', () => {
    it('appends exactly one movement of type "service" to the journal', async () => {
      // Arrange
      const { repo } = makeRepo()
      const refBefore = await repo.loadReferenceData()
      const movementCountBefore = refBefore.movements.length

      // Act
      await repo.recordService(
        {
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/asset_desktop_1',
          kindId: 'ram',
          kindLabel: 'Замена оперативной памяти',
          note: 'Плановое ТО',
        },
        ACTOR,
      )

      // Assert — exactly one new movement in the journal
      const refAfter = await repo.loadReferenceData()
      expect(refAfter.movements).toHaveLength(movementCountBefore + 1)

      // Assert — the new movement has type 'service'
      // loadReferenceData returns movements newest-first, so [0] is the freshly appended one
      const svcMovement = refAfter.movements[0]!
      expect(svcMovement.type).toBe('service')
    })

    it('the service movement appears in listMovementsForAsset for the target asset', async () => {
      // Arrange
      const { repo } = makeRepo()

      // Act
      await repo.recordService(
        {
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/asset_desktop_1',
          kindId: 'ssd',
          kindLabel: 'Диагностика SSD',
        },
        ACTOR,
      )

      // Assert — appears in per-asset movement list
      const assetMovements = await repo.listMovementsForAsset(ASSET_DESKTOP_ID)
      expect(assetMovements.length).toBeGreaterThanOrEqual(1)
      const svcMv = assetMovements.find(m => m.type === 'service')
      expect(svcMv).toBeDefined()
      expect(svcMv!.assetId).toBe(ASSET_DESKTOP_ID)
    })

    it('writes exactly ONE audit entry with entityType "part_movement" and action "part_serviced"', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      const logsBefore = store.logs.length

      // Act
      await repo.recordService(
        {
          assetId: ASSET_LAPTOP_ID,
          assetInvCode: 'INV/asset_laptop_1',
          kindId: 'cooler',
          kindLabel: 'Чистка от пыли',
        },
        ACTOR,
      )

      // Assert — delta is exactly 1
      expect(store.logs.length - logsBefore).toBe(1)

      // Assert — correct entityType and action
      const lastLog = store.logs[store.logs.length - 1]!
      expect(lastLog.entityType).toBe('part_movement')
      expect(lastLog.action).toBe('part_serviced')
    })

    it('is stock-neutral: onHand and broken for any SKU are unchanged after recordService', async () => {
      // Arrange — seed some real stock so we have non-zero values to assert on
      const { repo } = makeRepo()
      await repo.receiveParts([{ skuId: SKU_SSD.id, qty: 7 }], ACTOR)
      await repo.receiveParts([{ skuId: SKU_RAM.id, qty: 4 }], ACTOR)

      const refBefore = await repo.loadReferenceData()
      const ssdBefore = refBefore.parts.find(p => p.id === SKU_SSD.id)!
      const ramBefore = refBefore.parts.find(p => p.id === SKU_RAM.id)!

      // Act
      await repo.recordService(
        {
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/asset_desktop_1',
          kindId: 'ssd',
          kindLabel: 'Плановая диагностика',
          note: null,
        },
        ACTOR,
      )

      // Assert — onHand and broken for EVERY SKU unchanged
      const refAfter = await repo.loadReferenceData()
      const ssdAfter = refAfter.parts.find(p => p.id === SKU_SSD.id)!
      const ramAfter = refAfter.parts.find(p => p.id === SKU_RAM.id)!

      expect(ssdAfter.onHand).toBe(ssdBefore.onHand)
      expect(ssdAfter.broken).toBe(ssdBefore.broken)
      expect(ramAfter.onHand).toBe(ramBefore.onHand)
      expect(ramAfter.broken).toBe(ramBefore.broken)
    })

    it('workingStock of any SKU is unaffected by recordService', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.receiveParts([{ skuId: SKU_NVME.id, qty: 3 }], ACTOR)

      const refBefore = await repo.loadReferenceData()
      const nvmeBefore = refBefore.parts.find(p => p.id === SKU_NVME.id)!
      const workingBefore = Math.max(0, nvmeBefore.onHand - nvmeBefore.broken)

      // Act
      await repo.recordService(
        {
          assetId: ASSET_SERVER_ID,
          assetInvCode: 'INV/asset_server_1',
          kindId: 'nvme',
          kindLabel: 'Проверка NVMe',
        },
        ACTOR,
      )

      // Assert — workingStock unchanged
      const refAfter = await repo.loadReferenceData()
      const nvmeAfter = refAfter.parts.find(p => p.id === SKU_NVME.id)!
      const workingAfter = Math.max(0, nvmeAfter.onHand - nvmeAfter.broken)
      expect(workingAfter).toBe(workingBefore)
    })

    it('does NOT mutate upgradeCurrent on the target asset', async () => {
      // Arrange — install a part first so upgradeCurrent is non-empty
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts = [{ ...SKU_SSD }]
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)

      await repo2.receiveParts([{ skuId: SKU_SSD.id, qty: 5 }], ACTOR)
      await repo2.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      const refBefore = await repo2.loadReferenceData()
      const paBefore = refBefore.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)!
      const ucLengthBefore = paBefore.upgradeCurrent.length
      const ucSnapshotBefore = JSON.stringify(paBefore.upgradeCurrent)

      // Act
      await repo2.recordService(
        {
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/desktop',
          kindId: 'ssd',
          kindLabel: 'Обслуживание SSD',
        },
        ACTOR,
      )

      // Assert — upgradeCurrent length identical
      const refAfter = await repo2.loadReferenceData()
      const paAfter = refAfter.partsAssets.find(a => a.assetId === ASSET_DESKTOP_ID)!
      expect(paAfter.upgradeCurrent).toHaveLength(ucLengthBefore)
      // Assert — content identical (deep equality via JSON round-trip snapshot)
      expect(JSON.stringify(paAfter.upgradeCurrent)).toBe(ucSnapshotBefore)
    })

    it('the movement carries kindId, kindLabel, note, reason===kindLabel, qty===0, and a falsy skuId', async () => {
      // Arrange
      const { repo } = makeRepo()
      const kindLabel = 'Замена термопасты'

      // Act
      const { value: mv } = await repo.recordService(
        {
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/asset_desktop_1',
          kindId: 'cooler',
          kindLabel,
          note: 'Видимый перегрев',
        },
        ACTOR,
      )

      // Assert — SKU-less fields
      expect(!mv.skuId).toBe(true)        // falsy — '' or null both acceptable
      expect(mv.qty).toBe(0)
      expect(mv.kindId).toBe('cooler')
      expect(mv.kindLabel).toBe(kindLabel)
      expect(mv.reason).toBe(kindLabel)   // reason === kindLabel per spec
      expect(mv.note).toBe('Видимый перегрев')
      expect(mv.type).toBe('service')
      expect(mv.broken).toBe(false)
      expect(mv.serviceReplace).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // InsufficientStockError — P1.1 server-side stock guard
  // -------------------------------------------------------------------------

  describe('InsufficientStockError — server-side stock guard', () => {
    it('installPart throws InsufficientStockError when onHand is 0 for an in-house device', async () => {
      // Arrange — no stock seeded; onHand = 0
      const { repo } = makeRepo()

      // Act + Assert — must throw InsufficientStockError, NOT a generic error
      let caught: unknown
      try {
        await repo.installPart({
          skuId: SKU_SSD.id,
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/desktop',
          assetCategoryId: CAT_DESKTOP,
          action: 'install',
          replaceUcIndex: null,
          oldIsBroken: false,
          serviceReplace: false,
        }, ACTOR)
      } catch (e) {
        caught = e
      }
      expect(caught).toBeDefined()
      expect(isInsufficientStockError(caught)).toBe(true)
    })

    it('installPart does NOT throw when onHand > 0 for an in-house device', async () => {
      // Arrange — seed 1 unit
      const { repo } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 1)

      // Act — should succeed, no throw
      await expect(
        repo.installPart({
          skuId: SKU_SSD.id,
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/desktop',
          assetCategoryId: CAT_DESKTOP,
          action: 'install',
          replaceUcIndex: null,
          oldIsBroken: false,
          serviceReplace: false,
        }, ACTOR),
      ).resolves.toBeDefined()
    })

    it('serviceReplace (laptop) with onHand 0 does NOT throw — service bypasses stock', async () => {
      // Arrange — no stock; laptop is service-only
      const { repo } = makeRepo()

      // Act — must NOT throw even with 0 stock
      await expect(
        repo.installPart({
          skuId: SKU_SSD.id,
          assetId: ASSET_LAPTOP_ID,
          assetInvCode: 'INV/laptop',
          assetCategoryId: CAT_LAPTOP,
          action: 'install',
          replaceUcIndex: null,
          oldIsBroken: false,
          serviceReplace: true,
        }, ACTOR),
      ).resolves.toBeDefined()
    })

    it('serviceReplace forced by assetCategoryId=cat_laptop with onHand 0 does NOT throw', async () => {
      // Arrange — no stock; category forces isServiceOnly
      const { repo } = makeRepo()

      // Act — cat_laptop → isServiceOnly → serviceReplace=true → no stock debit
      await expect(
        repo.installPart({
          skuId: SKU_RAM.id,
          assetId: ASSET_LAPTOP_ID,
          assetInvCode: 'INV/laptop',
          assetCategoryId: CAT_LAPTOP,
          action: 'install',
          replaceUcIndex: null,
          oldIsBroken: false,
          serviceReplace: false, // overridden by isServiceOnly
        }, ACTOR),
      ).resolves.toBeDefined()
    })

    it('stock guard: no audit entry is written when InsufficientStockError is thrown', async () => {
      // Arrange — no stock
      const { repo, store } = makeRepo()
      const logsBefore = store.logs.length

      // Act
      try {
        await repo.installPart({
          skuId: SKU_SSD.id,
          assetId: ASSET_DESKTOP_ID,
          assetInvCode: 'INV/desktop',
          assetCategoryId: CAT_DESKTOP,
          action: 'install',
          replaceUcIndex: null,
          oldIsBroken: false,
          serviceReplace: false,
        }, ACTOR)
      } catch {
        // expected
      }

      // Assert — no audit entry written (error thrown before withAudit commits)
      expect(store.logs).toHaveLength(logsBefore)
    })

    it('snapshot integrity: two concurrent installs at onHand=1 — second must fail', async () => {
      // Arrange — seed exactly 1 unit
      const { repo } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 1)

      const installInput = {
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install' as const,
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }

      // Act — first install succeeds, second should fail on snapshot check
      await repo.installPart(installInput, ACTOR)

      let secondCaught: unknown
      try {
        await repo.installPart(installInput, ACTOR)
      } catch (e) {
        secondCaught = e
      }

      // Assert — second install throws InsufficientStockError (onHand = 0 after first)
      expect(isInsufficientStockError(secondCaught)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // listMovementsForSku / listMovementsForAsset
  // -------------------------------------------------------------------------

  describe('read methods', () => {
    it('listMovementsForSku returns movements for that SKU only, newest-first', async () => {
      // Arrange
      const { repo } = makeRepo()
      await repo.receiveParts([{ skuId: SKU_SSD.id, qty: 5 }], ACTOR)
      await repo.receiveParts([{ skuId: SKU_RAM.id, qty: 3 }], ACTOR)
      await repo.receiveParts([{ skuId: SKU_SSD.id, qty: 2 }], ACTOR)

      // Act
      const ssdMovements = await repo.listMovementsForSku(SKU_SSD.id)

      // Assert — only SSD movements
      expect(ssdMovements.every(m => m.skuId === SKU_SSD.id)).toBe(true)
      expect(ssdMovements).toHaveLength(2)

      // Assert — newest-first (second receive should come first)
      expect(ssdMovements[0]!.qty).toBe(2)
      expect(ssdMovements[1]!.qty).toBe(5)
    })

    it('listMovementsForAsset returns movements for that asset only', async () => {
      // Arrange
      const { repo } = makeRepo()
      await seedStock(repo, SKU_SSD.id, 5)
      await seedStock(repo, SKU_RAM.id, 5)
      await repo.installPart({
        skuId: SKU_SSD.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)
      await repo.installPart({
        skuId: SKU_RAM.id,
        assetId: ASSET_SERVER_ID,
        assetInvCode: 'INV/server',
        assetCategoryId: CAT_SERVER,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      // Act
      const desktopMovements = await repo.listMovementsForAsset(ASSET_DESKTOP_ID)

      // Assert — only desktop movements
      expect(desktopMovements.every(m => m.assetId === ASSET_DESKTOP_ID)).toBe(true)
      expect(desktopMovements).toHaveLength(1)
      expect(desktopMovements[0]!.skuId).toBe(SKU_SSD.id)
    })
  })

  // -------------------------------------------------------------------------
  // loadReferenceData — partCategories
  // -------------------------------------------------------------------------

  describe('loadReferenceData partCategories', () => {
    it('returns 7 rows sorted by order when no custom catalog is injected', async () => {
      // Arrange — default repo (no catalog injection)
      const { repo } = makeRepo()

      // Act
      const ref = await repo.loadReferenceData()

      // Assert — 7 canonical rows (partCategories is optional in the interface but
      // InMemoryPartRepository always returns it populated — never undefined).
      const cats = ref.partCategories ?? []
      expect(cats).toHaveLength(7)

      // Assert — sorted by order ascending
      const orders = cats.map(c => c.order)
      expect(orders).toEqual([...orders].sort((a, b) => a - b))
    })

    it('ids match DEFAULT_PART_CATEGORY_DEFS exactly', async () => {
      const { repo } = makeRepo()
      const ref = await repo.loadReferenceData()
      const ids = (ref.partCategories ?? []).map(c => c.id).sort()
      const expectedIds = DEFAULT_PART_CATEGORY_DEFS.map(d => d.id).sort()
      expect(ids).toEqual(expectedIds)
    })

    it('all entries have string timestamps (non-empty)', async () => {
      const { repo } = makeRepo()
      const ref = await repo.loadReferenceData()
      for (const cat of ref.partCategories ?? []) {
        expect(typeof cat.createdAt).toBe('string')
        expect(cat.createdAt.length).toBeGreaterThan(0)
        expect(typeof cat.updatedAt).toBe('string')
      }
    })

    it('custom injected catalog is served instead of defaults', async () => {
      // Arrange — inject a 1-entry catalog
      const customDef: PartCategoryDef = {
        id: 'dock', name: { ru: 'Доки', en: 'Docking stations', hy: 'Դոկ' },
        icon: 'dock', tintToken: 'rose', order: 10, behavior: 'models', slotKind: 'gpu',
        storageType: null, familyOverrides: null, variants: null, generations: null,
        active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }
      const store = createInMemoryAuditStore()
      const audit = inMemoryAuditContext(store)
      const repo = new InMemoryPartRepository([], [], [], audit, [customDef])

      // Act
      const ref = await repo.loadReferenceData()

      // Assert — only the injected catalog, not defaults
      const cats = ref.partCategories ?? []
      expect(cats).toHaveLength(1)
      expect(cats[0]!.id).toBe('dock')
    })
  })

  // -------------------------------------------------------------------------
  // createModelSku — generalized GPU path
  // -------------------------------------------------------------------------

  describe('createModelSku', () => {
    it('with categoryId gpu produces IDENTICAL id prefix / name / threshold as legacy createGpu', async () => {
      // Arrange
      const { repo, store } = makeRepo()
      const logsBefore = store.logs.length

      // Act — create via createModelSku with categoryId 'gpu'
      const { value: newSku } = await repo.createModelSku(
        { categoryId: 'gpu', name: 'NVIDIA RTX 4090', initialQty: 0 },
        ACTOR,
      )

      // Assert — ONE audit entry with action 'gpu_created' (backward compat)
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('gpu_created')

      // Assert — id starts with 'gpu_' (same scheme as legacy createGpu)
      expect(newSku.id).toMatch(/^gpu_/)

      // Assert — category and threshold match legacy
      const ref = await repo.loadReferenceData()
      const sku = ref.parts.find(p => p.id === newSku.id)
      expect(sku).toBeDefined()
      expect(sku?.category).toBe('gpu')
      expect(sku?.lowStockThreshold).toBe(5)
      expect(sku?.name).toBe('NVIDIA RTX 4090')
    })

    it('with categoryId gpu and initialQty > 0 sets onHand correctly', async () => {
      const { repo, store } = makeRepo()
      const { value: newSku } = await repo.createModelSku(
        { categoryId: 'gpu', name: 'RX 7900', initialQty: 3 },
        ACTOR,
      )
      // ONE audit entry total (receive wrapped in the same withAudit)
      expect(store.logs.filter(l => l.action === 'gpu_created')).toHaveLength(1)
      const ref = await repo.loadReferenceData()
      const sku = ref.parts.find(p => p.id === newSku.id)
      expect(sku?.onHand).toBe(3)
    })

    it('with a custom models-category uses action model_sku_created', async () => {
      // Arrange — inject a custom catalog with a 'dock' models-category
      const customDef: PartCategoryDef = {
        id: 'dock', name: { ru: 'Доки', en: 'Docking stations', hy: 'Դոկ' },
        icon: 'dock', tintToken: 'rose', order: 10, behavior: 'models', slotKind: 'gpu',
        storageType: null, familyOverrides: null, variants: null, generations: null,
        active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }
      const store = createInMemoryAuditStore()
      const audit = inMemoryAuditContext(store)
      const repo = new InMemoryPartRepository([], [], [], audit, [customDef])
      const logsBefore = store.logs.length

      // Act
      const { value: newSku } = await repo.createModelSku(
        { categoryId: 'dock', name: 'Lenovo ThinkPad Dock', initialQty: 0 },
        ACTOR,
      )

      // Assert — action is 'model_sku_created', NOT 'gpu_created'
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('model_sku_created')

      // Assert — id starts with 'dock_'
      expect(newSku.id).toMatch(/^dock_/)
      expect(newSku.category).toBe('dock')
    })

    it('rejects a sized category (e.g. ram) with InvalidCategoryBehaviorError', async () => {
      // Arrange — default catalog (ram has behavior:'sized')
      const { repo } = makeRepo()

      // Act + Assert
      let caught: unknown
      try {
        await repo.createModelSku({ categoryId: 'ram', name: 'Kingston 32GB', initialQty: 0 }, ACTOR)
      } catch (e) {
        caught = e
      }
      expect(caught).toBeDefined()
      expect(isInvalidCategoryBehaviorError(caught)).toBe(true)
    })

    it('rejects a single category (e.g. psu) with InvalidCategoryBehaviorError', async () => {
      const { repo } = makeRepo()
      await expect(
        repo.createModelSku({ categoryId: 'psu', name: 'Corsair 650W', initialQty: 0 }, ACTOR),
      ).rejects.toSatisfy(isInvalidCategoryBehaviorError)
    })

    it('rejects an unknown category (not in catalog) unless it is gpu', async () => {
      const { repo } = makeRepo()
      await expect(
        repo.createModelSku({ categoryId: 'nonexistent', name: 'Test', initialQty: 0 }, ACTOR),
      ).rejects.toSatisfy(isInvalidCategoryBehaviorError)
    })

    it('writes exactly ONE audit entry regardless of initialQty', async () => {
      const { repo, store } = makeRepo()
      const before = store.logs.length
      await repo.createModelSku({ categoryId: 'gpu', name: 'Audit GPU', initialQty: 10 }, ACTOR)
      expect(store.logs.length - before).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // createGpu alias — delegates to createModelSku
  // -------------------------------------------------------------------------

  describe('createGpu alias delegates correctly', () => {
    it('still registers a GPU SKU and writes ONE audit entry with action gpu_created', async () => {
      const { repo, store } = makeRepo()
      const logsBefore = store.logs.length

      const { value: newGpu } = await repo.createGpu({ name: 'NVIDIA RTX 4060', initialQty: 0 }, ACTOR)

      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('gpu_created')

      const ref = await repo.loadReferenceData()
      const gpu = ref.parts.find(p => p.id === newGpu.id)
      expect(gpu).toBeDefined()
      expect(gpu?.category).toBe('gpu')
    })
  })

  // -------------------------------------------------------------------------
  // deleteModelSku — generalized delete path
  // -------------------------------------------------------------------------

  describe('deleteModelSku', () => {
    it('succeeds and removes the SKU when not currently installed on any asset', async () => {
      // Arrange — create a gpu SKU then delete it
      const { repo, store } = makeRepo()
      const { value: gpu } = await repo.createModelSku({ categoryId: 'gpu', name: 'GPU To Delete', initialQty: 2 }, ACTOR)
      const logsBefore = store.logs.length

      // Act
      await repo.deleteModelSku(gpu.id, ACTOR)

      // Assert — ONE audit entry
      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('deleted')

      // Assert — SKU no longer in catalog
      const ref = await repo.loadReferenceData()
      const gone = ref.parts.find(p => p.id === gpu.id)
      expect(gone).toBeUndefined()
    })

    it('blocks deletion when the SKU is currently installed on an asset', async () => {
      // Arrange — create GPU, receive 2, install 1
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts: Part[] = []
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)

      const { value: gpu } = await repo2.createModelSku({ categoryId: 'gpu', name: 'Installed GPU', initialQty: 2 }, ACTOR)

      await repo2.installPart({
        skuId: gpu.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      // Act + Assert — must throw because 1 unit is installed
      await expect(repo2.deleteModelSku(gpu.id, ACTOR)).rejects.toThrow(/installed/i)
    })

    it('throws when SKU id does not exist', async () => {
      const { repo } = makeRepo()
      await expect(repo.deleteModelSku('nonexistent_sku', ACTOR)).rejects.toThrow(/not found/i)
    })
  })

  // -------------------------------------------------------------------------
  // deleteGpu alias — backwards-compat guards preserved
  // -------------------------------------------------------------------------

  describe('deleteGpu alias', () => {
    it('succeeds and removes the GPU SKU when not installed (same behavior as before)', async () => {
      const { repo, store } = makeRepo()
      const { value: gpu } = await repo.createGpu({ name: 'GPU For Delete', initialQty: 2 }, ACTOR)
      const logsBefore = store.logs.length

      await repo.deleteGpu(gpu.id, ACTOR)

      expect(store.logs).toHaveLength(logsBefore + 1)
      expect(store.logs[store.logs.length - 1]!.action).toBe('deleted')

      const ref = await repo.loadReferenceData()
      expect(ref.parts.find(p => p.id === gpu.id)).toBeUndefined()
    })

    it('throws when GPU is currently installed (same guard as before)', async () => {
      const store2 = createInMemoryAuditStore()
      const audit2 = inMemoryAuditContext(store2)
      const parts: Part[] = []
      const movements: PartMovement[] = []
      const partsAssets = [makePartsAsset(ASSET_DESKTOP_ID, CAT_DESKTOP)]
      const repo2 = new InMemoryPartRepository(parts, movements, partsAssets, audit2)

      const { value: gpu } = await repo2.createGpu({ name: 'Installed GPU', initialQty: 2 }, ACTOR)
      await repo2.installPart({
        skuId: gpu.id,
        assetId: ASSET_DESKTOP_ID,
        assetInvCode: 'INV/desktop',
        assetCategoryId: CAT_DESKTOP,
        action: 'install',
        replaceUcIndex: null,
        oldIsBroken: false,
        serviceReplace: false,
      }, ACTOR)

      await expect(repo2.deleteGpu(gpu.id, ACTOR)).rejects.toThrow(/installed/i)
    })

    it('throws when SKU id does not exist (same as before)', async () => {
      const { repo } = makeRepo()
      await expect(repo.deleteGpu('nonexistent_gpu', ACTOR)).rejects.toThrow(/not found/i)
    })

    it('throws when SKU is not a GPU category (legacy category guard preserved)', async () => {
      const { repo } = makeRepo()
      await expect(repo.deleteGpu(SKU_SSD.id, ACTOR)).rejects.toThrow(/not a gpu/i)
    })
  })
})
