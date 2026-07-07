import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ListCard, ListPageShell, PageHeader,
  EmptyState, LoadingState, ErrorState, CardListSkeleton,
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

export interface AuditPageProps {
  repository?: AuditLogRepository
}

export function AuditPage({ repository }: AuditPageProps) {
  const { t } = useTranslation(['audit', 'nav'])

  const defaultRepo = useMemo<AuditLogRepository>(
    () => new FirestoreAuditLogRepository(db()),
    // db() is stable across renders — the firebase sdk returns the same Firestore instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const isMobile = useIsMobile()

  const [query, setQuery] = useState<AuditLogQuery>({ ...DEFAULT_QUERY })

  const handleQueryChange = useCallback((patch: Partial<AuditLogQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
  }, [])

  const { rows, ref, loading, error, hasNext, page, goto, reload } =
    useAuditLogs(repo, query)

  function renderBody() {
    if (loading) return isMobile ? <CardListSkeleton rows={8} variant="audit" /> : <LoadingState rows={8} />
    if (error) return <ErrorState onRetry={reload} />
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

  const showPager = !loading && !error && rows.length > 0

  return (
    <ListPageShell
      flushMobile
      header={
        /* Desktop-only page header — on mobile the card starts directly with
           the filter bar (owner request: no title row on mobile). */
        !isMobile ? <PageHeader icon="history" title={t('items.audit', { ns: 'nav' })} /> : undefined
      }
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
              {ref && <AuditFilterBar query={query} onChange={handleQueryChange} ref={ref} />}
              {!ref && !error && <div className="h-9 rounded-lg anim-skeleton w-full" />}
            </div>
            <div className="border-t border-border" />
          </>
        }
        pagination={
          showPager ? (
            <AuditPagination
              page={page}
              pageSize={PAGE_SIZE}
              rowsOnPage={rows.length}
              hasNext={hasNext}
              onPage={goto}
            />
          ) : undefined
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
