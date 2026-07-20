import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ListCard, ListPageShell,
  EmptyState, TableSkeleton, ErrorState, CardListSkeleton,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { AuditFilterBar, AuditTable, AuditPagination } from '@/components/features/audit'
import { useAuditLogs } from '@/hooks'
import type { AuditLogQuery } from '@/domain/audit'
import type { AuditLogRepository } from '@/domain/audit'
import { FirestoreAuditLogRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 10  // consistent with the other list pages (table standard: ≤10 rows/page)

const DEFAULT_QUERY: AuditLogQuery = {
  entityType: 'all', action: 'all', actorUid: 'all',
  fromDate: null, toDate: null, search: '', pageSize: PAGE_SIZE,
}

// Module-level lazy singleton — cache key stays stable across navigations.
let _sharedAuditRepo: FirestoreAuditLogRepository | null = null
function getSharedAuditRepo(): FirestoreAuditLogRepository {
  if (!_sharedAuditRepo) _sharedAuditRepo = new FirestoreAuditLogRepository(db())
  return _sharedAuditRepo
}

export interface AuditPageProps {
  repository?: AuditLogRepository
}

export function AuditPage({ repository }: AuditPageProps) {
  const { t } = useTranslation('audit')

  const repo = repository ?? getSharedAuditRepo()
  const isMobile = useIsMobile()

  const [query, setQuery] = useState<AuditLogQuery>({ ...DEFAULT_QUERY })

  const handleQueryChange = useCallback((patch: Partial<AuditLogQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
  }, [])

  const { rows, ref, loading, error, hasNext, page, goto, reload } =
    useAuditLogs(repo, query)

  function renderBody() {
    if (loading) return isMobile ? <CardListSkeleton rows={10} variant="audit" /> : <TableSkeleton rows={10} columns={7} gridTemplate="36px minmax(130px,1fr) minmax(120px,1.5fr) minmax(100px,1fr) minmax(90px,1fr) minmax(90px,1fr) minmax(120px,1.2fr)" />
    // Any error with zero rows renders the ErrorState — NOT gated on `!ref`:
    // ref data loads without composite indexes, so a failed page query (e.g.
    // failed-precondition on a missing index) would otherwise be masked as an
    // "empty journal". Errors with rows still visible keep showing the rows.
    if (error && rows.length === 0) return <ErrorState onRetry={reload} />
    if (rows.length === 0) {
      return (
        <EmptyState
          icon="history"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }
    return ref ? <AuditTable rows={rows} ref={ref} minRows={PAGE_SIZE} mobileMinRows={PAGE_SIZE} /> : null
  }

  return (
    <ListPageShell
      flushMobile
    >
      {/* Floating-card model (same as AssetsPage/EmployeesPage): NO flushMobile
          on the card — keeps rounded-lg radius on mobile; 10px side gutters;
          the .app-shell-content-flush flex chain stretches the card to the
          BottomNav top ('audit' is in AppShell FLUSH_ROUTES). */}
      <ListCard
        className="max-md:mx-[10px]"
        toolbar={
          <>
            <div className="px-5 py-3 max-md:px-3 max-md:py-2.5">
              <AuditFilterBar query={query} onChange={handleQueryChange} ref={ref} />
            </div>
            <div className="border-t border-border" />
          </>
        }
        pagination={
          /* Always mounted — rowsOnPage=0 during load renders disabled prev/next,
             preventing the ~44px layout shift (EmployeesPage precedent). */
          <AuditPagination
            page={page}
            pageSize={PAGE_SIZE}
            rowsOnPage={rows.length}
            hasNext={hasNext}
            onPage={goto}
          />
        }
      >
        {/* Zone 2 fill: flex-col scroller so the mobile list's grow fill contract
            works (never a plain padded div — it breaks the flex chain). Desktop
            keeps inner padding for DataTable; mobile is edge-to-edge like every
            other card list (MobileListRow carries its own 14px padding). */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col px-5 py-3 max-md:p-0">
          {renderBody()}
        </div>
      </ListCard>
    </ListPageShell>
  )
}
