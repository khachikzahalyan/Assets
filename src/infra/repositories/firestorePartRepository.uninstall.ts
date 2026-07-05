/**
 * Uninstall write transaction for the parts warehouse Firestore adapter:
 *   - fsUninstallPart — port of prototype handleUninstallConfirm (parts.html 3411-3463)
 *
 * ONE withAudit transaction atomically: reads asset + SKU docs, writes the
 * uninstall movement doc, removes the matching upgradeCurrent slot, recomputes
 * the SKU stock snapshot, and writes one audit_logs entry.
 *
 * See firestorePartRepository.install.ts for the counterpart fsInstallPart.
 */

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { UninstallInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement, UpgradeSlot } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import {
  deriveStock,
  slotKindForSku,
  assetFamilyOf,
  currentPartsForSkuCategory,
  isServiceOnly,
  resolveUpgradeCurrent,
} from '@/domain/part/partStock'
import type { AssetSpecs } from '@/domain/asset/types'
import {
  COL_PARTS,
  COL_MOVEMENTS,
  COL_ASSETS,
  toMovement,
  toUpgradeSlots,
} from './firestorePartRepository.mappers'

export async function fsUninstallPart(
  fsDb: Firestore,
  input: UninstallInput,
  actor: Actor,
): Promise<AuditedResult<PartMovement>> {
  const skuRef = doc(fsDb, COL_PARTS, input.skuId)
  const assetRef = doc(fsDb, COL_ASSETS, input.assetId)
  const mvRef = doc(collection(fsDb, COL_MOVEMENTS))

  const allMovementsSnap = await getDocs(collection(fsDb, COL_MOVEMENTS))
  const allMovements = allMovementsSnap.docs.map(d =>
    toMovement(d.id, d.data() as Record<string, unknown>),
  )

  const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace
  const family = assetFamilyOf(input.assetCategoryId)

  const auditAction = input.broken ? 'part_scrapped' : 'part_returned'

  let reason: string
  if (serviceReplace) {
    reason = 'Снято как заменённое через сервис'
  } else if (input.broken) {
    reason = 'Снято как неисправное'
  } else {
    reason = 'Снятие с актива · возврат на склад'
  }

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part',
      entityId: input.assetId,
      action: auditAction,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: null,
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      const [skuSnap, assetSnap] = await Promise.all([
        t.get(skuRef),
        t.get(assetRef),
      ])
      if (!skuSnap.exists()) throw new Error(`uninstallPart: SKU not found: ${input.skuId}`)
      if (!assetSnap.exists()) throw new Error(`uninstallPart: asset not found: ${input.assetId}`)

      const partData = skuSnap.data() as Record<string, unknown>
      const partCategory = partData['category'] as Part['category']

      const assetData = assetSnap.data() as Record<string, unknown>
      const upgradeCurrent: UpgradeSlot[] = resolveUpgradeCurrent(
        input.assetCategoryId,
        (assetData['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
        toUpgradeSlots(assetData['upgradeCurrent']),
      )
      const ucBefore = upgradeCurrent.map(s => ({ ...s }))

      const at = new Date().toISOString()
      const mv: PartMovement = {
        id: mvRef.id,
        type: 'uninstall',
        skuId: input.skuId,
        qty: 1,
        broken: serviceReplace ? false : input.broken,
        assetId: input.assetId,
        assetInvCode: input.assetInvCode,
        serviceReplace,
        note: input.note ?? null,
        reason,
        actorUid: actor.uid,
        actorRole: actor.role,
        at,
      }
      t.set(mvRef, {
        type: mv.type, skuId: mv.skuId, qty: mv.qty, broken: mv.broken,
        assetId: mv.assetId, assetInvCode: mv.assetInvCode,
        serviceReplace: mv.serviceReplace, note: mv.note, reason: mv.reason,
        actorUid: mv.actorUid, actorRole: mv.actorRole, at: serverTimestamp(),
      })

      // Remove matching slot from upgradeCurrent
      const ucMutated = [...upgradeCurrent.map(s => ({ ...s }))]
      const slotKind = slotKindForSku(partCategory, family)
      if (slotKind) {
        const candidates = currentPartsForSkuCategory(ucMutated, partCategory, family)
        const occupied = candidates.filter(c => !c.isEmpty)
        const target = occupied.length > 0
          ? occupied[occupied.length - 1]!
          : candidates[candidates.length - 1]
        if (target) ucMutated.splice(target.idx, 1)
      }

      const ucAfter = ucMutated.map(s => ({ ...s }))

      // Write updated asset.upgradeCurrent
      t.set(assetRef, {
        upgradeCurrent: ucMutated,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      }, { merge: true })

      // Recompute stock snapshot
      const combinedMovements = [...allMovements, mv]
      const stockMap = deriveStock(combinedMovements)
      const s = stockMap[input.skuId] ?? { onHand: 0, broken: 0 }
      t.set(skuRef, {
        onHand: s.onHand,
        broken: s.broken,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      }, { merge: true })

      return {
        value: mv,
        before: { upgradeCurrent: ucBefore } as unknown as Record<string, unknown>,
        after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
      }
    },
  )
  return r
}
