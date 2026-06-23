import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Btn, Icon, LoadingState, ErrorState, EmptyState,
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
      <div className="space-y-5">
        <PageHeader icon="file-text" title="…" />
        <LoadingState rows={5} />
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
