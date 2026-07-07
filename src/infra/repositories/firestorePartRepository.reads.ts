/**
 * Read-only query functions for the parts warehouse Firestore adapter.
 * These functions contain no mutations, no transactions, and no audit writes.
 */

import {
  collection,
  getDocs,
  query as fsQuery,
  orderBy,
  type Firestore,
} from 'firebase/firestore'
import type { PartReferenceData } from '@/domain/part/PartRepository'
import type { Part, PartMovement, PartsAsset } from '@/domain/part/types'
import type { AssetSpecs } from '@/domain/asset/types'
import {
  deriveStock,
  assetFamilyOf,
  resolveUpgradeCurrent,
} from '@/domain/part/partStock'
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

export async function fsLoadReferenceData(fsDb: Firestore): Promise<PartReferenceData> {
  // Read parts, movements, upgradeable assets, and categories in parallel.
  const [partsSnap, movementsSnap, assetsSnap, categoriesSnap] = await Promise.all([
    getDocs(collection(fsDb, COL_PARTS)),
    getDocs(fsQuery(collection(fsDb, COL_MOVEMENTS), orderBy('at', 'desc'))),
    getDocs(collection(fsDb, COL_ASSETS)),
    getDocs(collection(fsDb, COL_CATEGORIES)),
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

  // Recompute stock snapshots from the authoritative journal
  const stockMap = deriveStock(movements)

  const parts: Part[] = partsSnap.docs.map(d => {
    const p = toPart(d.id, d.data() as Record<string, unknown>)
    const s = stockMap[p.id] ?? { onHand: 0, broken: 0 }
    return { ...p, onHand: s.onHand, broken: s.broken }
  })

  // Build partsAssets projection: only upgradeable categories
  const partsAssets: PartsAsset[] = []
  for (const d of assetsSnap.docs) {
    const data = d.data() as Record<string, unknown>
    const categoryId = String(data['categoryId'] ?? '')
    if (!UPGRADEABLE_CATEGORY_IDS.has(categoryId)) continue

    const family = assetFamilyOf(categoryId)
    const kind = family === 'server' ? 'Сетевые Устройство' : categoryId

    const brand = (data['brand'] as string | null) ?? ''
    const model = (data['model'] as string | null) ?? ''
    const name = [brand, model].filter(Boolean).join(' ') || d.id

    // User: try assignment.employeeId display or fallback to empty
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

  return { parts, movements, partsAssets }
}

export async function fsListMovementsForSku(
  fsDb: Firestore,
  skuId: string,
): Promise<PartMovement[]> {
  // Uses the composite index (skuId, at desc)
  // Note: Firestore where() requires an index — caller must ensure it exists.
  // For MVP simplicity, load all and filter (index on at desc is still used).
  const snap = await getDocs(
    fsQuery(collection(fsDb, COL_MOVEMENTS), orderBy('at', 'desc')),
  )
  return snap.docs
    .map(d => toMovement(d.id, d.data() as Record<string, unknown>))
    .filter(m => m.skuId === skuId)
}

export async function fsListMovementsForAsset(
  fsDb: Firestore,
  assetId: string,
): Promise<PartMovement[]> {
  const snap = await getDocs(
    fsQuery(collection(fsDb, COL_MOVEMENTS), orderBy('at', 'desc')),
  )
  return snap.docs
    .map(d => toMovement(d.id, d.data() as Record<string, unknown>))
    .filter(m => m.assetId === assetId)
}
