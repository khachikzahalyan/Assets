/**
 * Stock-level write transactions for the parts warehouse Firestore adapter:
 *   - fsReceiveParts  — port of prototype handleAddConfirm (parts.html 3315-3354)
 *   - fsCreateGpu     — port of prototype handleGpuAdd    (parts.html 3360-3387)
 *
 * Each function runs ONE withAudit transaction that atomically writes data
 * doc(s) and exactly one audit_logs entry.
 *
 * P1.1 (senior audit): getDocs(full collection) removed from every write path.
 * Stock is now maintained via incremental deltas applied to the SKU doc snapshot
 * read inside the transaction. The SKU's onHand/broken snapshot is the
 * authoritative value; no journal re-derivation is performed here.
 */

import {
  collection,
  doc,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { ReceiveItem, CreateGpuInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import { COL_PARTS, COL_MOVEMENTS } from './firestorePartRepository.mappers'

// ---- receiveParts -----------------------------------------------------------

/**
 * One 'receive' movement per item; apply +qty delta to the onHand snapshot.
 * ONE withAudit transaction. No full journal read.
 */
export async function fsReceiveParts(
  fsDb: Firestore,
  items: ReceiveItem[],
  actor: Actor,
): Promise<AuditedResult<PartMovement[]>> {
  const validItems = items.filter(i => i.qty >= 1)
  if (validItems.length === 0) throw new Error('receiveParts: no items with qty >= 1')

  // Pre-compute affected SKU ids and refs.
  const affectedSkuIds = [...new Set(validItems.map(i => i.skuId))]
  const skuRefs = affectedSkuIds.map(id => doc(fsDb, COL_PARTS, id))

  const newMovements: PartMovement[] = []
  const at = new Date().toISOString()

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part_movement',
      entityId: doc(collection(fsDb, COL_MOVEMENTS)).id, // stable id for audit
      action: 'part_received',
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: {
        items: validItems.map(i => ({ skuId: i.skuId, qty: i.qty })),
        totalQty: validItems.reduce((s, i) => s + i.qty, 0),
      },
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      // Read current SKU docs inside txn for transactional snapshot update.
      const skuSnaps = await Promise.all(skuRefs.map(r => t.get(r)))

      // Build a per-skuId delta map: sum of all receive quantities in this batch.
      const deltaMap = new Map<string, number>()
      for (const item of validItems) {
        deltaMap.set(item.skuId, (deltaMap.get(item.skuId) ?? 0) + item.qty)
      }

      // Write movement docs.
      for (const item of validItems) {
        const mvRef = doc(collection(fsDb, COL_MOVEMENTS))
        const mv: PartMovement = {
          id: mvRef.id,
          type: 'receive',
          skuId: item.skuId,
          qty: item.qty,
          broken: false,
          assetId: null,
          assetInvCode: null,
          serviceReplace: false,
          note: null,
          reason: 'Поставка',
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
        newMovements.push(mv)
      }

      // Apply incremental delta to each affected SKU snapshot (receive → +onHand).
      // No getDocs of the full journal — just read the SKU doc and add the delta.
      for (const skuSnap of skuSnaps) {
        if (!skuSnap.exists()) continue
        const skuId = skuSnap.id
        const data = skuSnap.data() as Record<string, unknown>
        const currentOnHand = Number(data['onHand'] ?? 0)
        const currentBroken = Number(data['broken'] ?? 0)
        const delta = deltaMap.get(skuId) ?? 0
        t.set(skuSnap.ref, {
          onHand: currentOnHand + delta,
          broken: currentBroken,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })
      }

      return { value: newMovements }
    },
  )
  return r
}

// ---- createGpu --------------------------------------------------------------

/**
 * Creates a new GPU SKU doc; if initialQty > 0 appends a 'receive' movement.
 * ONE withAudit transaction.
 * No getDocs of the full journal — snapshot is set directly from initialQty.
 */
export async function fsCreateGpu(
  fsDb: Firestore,
  input: CreateGpuInput,
  actor: Actor,
): Promise<AuditedResult<Part>> {
  const skuRef = doc(collection(fsDb, COL_PARTS))
  const id = skuRef.id

  let resultPart!: Part

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part',
      entityId: id,
      action: 'gpu_created',
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: null,
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      const partDoc = {
        name: input.name,
        category: 'gpu' as const,
        unit: 'шт',
        onHand: 0,
        broken: 0,
        lowStockThreshold: 5,
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      t.set(skuRef, partDoc)

      if (input.initialQty > 0) {
        const mvRef = doc(collection(fsDb, COL_MOVEMENTS))
        t.set(mvRef, {
          type: 'receive',
          skuId: id,
          qty: input.initialQty,
          broken: false,
          assetId: null,
          assetInvCode: null,
          serviceReplace: false,
          note: null,
          reason: 'Поставка',
          actorUid: actor.uid,
          actorRole: actor.role,
          at: serverTimestamp(),
        })
        // Incremental delta: brand-new SKU starts at 0, add initialQty.
        t.set(skuRef, {
          onHand: input.initialQty,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })
      }

      const now = new Date().toISOString()
      resultPart = {
        id,
        name: input.name,
        category: 'gpu',
        unit: 'шт',
        onHand: input.initialQty > 0 ? input.initialQty : 0,
        broken: 0,
        lowStockThreshold: 5,
        createdAt: now,
        updatedAt: now,
        createdBy: actor.uid,
        updatedBy: actor.uid,
      }

      return {
        value: resultPart,
        after: { ...resultPart } as unknown as Record<string, unknown>,
      }
    },
  )
  return r
}
