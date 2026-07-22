/**
 * Read-only query functions for the parts warehouse Firestore adapter.
 * These functions contain no mutations, no transactions, and no audit writes.
 *
 * P1.2 (senior audit): fsListMovementsForSku / fsListMovementsForAsset now use
 * server-side where() + orderBy() instead of loading the full collection and
 * filtering on the client. The composite indexes (skuId+at desc, assetId+at desc)
 * already exist in firestore.indexes.json — no new indexes required.
 *
 * Read-path snapshot decision (senior audit):
 *   After the P1.1 transition to transactional deltas the SKU onHand/broken
 *   snapshot is the authoritative value. fsLoadReferenceData now trusts the stored
 *   snapshot and does NOT re-derive stock from the full movement journal.
 *   Rationale: the full-journal re-derive was the original "self-healing" fallback
 *   for when snapshots were untrustworthy. With every write path going through
 *   atomic transactions (withAudit + incremental delta) the snapshot IS the source
 *   of truth. Removing the re-derive eliminates the last full-collection read in
 *   the hot path. If a manual Firestore edit ever corrupts a snapshot, an admin
 *   can trigger a one-time recalculation via a Cloud Function (deferred to Phase 2).
 *   The domain helper deriveStock() is still used by components for display from
 *   already-loaded movements — it is NOT called here.
 */

import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
  type Firestore,
} from 'firebase/firestore'
import type { PartReferenceData } from '@/domain/part/PartRepository'
import type { Part, PartMovement, PartsAsset } from '@/domain/part/types'
import { SERVER_FAMILY_KIND_LABEL } from '@/domain/part/types'
import type { AssetSpecs } from '@/domain/asset/types'
import { assetFamilyOf, resolveUpgradeCurrent } from '@/domain/part/partStock'
import type { PartCategoryDef, PartCategoryBehavior, PartCategoryVariant } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import { toIso } from './firestoreUtils'
import {
  COL_PARTS,
  COL_MOVEMENTS,
  COL_ASSETS,
  COL_CATEGORIES,
  UPGRADEABLE_CATEGORY_IDS,
  toPart,
  toMovement,
  toUpgradeSlots,
} from './firestorePartRepository.mappers'

const COL_PART_CATEGORIES = 'part_categories'

const FALLBACK_PART_CATEGORY_DEFS: PartCategoryDef[] = DEFAULT_PART_CATEGORY_DEFS.map(d => ({
  ...d,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
}))

function toPartCategoryDef(id: string, d: Record<string, unknown>): PartCategoryDef {
  return {
    id,
    name: (d['name'] as { ru: string; en: string; hy: string }) ?? { ru: '', en: '', hy: '' },
    icon: String(d['icon'] ?? ''),
    tintToken: String(d['tintToken'] ?? ''),
    order: Number(d['order'] ?? 0),
    behavior: (d['behavior'] as PartCategoryBehavior) ?? 'single',
    slotKind: String(d['slotKind'] ?? ''),
    storageType: (d['storageType'] as 'SSD' | 'HDD' | 'M.2' | null) ?? null,
    familyOverrides: (d['familyOverrides'] as Record<string, { slotKind: string }> | null) ?? null,
    variants: (d['variants'] as PartCategoryVariant[] | null) ?? null,
    generations: (d['generations'] as PartCategoryVariant[] | null) ?? null,
    active: Boolean(d['active'] ?? true),
    createdAt: toIso(d['createdAt']),
    updatedAt: toIso(d['updatedAt']),
  }
}

