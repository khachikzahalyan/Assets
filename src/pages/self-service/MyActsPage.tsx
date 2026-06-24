import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Btn, Icon, ErrorState, EmptyState,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import { FirestoreAssignmentRepository } from '@/infra/repositories'
import { actScanUrl } from '@/infra/storage'
import { db, storage } from '@/lib/firebase'

export interface MyActsPageProps {
  repository?: AssignmentRepository
}

export function MyActsPage({ repository }: MyActsPageProps) {
  const { t } = useTranslation('employees')
  const { user } = useAuth()

  const defaultRepo = useMemo<AssignmentRepository>(
    () => new FirestoreAssignmentRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const all = await repo.listAssignmentsForEmployee(user.id)
      setAssignments(all)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, user.id, t])

  useEffect(() => {
    void load()
  }, [load])

  function handleViewScan(path: string) {
    void actScanUrl(storage(), path)
      .then(u => window.open(u, '_blank', 'noopener'))
      .catch(() => setActionError(t('validation.saveFailed')))
  }

  // Only rows that have a scan attached
  const acts = assignments.filter(a => a.actStoragePath)

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="file-text" title={t('self.myActs')} />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
            <Icon name="file-text" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
            <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
              {t('self.myActs')}
            </span>
          </div>
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[44px]">
                {/* assetId stub — DB data */}
                <div className="h-[12px] w-[96px] rounded anim-skeleton flex-shrink-0" />
                {/* view-scan button — REAL disabled label */}
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-lg text-[12.5px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
                >
                  <Icon name="arrow-right-left" size={13} />
                  {t('detail.viewScan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader icon="file-text" title={t('self.myActs')} />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader icon="file-text" title={t('self.myActs')} />

      {actionError && (
        <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{actionError}</p>
      )}

      <SectionCard title={t('self.myActs')} icon="file-text">
        {acts.length === 0 ? (
          <EmptyState icon="file-text" title={t('self.noActs')} />
        ) : (
          <ul className="space-y-2">
            {acts.map(a => (
              <li key={a.id} className="flex items-center gap-3 min-h-[44px]">
                <span className="text-[12px] text-text-tertiary font-mono">{a.assetId}</span>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => a.actStoragePath && handleViewScan(a.actStoragePath)}
                >
                  <Icon name="arrow-right-left" size={13} />
                  {t('detail.viewScan')}
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
