import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, orderBy, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { Assignment, AssignInput, AssignmentRepository } from '@/domain/assignment'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAssignment(id: string, d: Record<string, unknown>): Assignment {
  return {
    id,
    assetId: String(d.assetId ?? ''),
    mode: (d.mode as Assignment['mode']) ?? 'branch',
    assignedToEmployeeId: (d.assignedToEmployeeId as string | null) ?? null,
    assignedToBranchId: (d.assignedToBranchId as string | null) ?? null,
    startedAt: toIso(d.startedAt),
    endedAt: d.endedAt == null ? null : toIso(d.endedAt),
    actStoragePath: (d.actStoragePath as string | null) ?? null,
    transferComment: (d.transferComment as string | null) ?? null,
    createdBy: String(d.createdBy ?? ''),
    createdAt: toIso(d.createdAt),
  }
}

export class FirestoreAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async getActiveAssignment(assetId: string): Promise<Assignment | null> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assignments'),
      where('assetId', '==', assetId), where('endedAt', '==', null),
    ))
    const d = snap.docs[0]
    return d ? toAssignment(d.id, d.data() as Record<string, unknown>) : null
  }

  async listAssignments(assetId: string): Promise<Assignment[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assignments'),
      where('assetId', '==', assetId), orderBy('startedAt', 'desc'),
    ))
    return snap.docs.map(d => toAssignment(d.id, d.data() as Record<string, unknown>))
  }

  async assign(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>> {
    if (input.mode === 'employee' && !input.employeeId) throw new Error('employeeId required')
    if (input.mode === 'branch' && !input.branchId) throw new Error('branchId required')

    const assetRef = doc(this.db, 'assets', input.assetId)
    const asnRef = doc(collection(this.db, 'assignments'))
    const mailRef = doc(collection(this.db, 'mail'))

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: asnRef.id, action: 'assigned',
        actorUid: actor.uid, actorRole: actor.role,
        after: {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
          assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
        },
        comment: input.transferComment ?? null,
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        const assetSnap = await t.get(assetRef)
        if (!assetSnap.exists()) throw new Error(`Asset not found: ${input.assetId}`)
        const status = String((assetSnap.data() as Record<string, unknown>).statusId ?? '')
        if (status !== 'st_warehouse') throw new Error(`Asset not assignable (status ${status})`)

        t.set(asnRef, {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
          assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
          startedAt: serverTimestamp(), endedAt: null,
          actStoragePath: input.actStoragePath ?? null,
          transferComment: input.transferComment ?? null,
          createdBy: actor.uid, createdAt: serverTimestamp(),
        })
        t.set(assetRef, {
          statusId: 'st_assigned',
          assignment: input.mode === 'employee'
            ? { mode: 'employee', employeeId: input.employeeId! }
            : { mode: 'branch', branchId: input.branchId! },
          updatedBy: actor.uid, updatedAt: serverTimestamp(),
        }, { merge: true })
        if (input.mode === 'employee' && input.employeeEmail) {
          t.set(mailRef, {
            to: [input.employeeEmail],
            message: {
              subject: `Asset assigned: ${input.invCode ?? input.assetId}`,
              text: `Asset ${input.invCode ?? input.assetId} assigned to ${input.employeeName ?? ''}`.trim(),
              html: `<p>Asset <strong>${input.invCode ?? input.assetId}</strong> assigned to ${input.employeeName ?? ''}</p>`,
            },
          })
        }
        return { value: undefined as unknown as void }
      })

    const created = await getDoc(asnRef)
    if (!created.exists()) throw new Error('Assignment create succeeded but readback failed')
    return { value: toAssignment(asnRef.id, created.data() as Record<string, unknown>), auditId: r.auditId }
  }

  async returnAsset(assetId: string, actor: Actor): Promise<AuditedResult<Assignment>> {
    const active = await this.getActiveAssignment(assetId)
    if (!active) throw new Error(`No active assignment for asset: ${assetId}`)
    const assetRef = doc(this.db, 'assets', assetId)
    const asnRef = doc(this.db, 'assignments', active.id)
    const now = new Date().toISOString()

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: active.id, action: 'returned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { assetId, mode: active.mode },
        after: { assetId, endedAt: now },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        // Re-read asnRef INSIDE the transaction before any writes to close the
        // TOCTOU window: if a concurrent returnAsset already set endedAt, the
        // in-transaction read sees the committed value and we abort. Firestore
        // serialises the asnRef doc, so only one caller wins the contention.
        const snap = await t.get(asnRef)
        if (!snap.exists() || (snap.data() as Record<string, unknown>).endedAt != null) {
          throw new Error(`No active assignment for asset: ${assetId}`)
        }
        t.set(asnRef, { endedAt: serverTimestamp() }, { merge: true })
        t.set(assetRef, { statusId: 'st_warehouse', assignment: null, updatedBy: actor.uid, updatedAt: serverTimestamp() }, { merge: true })
        return { value: undefined as unknown as void }
      })

    const next = await getDoc(asnRef)
    if (!next.exists()) throw new Error('Assignment return succeeded but readback failed')
    return { value: toAssignment(asnRef.id, next.data() as Record<string, unknown>), auditId: r.auditId }
  }
}