export async function fsLoadReferenceData(fsDb: Firestore): Promise<PartReferenceData> {
  // Read parts, upgradeable assets, asset-categories, and part-categories in parallel.
  // movements are still fetched for the HistoryPanel / partsAssets tab — but we
  // do NOT re-derive stock from them; we trust the SKU doc snapshot instead.
  const [partsSnap, movementsSnap, assetsSnap, categoriesSnap, partCategoriesSnap] = await Promise.all([
    getDocs(collection(fsDb, COL_PARTS)),
    getDocs(fsQuery(collection(fsDb, COL_MOVEMENTS), orderBy('at', 'desc'))),
    getDocs(collection(fsDb, COL_ASSETS)),
    getDocs(collection(fsDb, COL_CATEGORIES)),
    getDocs(collection(fsDb, COL_PART_CATEGORIES)),
  ])

  // categoryId → { name, lucideIcon } so device cards match the Assets page exactly.
  const categoryMeta = new Map<string, { name: string; icon: string }>()
  for (const c of categoriesSnap.docs) {
    const cd = c.data() as Record<string, unknown>
    categoryMeta.set(c.id, {
      name: String(cd['name'] ?? ''),
      icon: String(cd['lucideIcon'] ?? ''),
    })
  }

  const movements: PartMovement[] = movementsSnap.docs.map(d =>
    toMovement(d.id, d.data() as Record<string, unknown>),
  )

  // Trust the stored snapshot for onHand/broken — no re-derivation from journal.
  // The snapshot is kept consistent by atomic transactional deltas in every write path.
  const parts: Part[] = partsSnap.docs.map(d =>
    toPart(d.id, d.data() as Record<string, unknown>),
  )

  // Build partsAssets projection: only upgradeable categories.
  const partsAssets: PartsAsset[] = []
  for (const d of assetsSnap.docs) {
    const data = d.data() as Record<string, unknown>
    const categoryId = String(data['categoryId'] ?? '')
    if (!UPGRADEABLE_CATEGORY_IDS.has(categoryId)) continue

    const family = assetFamilyOf(categoryId)
    const kind = family === 'server' ? SERVER_FAMILY_KIND_LABEL : categoryId

    const brand = (data['brand'] as string | null) ?? ''
    const model = (data['model'] as string | null) ?? ''
    const name = [brand, model].filter(Boolean).join(' ') || d.id

    const assignment = (data['assignment'] as Record<string, unknown> | null) ?? null
    const user = (assignment?.['employeeId'] as string | null) ?? ''

    const catMeta = categoryMeta.get(categoryId)

    partsAssets.push({
      id: String(data['invCode'] ?? d.id),
      assetId: d.id,
      categoryId,
      kind,
      name,
      user,
      // exactOptionalPropertyTypes: omit the key entirely rather than assign undefined
      ...(catMeta?.name ? { categoryName: catMeta.name } : {}),
      ...(catMeta?.icon ? { categoryIcon: catMeta.icon } : {}),
      // Prefer the asset's explicit upgradeCurrent (mutated by install/uninstall).
      // When empty (asset created via the Assets form, which only stores
      // currentSpecs), synthesize the slots from currentSpecs + factory defaults
      // so the «Установлено» tab shows what was created in the Assets section.
      upgradeCurrent: resolveUpgradeCurrent(
        categoryId,
        (data['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
        toUpgradeSlots(data['upgradeCurrent']),
      ),
    })
  }

  // Build partCategories — fallback to DEFAULT_PART_CATEGORY_DEFS when collection is empty.
  // Sort by order ascending (consistent with PartCategoryRepository.listAll()).
  let partCategories: PartCategoryDef[]
  if (partCategoriesSnap.empty) {
    partCategories = FALLBACK_PART_CATEGORY_DEFS
  } else {
    partCategories = partCategoriesSnap.docs
      .map(d => toPartCategoryDef(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.order - b.order)
  }

  return { parts, movements, partsAssets, partCategories }
}

/**
 * P1.2: server-side filter on skuId using the composite index
 * (part_movements: skuId ASC, at DESC) already registered in firestore.indexes.json.
 */
export async function fsListMovementsForSku(
  fsDb: Firestore,
  skuId: string,
): Promise<PartMovement[]> {
  const snap = await getDocs(
    fsQuery(
      collection(fsDb, COL_MOVEMENTS),
      where('skuId', '==', skuId),
      orderBy('at', 'desc'),
    ),
  )
  return snap.docs.map(d => toMovement(d.id, d.data() as Record<string, unknown>))
}

/**
 * P1.2: server-side filter on assetId using the composite index
 * (part_movements: assetId ASC, at DESC) already registered in firestore.indexes.json.
 */
export async function fsListMovementsForAsset(
  fsDb: Firestore,
  assetId: string,
): Promise<PartMovement[]> {
  const snap = await getDocs(
    fsQuery(
      collection(fsDb, COL_MOVEMENTS),
      where('assetId', '==', assetId),
      orderBy('at', 'desc'),
    ),
  )
  return snap.docs.map(d => toMovement(d.id, d.data() as Record<string, unknown>))
}
