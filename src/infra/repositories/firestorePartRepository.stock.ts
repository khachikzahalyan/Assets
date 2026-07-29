/**
 * Stock-level write transactions for the parts warehouse Firestore adapter:
 *   - fsReceiveParts  — port of prototype handleAddConfirm (parts.html 3315-3354)
 *   - fsCreateModelSku — generic models-behavior SKU creation (supersedes old fsCreateGpu)
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
  getDoc,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { ReceiveItem, CreateModelSkuInput } from '@/domain/part/PartRepository'
import { InvalidCategoryBehaviorError } from '@/domain/part/errors'
import type { Part, PartMovement } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import { COL_PARTS, COL_MOVEMENTS } from './firestorePartRepository.mappers'

const COL_PART_CATEGORIES = 'part_categories'

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
      actorRole: actor.role, actorName: actor.displayName ?? null,
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

// ---- createModelSku ---------------------------------------------------------

/**
 * Creates a new SKU doc in any models-behavior category.
 *
 * Id scheme: `<categoryId>_<slug>` — for categoryId 'gpu' the slug matches the
 * legacy createGpu pattern exactly (same id format, same lowStockThreshold, same
 * audit action 'gpu_created') so existing GPU SKU docs and audit_log entries need
 * zero migration.
 *
 * For non-gpu categories the audit action is 'model_sku_created'.
 *
 * Validation: reads the part_categories/{categoryId} doc inside the transaction.
 * If the doc is missing AND categoryId === 'gpu', the create is allowed (legacy
 * fallback — DEFAULT_PART_CATEGORY_DEFS guarantees gpu is behavior:'models').
 * If the doc is missing for any other category, the create is rejected.
 */
export async function fsCreateModelSku(
  fsDb: Firestore,
  input: CreateModelSkuInput,
  actor: Actor,
): Promise<AuditedResult<Part>> {
  const { categoryId } = input

  // Validate behavior by reading the category doc BEFORE the transaction
  // (the category doc is immutable after creation so reading outside the txn is safe).
  const catRef = doc(fsDb, COL_PART_CATEGORIES, categoryId)
  const catSnap = await getDoc(catRef)

  if (!catSnap.exists()) {
    // Legacy fallback: gpu is always 'models' even without a Firestore doc.
    if (categoryId !== 'gpu') {
      throw new InvalidCategoryBehaviorError(categoryId, 'models', 'unknown (doc missing)')
    }
    // categoryId === 'gpu' and doc missing → allow (unseeded project).
  } else {
    const behavior = catSnap.data()?.['behavior'] as string | undefined
    if (behavior !== 'models') {
      throw new InvalidCategoryBehaviorError(categoryId, 'models', behavior ?? 'unknown')
    }
  }

  // Slug-safe id fragment — matches legacy gpu id scheme when categoryId === 'gpu'.
  const nameSlug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9а-яёА-ЯЁ]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const skuRef = doc(collection(fsDb, COL_PARTS))
  const id = `${categoryId}_${nameSlug}_${skuRef.id.slice(0, 8)}`

  // Audit action: 'gpu_created' for gpu (backwards compat), 'model_sku_created' for others.
  const auditAction = categoryId === 'gpu' ? 'gpu_created' as const : 'model_sku_created' as const

  let resultPart!: Part

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part',
      entityId: id,
      action: auditAction,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: null,
      after: null,
    },
    async (txn) => {
      const t = txn as unknown as Transaction
      const skuDocRef = doc(fsDb, COL_PARTS, id)

      const partDoc = {
        name: input.name,
        category: categoryId,
        unit: 'шт',
        onHand: 0,
        broken: 0,
        lowStockThreshold: 5,
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      t.set(skuDocRef, partDoc)

      if (input.initialQty > 0) {
        const mvRef = doc(collection(fsDb, COL_MOVEMENTS))
        // NOTE: no `actorName` — it is NOT in the /part_movements rules whitelist,
        // so including it makes hasOnly() reject the write and rolls back the whole
        // create-SKU transaction (GPU/model add WITH stock failed in production).
        // Matches the receive/install/uninstall movement writes, which omit it.
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
        t.set(skuDocRef, {
          onHand: input.initialQty,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })
      }

      const now = new Date().toISOString()
      resultPart = {
        id,
        name: input.name,
        category: categoryId,
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
