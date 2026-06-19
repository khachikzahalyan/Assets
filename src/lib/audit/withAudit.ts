import {
  runTransaction, collection, doc, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { AuditSpec, AuditLog, AuditedResult } from '@/domain/audit'

/** Minimal txn surface our mutate callbacks use. Firestore Transaction satisfies it. */
export interface TxnLike { set(ref: unknown, data: unknown, options?: unknown): unknown }

export type MutateResult<T> = { value: T; before?: unknown; after?: unknown }

export interface AuditContext {
  /** Runs the mutate callback, then writes exactly one audit doc in the SAME atomic unit. */
  run<T>(spec: AuditSpec, mutate: (txn: TxnLike) => Promise<MutateResult<T>>): Promise<AuditedResult<T>>
}

/**
 * The single chokepoint for state-changing writes. Every mutating repository
 * method calls withAudit; there is NO path that commits a business write without
 * appending exactly one audit_logs entry in the same atomic unit.
 */
export function withAudit<T>(
  ctx: AuditContext, spec: AuditSpec, mutate: (txn: TxnLike) => Promise<MutateResult<T>>,
): Promise<AuditedResult<T>> {
  return ctx.run(spec, mutate)
}

// ---- In-memory context (tests / InMemory repository) ----------------------
export interface InMemoryAuditStore { logs: AuditLog[]; seq: number }
export function createInMemoryAuditStore(): InMemoryAuditStore { return { logs: [], seq: 0 } }

export function inMemoryAuditContext(store: InMemoryAuditStore): AuditContext {
  return {
    async run(spec, mutate) {
      const snapshot = [...store.logs] // rollback point
      const txn: TxnLike = { set: () => undefined }
      try {
        const { value, before, after } = await mutate(txn)
        const id = `al_${++store.seq}`
        const log: AuditLog = {
          id,
          entityType: spec.entityType,
          entityId: spec.entityId,
          action: spec.action,
          actorUid: spec.actorUid,
          actorRole: spec.actorRole,
          before: (spec.before ?? (before as AuditLog['before']) ?? null),
          after: (spec.after ?? (after as AuditLog['after']) ?? null),
          comment: spec.comment ?? null,
          at: new Date().toISOString(),
        }
        store.logs.push(log)
        return { value, auditId: id }
      } catch (err) {
        store.logs = snapshot
        throw err
      }
    },
  }
}

// ---- Firestore context (production) ---------------------------------------
export function firestoreAuditContext(db: Firestore): AuditContext {
  return {
    async run(spec, mutate) {
      let auditId = ''
      const value = await runTransaction(db, async (txn: Transaction) => {
        const { value, before, after } = await mutate(txn as unknown as TxnLike)
        const ref = doc(collection(db, 'audit_logs'))
        auditId = ref.id
        txn.set(ref, {
          entityType: spec.entityType,
          entityId: spec.entityId,
          action: spec.action,
          actorUid: spec.actorUid,
          actorRole: spec.actorRole,
          before: spec.before ?? before ?? null,
          after: spec.after ?? after ?? null,
          comment: spec.comment ?? null,
          at: serverTimestamp(),
        })
        return value
      })
      return { value, auditId }
    },
  }
}
