import type {
  AuditLog, AuditLogRepository, AuditLogQuery, AuditLogPage,
  AuditCursor, AuditLogReferenceData,
} from '@/domain/audit'

/**
 * In-memory READ-ONLY adapter for tests/dev. There are NO mutation methods:
 * audit_logs is immutable. The constructor seeds the store; nothing else writes.
 *
 * Cursor encoding: the index (as a string) of the first row of the NEXT page,
 * computed over the FILTERED+SORTED set. Opaque to callers.
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  constructor(
    private readonly logs: AuditLog[],
    /** Optional uid -> displayName map for actor name resolution. */
    private readonly actorNames: Record<string, string> = {},
  ) {}

  async listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage> {
    const filtered = this.logs
      .filter(l => query.entityType === 'all' || l.entityType === query.entityType)
      .filter(l => query.action === 'all' || l.action === query.action)
      .filter(l => query.actorUid === 'all' || l.actorUid === query.actorUid)
      .filter(l => query.fromDate == null || l.at >= query.fromDate)
      .filter(l => query.toDate == null || l.at <= query.toDate)
      .filter(l => {
        const s = query.search.trim().toLowerCase()
        if (s === '') return true
        return l.entityId.toLowerCase().includes(s) || l.actorUid.toLowerCase().includes(s)
      })
      // at DESC, id DESC tie-breaker for stable ordering
      .sort((a, b) => {
        const t = b.at.localeCompare(a.at)
        return t !== 0 ? t : b.id.localeCompare(a.id)
      })

    const start = cursor == null ? 0 : Number.parseInt(cursor, 10)
    const safeStart = Number.isFinite(start) && start > 0 ? start : 0
    const end = safeStart + query.pageSize
    const rows = filtered.slice(safeStart, end)
    const nextCursor: AuditCursor | null = end < filtered.length ? String(end) : null
    return { rows, nextCursor }
  }

  async loadReferenceData(): Promise<AuditLogReferenceData> {
    // Mirrors the Firestore adapter behaviour: prefer actorName from the log doc
    // over the actorNames map (which stands in for the /users getDoc fallback).
    // This ensures in-memory tests exercise the same resolution logic as production.
    const resolved = new Map<string, string | null>()

    for (const log of this.logs) {
      const uid = log.actorUid
      if (!uid) continue
      if ('actorName' in log) {
        // Denormalized name — prefer over fallback map.
        if (!resolved.has(uid) || resolved.get(uid) == null) {
          resolved.set(uid, log.actorName ?? null)
        }
      } else if (!resolved.has(uid)) {
        // Legacy log without actorName — use the actorNames map (fallback).
        resolved.set(uid, this.actorNames[uid] ?? null)
      }
    }

    const actors = Array.from(resolved.entries()).map(([uid, displayName]) => ({ uid, displayName }))
    return { actors }
  }
}
