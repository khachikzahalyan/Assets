import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { AuditFilterBar, AuditTable } from '@/components/features/audit'
import { useAuditLogs } from '@/hooks'
import type { AuditLogQuery } from '@/domain/audit'
import type { AuditLogRepository } from '@/domain/audit'
import { FirestoreAuditLogRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 20

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

  const [query, setQuery] = useState<AuditLogQuery>({ ...DEFAULT_QUERY })

  const handleQueryChange = useCallback((patch: Partial<AuditLogQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
  }, [])

  const { rows, ref, loading, error, hasNext, hasPrev, page, next, prev, reload } =
    useAuditLogs(repo, query)

  function renderBody() {
    if (loading) return <LoadingState rows={8} />
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
    return (
      <>
        {ref && <AuditTable rows={rows} ref={ref} />}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
          <span className="text-[12px] text-text-subtle">{t('pagination.page', { page })}</span>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" size="sm" disabled={!hasPrev} onClick={prev} aria-label={t('pagination.prev')}>
              <Icon name="chevron-right" size={13} className="rotate-180" />
            </Btn>
            <Btn variant="secondary" size="sm" disabled={!hasNext} onClick={next} aria-label={t('pagination.next')}>
              <Icon name="chevron-right" size={13} />
            </Btn>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader icon="history" title={t('items.audit', { ns: 'nav' })} />
      <SectionCard noHeader>
        <div className="space-y-4">
          {ref && <AuditFilterBar query={query} onChange={handleQueryChange} ref={ref} />}
          {!ref && !error && <div className="h-9 rounded-lg anim-skeleton w-full" />}
          {renderBody()}
        </div>
      </SectionCard>
    </div>
  )
}
