/**
 * Service-record write transaction for the parts warehouse Firestore adapter:
 *   - fsRecordService — port of prototype handleServiceConfirm (parts.html ~3465-3487)
 *
 * Records a SKU-less maintenance event as a `type:'service'` journal movement.
 * Stock-neutral: skuId is empty, qty=0, broken=false, serviceReplace=false.
 * Does NOT mutate asset.upgradeCurrent (a service record is a maintenance log, not a part swap).
 * Does NOT recompute SKU stock snapshots (no stock change — deriveStock already ignores
 * service movements).
 * ONE withAudit transaction writes exactly one part_movements doc + one audit_logs entry.
 */

import {
  collection,
  doc,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { ServiceRecordInput } from '@/domain/part/PartRepository'
import type { PartMovement } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import { COL_MOVEMENTS } from './firestorePartRepository.mappers'

export async function fsRecordService(
  fsDb: Firestore,
  input: ServiceRecordInput,
  actor: Actor,
): Promise<AuditedResult<PartMovement>> {
  const mvRef = doc(collection(fsDb, COL_MOVEMENTS))
  const at = new Date().toISOString()

  const r = await withAudit(
    firestoreAuditContext(fsDb),
    {
      entityType: 'part_movement',
      entityId: mvRef.id,
      action: 'part_serviced',
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: {
        assetId: input.assetId,
        kindId: input.kindId,
        kindLabel: input.kindLabel,
      },
    },
    async (txn) => {
      const t = txn as unknown as Transaction

      const mv: PartMovement = {
        id: mvRef.id,
        type: 'service',
        skuId: '',
        qty: 0,
        broken: false,
        assetId: input.assetId,
        assetInvCode: input.assetInvCode,
        serviceReplace: false,
        kindId: input.kindId,
        kindLabel: input.kindLabel,
        note: input.note ?? null,
        reason: input.kindLabel,
        actorUid: actor.uid,
        actorRole: actor.role,
        at,
      }

      // Write movement doc. No SKU snapshot update (stock-neutral).
      // No asset.upgradeCurrent update (not a part swap).
      t.set(mvRef, {
        type: mv.type,
        skuId: mv.skuId,
        qty: mv.qty,
        broken: mv.broken,
        assetId: mv.assetId,
        assetInvCode: mv.assetInvCode,
        serviceReplace: mv.serviceReplace,
        kindId: mv.kindId,
        kindLabel: mv.kindLabel,
        note: mv.note,
        reason: mv.reason,
        actorUid: mv.actorUid,
        actorRole: mv.actorRole,
        at: serverTimestamp(),
      })

      return { value: mv }
    },
  )
  return r
}
