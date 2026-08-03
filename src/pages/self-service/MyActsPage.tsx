import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Btn, Icon, ErrorState, EmptyState,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import { getSharedAssignmentRepository } from '@/infra/repositories'
import { actScanUrl } from '@/infra/storage'
import { storage } from '@/lib/firebase'

export interface MyActsPageProps {
  repository?: AssignmentRepository
}

export function MyActsPage({ repository }: MyActsPageProps) {
  const { t } = useTranslation('employees')
  const { user } = useAuth()
  // Invited employees: HR record id differs from uid — server-provisioned link wins.
  const employeeDocId = user.employeeId ?? user.id

  const repo = repository ?? getSharedAssignmentRepository()

  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const all = await repo.listAssignmentsForEmployee(employeeDocId)
      setAssignments(all)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, employeeDocId, t])

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
        {/* PageHeader: local i18n — render real */}
        <PageHeader icon="file-text" title={t('self.myActs')} className="max-md:hidden" />
        {/* SectionCard: render real header; only rows are async */}
        <SectionCard title={t('self.myActs')} icon="file-text">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[44px]">
                <div className="h-[0.75rem] w-[6rem] rounded anim-skeleton flex-shrink-0" />
                <div className="h-7 w-[7rem] rounded-lg anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>
        </SectionCard>
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
      {/* SectionCard below already shows the same title on mobile — hide PageHeader to avoid duplicate */}
      <PageHeader icon="file-text" title={t('self.myActs')} className="max-md:hidden" />

      {actionError && (
        <p role="alert" className="text-12 text-[#FDA4AF] light:text-rose-700 px-1">{actionError}</p>
      )}

      <SectionCard title={t('self.myActs')} icon="file-text">
        {acts.length === 0 ? (
          <EmptyState icon="file-text" title={t('self.noActs')} />
        ) : (
          <ul className="space-y-2">
            {acts.map(a => (
              <li key={a.id} className="flex items-center gap-3 min-h-[44px]">
                <span className="text-12 text-text-tertiary font-mono">{a.assetId}</span>
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
