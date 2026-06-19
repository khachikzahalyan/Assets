import {
  collection, getDocs, query as fsQuery, where, orderBy, limit,
  startAfter, getDoc, doc, type Firestore, type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type {
  AuditLog, AuditLogRepository, AuditLogQuery, AuditLogPage,
  AuditCursor, AuditLogReferenceData,
} from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAuditLog(id: string, d: Record<string, unknown>): AuditLog {
  return {
    id,
    entityType: d.entityType as AuditLog['entityType'],
    entityId: String(d.entityId ?? ''),
    action: d.action as AuditLog['action'],
    actorUid: String(d.actorUid ?? ''),
    actorRole: d.actorRole as AuditLog['actorRole'],
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
    if (query.fromDate != null) constraints.push(where('at', '>=', query.fromDate))
    if (query.toDate != null) constraints.push(where('at', '<=', query.toDate))
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
    // Distinct actors: read a bounded recent window and dedupe by uid, resolving
    // display names from /users where readable. This is best-effort: the filter
    // dropdown is a convenience, not an exhaustive index.
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'), orderBy('at', 'desc'), limit(500),
    ))
    const uids = Array.from(new Set(snap.docs.map(d => String((d.data() as Record<string, unknown>).actorUid ?? ''))))
      .filter(uid => uid !== '')

    const actors = await Promise.all(uids.map(async uid => {
      try {
        const u = await getDoc(doc(this.db, 'users', uid))
        const name = u.exists()
          ? (((u.data() as Record<string, unknown>).displayName as string | undefined) ?? null)
          : null
        return { uid, displayName: name }
      } catch {
        return { uid, displayName: null }
      }
    }))

    return { actors }
  }
}
