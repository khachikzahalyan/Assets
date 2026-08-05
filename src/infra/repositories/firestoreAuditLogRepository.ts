import {
  collection, getDocs, query as fsQuery, where, orderBy, limit,
  startAfter, getDoc, doc, Timestamp, type Firestore, type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type {
  AuditLog, AuditLogRepository, AuditLogQuery, AuditLogPage,
  AuditCursor, AuditLogReferenceData,
} from '@/domain/audit'
import { toIso } from './firestoreUtils'

export function toAuditLog(id: string, d: Record<string, unknown>): AuditLog {
  // actorName: undefined when absent from doc (legacy), null when stored as null,
  // string when denormalized. Using the conditional spread keeps the key absent
  // on legacy docs, which matches AuditLog['actorName'] = string | null | undefined.
  const actorNameRaw = d.actorName as string | null | undefined
  return {
    id,
    entityType: d.entityType as AuditLog['entityType'],
    entityId: String(d.entityId ?? ''),
    action: d.action as AuditLog['action'],
    actorUid: String(d.actorUid ?? ''),
    actorRole: d.actorRole as AuditLog['actorRole'],
    ...(actorNameRaw !== undefined ? { actorName: actorNameRaw } : {}),
    before: (d.before as AuditLog['before']) ?? null,
    after: (d.after as AuditLog['after']) ?? null,
    comment: (d.comment as string | null) ?? null,
    at: toIso(d.at),
  }
}

/**
 * Production READ-ONLY adapter. NO mutation methods exist — audit_logs is
 * immutable. We rely on Firestore-side filtering for the equality/range
 * predicates and on the cursor (startAfter) for pagination. Free-text `search`
 * is applied client-side over the returned page (it cannot be expressed as a
 * Firestore predicate); operators rely on the structured filters for narrowing.
 *
 * Cursor encoding: `<atIso>|<docId>` of the last returned doc. We re-derive the
 * startAfter snapshot by reading that doc. Opaque to callers.
 */
export class FirestoreAuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: Firestore) {}

  async listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage> {
    const constraints: QueryConstraint[] = []
    if (query.entityType !== 'all') constraints.push(where('entityType', '==', query.entityType))
    if (query.action !== 'all') constraints.push(where('action', '==', query.action))
    if (query.actorUid !== 'all') constraints.push(where('actorUid', '==', query.actorUid))
    // `at` is written with serverTimestamp() → stored as a Firestore Timestamp.
    // Comparing a Timestamp field against an ISO STRING silently matches nothing
    // (timestamps sort before strings in Firestore's type order), so the bounds
    // MUST be converted to Timestamp values.
    if (query.fromDate != null) {
      constraints.push(where('at', '>=', Timestamp.fromDate(new Date(query.fromDate))))
    }
    if (query.toDate != null) {
      constraints.push(where('at', '<=', Timestamp.fromDate(new Date(query.toDate))))
    }
    constraints.push(orderBy('at', 'desc'))

    // Cursor: read the anchor doc and startAfter it.
    if (cursor != null) {
      const sepIdx = cursor.lastIndexOf('|')
      const anchorId = sepIdx >= 0 ? cursor.slice(sepIdx + 1) : cursor
      const anchorSnap = await getDoc(doc(this.db, 'audit_logs', anchorId))
      if (anchorSnap.exists()) constraints.push(startAfter(anchorSnap))
    }

    // Over-fetch by 1 to detect whether a next page exists.
    constraints.push(limit(query.pageSize + 1))

    const snap = await getDocs(fsQuery(collection(this.db, 'audit_logs'), ...constraints))
    let docs: QueryDocumentSnapshot[] = snap.docs
    const hasMore = docs.length > query.pageSize
    if (hasMore) docs = docs.slice(0, query.pageSize)

    let rows = docs.map(d => toAuditLog(d.id, d.data() as Record<string, unknown>))

    // Client-side free-text narrowing over the page (entityId + actorUid).
    // Free-text search cannot be expressed as a Firestore predicate and is
    // intentionally applied after fetch — it narrows the displayed page only.
    const s = query.search.trim().toLowerCase()
    if (s !== '') {
      rows = rows.filter(r =>
        r.entityId.toLowerCase().includes(s) || r.actorUid.toLowerCase().includes(s))
    }

    const last = docs[docs.length - 1]
    const nextCursor: AuditCursor | null =
      hasMore && last ? `${toIso((last.data() as Record<string, unknown>).at)}|${last.id}` : null

    return { rows, nextCursor }
  }

  async loadReferenceData(): Promise<AuditLogReferenceData> {
    // Read a bounded recent window — 100 docs is sufficient to build the actor
    // filter dropdown. Older actors that do not appear in this window are simply
    // absent from the dropdown (best-effort; not an exhaustive index).
    // As new docs accumulate with actorName already denormalized, the fallback
    // getDoc('/users/{uid}') branch will naturally call fewer and fewer times
    // until it is never hit. At that point this method becomes 100 reads + 0 getDoc calls.
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'), orderBy('at', 'desc'), limit(100),
    ))

    // Build uid → best-known-name map in one pass over the window.
    // A uid is "resolved" if ANY doc in the window carries actorName for it.
    const resolved = new Map<string, string | null>()
    const unresolvedUids = new Set<string>()

    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>
      const uid = String(data.actorUid ?? '')
      if (uid === '') continue

      if ('actorName' in data) {
        // Denormalized name available — use it, mark resolved.
        const name = data.actorName as string | null
        // Keep the first non-null name we see for this uid (most recent = first due to DESC order).
        if (!resolved.has(uid) || resolved.get(uid) == null) {
          resolved.set(uid, name)
        }
      } else if (!resolved.has(uid)) {
        // Legacy doc without actorName — will need a getDoc fallback.
        unresolvedUids.add(uid)
      }
    }

    // Fallback: getDoc('/users/{uid}') only for uids that are NOT yet resolved.
    // This path shrinks to zero as new docs accumulate with actorName denormalized.
    const fallbackActors = await Promise.all(
      Array.from(unresolvedUids)
        .filter(uid => !resolved.has(uid))
        .map(async uid => {
          try {
            const u = await getDoc(doc(this.db, 'users', uid))
            const name = u.exists()
              ? (((u.data() as Record<string, unknown>).displayName as string | undefined) ?? null)
              : null
            return { uid, name }
          } catch {
            return { uid, name: null }
          }
        }),
    )
    for (const { uid, name } of fallbackActors) {
      resolved.set(uid, name)
    }

    const actors = Array.from(resolved.entries()).map(([uid, displayName]) => ({ uid, displayName }))
    return { actors }
  }
}
