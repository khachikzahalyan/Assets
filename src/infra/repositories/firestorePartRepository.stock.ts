/**
 * Stock-level write transactions for the parts warehouse Firestore adapter:
 *   - fsReceiveParts  — port of prototype handleAddConfirm (parts.html 3315-3354)
 *   - fsCreateGpu     — port of prototype handleGpuAdd    (parts.html 3360-3387)
 *
 * Each function runs ONE withAudit transaction that atomically writes data
 * doc(s) and exactly one audit_logs entry.
 */

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { ReceiveItem, CreateGpuInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import { deriveStock } from '@/domain/part/partStock'
import { COL_PARTS, COL_MOVEMENTS, toMovement } from './firestorePartRepository.mappers'

// ---- receiveParts -----------------------------------------------------------

/**
 * One 'receive' movement per item; recompute snapshot for affected SKUs.
 * ONE withAudit transaction.
 */
export async function fsReceiveParts(
  fsDb: Firestore,
  items: ReceiveItem[],
  actor: Actor,
): Promise<AuditedResult<PartMovement[]>> {
  const validItems = items.filter(i => i.qty >= 1)
  if (validItems.length === 0) throw new Error('receiveParts: no items with qty >= 1')

  // Pre-load affected SKU docs so we can recompute their snapshots inside the txn.
  const affectedSkuIds = [...new Set(validItems.map(i => i.skuId))]
  const skuRefs = affectedSkuIds.map(id => doc(fsDb, COL_PARTS, id))

  // Load existing movements for affected SKUs for stock recomputation.
  // We load ALL movements in a single query then filter (MVP: acceptable volume).
  const allMovementsSnap = await getDocs(collection(fsDb, COL_MOVEMENTS))
  const allMovements = allMovementsSnap.docs.map(d =>
    toMovement(d.id, d.data() as Record<string, unknown>),
  )

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

      // Read current SKU docs inside txn (required for transactional snapshot update)
      const skuSnaps = await Promise.all(skuRefs.map(r => t.get(r)))

      // Write movement docs
      const pendingMovements = validItems.map(item => {
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
        return mv
      })

      // Recompute snapshots for affected SKUs
      const combinedMovements = [...allMovements, ...pendingMovements]
      const stockMap = deriveStock(combinedMovements)

      for (const skuSnap of skuSnaps) {
        if (!skuSnap.exists()) continue
        const skuId = skuSnap.id
        const s = stockMap[skuId] ?? { onHand: 0, broken: 0 }
        t.set(skuSnap.ref, {
          onHand: s.onHand,
          broken: s.broken,
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
        // Update snapshot: onHand = initialQty (only this SKU has movements at creation)
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
