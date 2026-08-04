/**
 * Install write transaction for the parts warehouse Firestore adapter:
 *   - fsInstallPart — port of prototype handleInstallConfirm (parts.html 3211-3312)
 *
 * ONE withAudit transaction atomically: reads asset + SKU docs, writes the
 * movement doc, mutates asset.upgradeCurrent, applies an incremental stock delta
 * to the SKU snapshot, and writes one audit_logs entry.
 *
 * P1.1 (senior audit): getDocs(full collection) removed. Stock is maintained via
 * an incremental delta:
 *   - non-serviceReplace install  → onHand − 1
 *   - serviceReplace install      → snapshot unchanged
 *
 * Server-side stock guard (senior audit): for in-house installs (not serviceReplace)
 * the txn reads the SKU snapshot BEFORE writing and throws InsufficientStockError
 * if onHand < 1. This prevents concurrent installs from overshooting the stock.
 * No Math.max clamp — the error surfaces honestly.
 *
 * See firestorePartRepository.uninstall.ts for the counterpart fsUninstallPart.
 */

import {
  collection,
  doc,
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
  slotKindForSku,
  storageTypeForSku,
  assetFamilyOf,
  isServiceOnly,
  resolveUpgradeCurrent,
  resolveReplaceTargetIndex,
} from '@/domain/part/partStock'
import { InsufficientStockError } from '@/domain/part/errors'
import type { AssetSpecs } from '@/domain/asset/types'
import {
  COL_PARTS,
  COL_MOVEMENTS,
  COL_ASSETS,
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

  // Honest audit semantics: an install-replace with a working old part is
  // NOT a return — no stock is credited (unlike uninstallPart, which writes a
  // real +onHand). The old part is a record-only note on the movement
  // (oldDisposal:'kept'), so the audit action stays 'part_installed'.
  // Only a broken old part still records 'part_scrapped'.
  let auditAction: 'part_installed' | 'part_scrapped'
  if (input.action === 'replace' && input.oldIsBroken) {
    auditAction = 'part_scrapped'
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
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: null, // filled from txn reads below
      after: null,
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      // Read SKU + asset inside txn.
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
      const currentOnHand = Number(partData['onHand'] ?? 0)
      const currentBroken = Number(partData['broken'] ?? 0)

      // Server-side stock guard: in-house installs require at least 1 unit on hand.
      // serviceReplace operations bypass this — they never touch warehouse stock.
      if (!serviceReplace && currentOnHand < 1) {
        throw new InsufficientStockError(input.skuId, currentOnHand, 1)
      }

      const assetData = assetSnap.data() as Record<string, unknown>
      const upgradeCurrent: UpgradeSlot[] = resolveUpgradeCurrent(
        input.assetCategoryId,
        (assetData['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
        toUpgradeSlots(assetData['upgradeCurrent']),
      )

      const ucBefore = upgradeCurrent.map(s => ({ ...s }))

      // Build newSpec and slot metadata.
      const newSpec = partName + (variantLabel ? ' ' + variantLabel : '')
      const slotKind = slotKindForSku(partCategory, family)
      const stType = storageTypeForSku(partCategory)
      const at = new Date().toISOString()

      // Mutate upgradeCurrent copy.
      const ucMutated = [...upgradeCurrent.map(s => ({ ...s }))]
      const appendNewSlot = (): void => {
        const newSlot: UpgradeSlot = {
          kind: slotKind ?? 'storage',
          spec: newSpec,
          installedAt: at,
          replaced: false,
        }
        if (stType) newSlot.storageType = stType
        ucMutated.push(newSlot)
      }

      // Replace path: resolve the target slot INSIDE the txn (same helper the
      // in-memory twin uses). A null/invalid replaceUcIndex resolves to the sole
      // occupied slot of the SKU's kind; only when NOTHING is occupied does the
      // install fall back to a true append. Never a silent append-instead-of-replace.
      let replacedFields: {
        replacedSpec: string
        replacedStorageType: string | null
        replacedSlotIndex: number
        oldDisposal: 'kept' | 'broken'
      } | null = null
      if (input.action === 'replace') {
        const targetIdx = resolveReplaceTargetIndex(
          ucMutated, partCategory, family, input.replaceUcIndex,
        )
        if (targetIdx !== null) {
          const slot = ucMutated[targetIdx]!
          if (slot.spec) {
            // Denormalise the outgoing part into the movement so History can
            // render «← заменил <old spec>» without extra reads.
            replacedFields = {
              replacedSpec: slot.spec,
              replacedStorageType: slot.storageType ?? null,
              replacedSlotIndex: targetIdx,
              oldDisposal: input.oldIsBroken ? 'broken' : 'kept',
            }
          }
          slot.spec = newSpec
          slot.replaced = true
          slot.installedAt = at
          if (stType) slot.storageType = stType
        } else {
          appendNewSlot()
        }
      } else {
        appendNewSlot()
      }

      const ucAfter = ucMutated.map(s => ({ ...s }))

      // 1. Write movement (conditional-spread: replaced* fields only on replace —
      //    exactOptionalPropertyTypes forbids explicit undefined, and Firestore
      //    rejects undefined field values).
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
        ...(replacedFields ?? {}),
      }
      t.set(mvRef, {
        type: mv.type, skuId: mv.skuId, qty: mv.qty, broken: mv.broken,
        assetId: mv.assetId, assetInvCode: mv.assetInvCode,
        serviceReplace: mv.serviceReplace, note: mv.note, reason: mv.reason,
        actorUid: mv.actorUid, actorRole: mv.actorRole, at: serverTimestamp(),
        ...(replacedFields ?? {}),
      })

      // 2. Update asset.upgradeCurrent.
      t.set(assetRef, {
        upgradeCurrent: ucMutated,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      }, { merge: true })

      // 3. Incremental delta on SKU snapshot.
      //    serviceReplace → snapshot unchanged (movements skipped by deriveStock too).
      //    in-house install → onHand − 1 (checked above ≥ 1 so result ≥ 0).
      if (!serviceReplace) {
        t.set(skuRef, {
          onHand: currentOnHand - 1,
          broken: currentBroken,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })
      }

      return {
        value: mv,
        before: { upgradeCurrent: ucBefore } as unknown as Record<string, unknown>,
        after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
      }
    },
  )
  return r
}
