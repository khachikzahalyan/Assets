import type { AuditLog, AuditEntityType, AuditAction } from './types'
import type { Role } from '@/config/roles'

/** A filterable, sorted, cursor-paginated query over the immutable audit trail. */
export interface AuditLogQuery {
  /** Filter by entity type, or 'all' for no filter. */
  entityType: AuditEntityType | 'all'
  /** Filter by action, or 'all' for no filter. */
  action: AuditAction | 'all'
  /** Filter by exact actor uid, or 'all' for no filter. */
  actorUid: string | 'all'
  /** Inclusive lower bound (ISO date or datetime), or null for no bound. */
  fromDate: string | null
  /** Inclusive upper bound (ISO date or datetime), or null for no bound. */
  toDate: string | null
  /** Free-text contains match over entityId + actorUid (client-side narrowing). */
  search: string
  /** Page size. */
  pageSize: number
}

/** An opaque cursor token. The repository owns its encoding; callers treat it as a black box. */
export type AuditCursor = string

/** One page of results plus the cursor to fetch the NEXT page (null if last page). */
export interface AuditLogPage {
  rows: AuditLog[]
  /** Cursor for the next page; null when there are no more rows. */
  nextCursor: AuditCursor | null
}

/** A resolvable actor: uid plus a best-effort display name. */
export interface ActorRef {
  uid: string
  displayName: string | null
}

/** Reference data to render the table + populate filter dropdowns without N+1 reads. */
export interface AuditLogReferenceData {
  /** Distinct actors seen, for the actor filter + name resolution (uid -> displayName). */
  actors: ActorRef[]
}

/**
 * READ-ONLY port for the immutable audit trail. There are intentionally NO
 * create/update/delete methods: audit_logs entries are only ever appended inside
 * withAudit() transactions, and the collection is immutable in firestore.rules
 * (allow update, delete: if false). Adding a write method here would be a
 * security FAIL.
 *
 * Implementations: firestoreAuditLogRepository (production),
 * inMemoryAuditLogRepository (tests/dev).
 */
export interface AuditLogRepository {
  /** Fetch one page of audit entries matching the query, sorted by `at` DESC.
   *  Pass `cursor = null` for the first page. */
  listAuditLogs(query: AuditLogQuery, cursor: AuditCursor | null): Promise<AuditLogPage>
  /** Load reference data (distinct actors with display names) for filters + name resolution. */
  loadReferenceData(): Promise<AuditLogReferenceData>
}

/** Re-export for convenience at call sites that build queries. */
export type { Role }
