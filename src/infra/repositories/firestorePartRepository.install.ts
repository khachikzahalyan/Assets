/**
 * Install write transaction for the parts warehouse Firestore adapter:
 *   - fsInstallPart — port of prototype handleInstallConfirm (parts.html 3211-3312)
 *
 * ONE withAudit transaction atomically: reads asset + SKU docs, writes the
 * movement doc, mutates asset.upgradeCurrent, recomputes the SKU stock snapshot,
 * and writes one audit_logs entry.
 *
 * See firestorePartRepository.uninstall.ts for the counterpart fsUninstallPart.
 */

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { InstallInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement, UpgradeSlot } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import {
  deriveStock,
  slotKindForSku,
  storageTypeForSku,
  assetFamilyOf,
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

// ---- fsInstallPart ----------------------------------------------------------

export async function fsInstallPart(
  fsDb: Firestore,
  input: InstallInput,
  actor: Actor,
): Promise<AuditedResult<PartMovement>> {
  const skuRef = doc(fsDb, COL_PARTS, input.skuId)
  const assetRef = doc(fsDb, COL_ASSETS, input.assetId)
  const mvRef = doc(collection(fsDb, COL_MOVEMENTS))

  // Load existing movements for recomputation (outside txn — acceptable for snapshot math)
  const allMovementsSnap = await getDocs(collection(fsDb, COL_MOVEMENTS))
  const allMovements = allMovementsSnap.docs.map(d =>
    toMovement(d.id, d.data() as Record<string, unknown>),
  )

  const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace
  const family = assetFamilyOf(input.assetCategoryId)

  let reason: string
  if (serviceReplace) {
    reason = 'Заменено через сервис'
  } else if (input.action === 'replace') {
    reason = input.oldIsBroken
      ? 'Установка взамен неисправного'
      : 'Установка взамен (плановая замена)'
  } else {
    reason = 'Установка в актив'
  }

  let auditAction: 'part_installed' | 'part_returned' | 'part_scrapped'
  if (input.action === 'replace') {
    auditAction = input.oldIsBroken ? 'part_scrapped' : 'part_returned'
  } else {
    auditAction = 'part_installed'
  }

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part',
      entityId: input.assetId,
      action: auditAction,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null, // filled from txn reads below
      after: null,
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      // Read SKU + asset inside txn
      const [skuSnap, assetSnap] = await Promise.all([
        t.get(skuRef),
        t.get(assetRef),
      ])
      if (!skuSnap.exists()) throw new Error(`installPart: SKU not found: ${input.skuId}`)
      if (!assetSnap.exists()) throw new Error(`installPart: asset not found: ${input.assetId}`)

      const partData = skuSnap.data() as Record<string, unknown>
      const partName = String(partData['name'] ?? '')
      const variantLabel = (partData['variantLabel'] as string | null) ?? null
      const partCategory = partData['category'] as Part['category']

      const assetData = assetSnap.data() as Record<string, unknown>
      const upgradeCurrent: UpgradeSlot[] = resolveUpgradeCurrent(
        input.assetCategoryId,
        (assetData['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
        toUpgradeSlots(assetData['upgradeCurrent']),
      )

      const ucBefore = upgradeCurrent.map(s => ({ ...s }))

      // Build newSpec and slot metadata
      const newSpec = partName + (variantLabel ? ' ' + variantLabel : '')
      const slotKind = slotKindForSku(partCategory, family)
      const stType = storageTypeForSku(partCategory)
      const at = new Date().toISOString()

      // Mutate upgradeCurrent copy
      const ucMutated = [...upgradeCurrent.map(s => ({ ...s }))]
      if (
        input.action === 'replace' &&
        input.replaceUcIndex !== null &&
        input.replaceUcIndex >= 0 &&
        input.replaceUcIndex < ucMutated.length
      ) {
        const slot = ucMutated[input.replaceUcIndex]!
        slot.spec = newSpec
        slot.replaced = true
        slot.installedAt = at
        if (stType) slot.storageType = stType
      } else {
        const newSlot: UpgradeSlot = {
          kind: slotKind ?? 'storage',
          spec: newSpec,
          installedAt: at,
          replaced: false,
        }
        if (stType) newSlot.storageType = stType
        ucMutated.push(newSlot)
      }

      const ucAfter = ucMutated.map(s => ({ ...s }))

      // 1. Write movement
      const mv: PartMovement = {
        id: mvRef.id,
        type: 'install',
        skuId: input.skuId,
        qty: 1,
        broken: false,
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

      // 2. Update asset.upgradeCurrent
      t.set(assetRef, {
        upgradeCurrent: ucMutated,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      }, { merge: true })

      // 3. Recompute snapshot (service: serviceReplace movements skipped by deriveStock)
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

