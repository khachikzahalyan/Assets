import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  ListCard, ListPageShell,
  Icon,
  EmptyState, ErrorState,
  TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, CatalogPagination, ConfirmDeleteDialog, CatalogToolbarHeader, type CatalogColumn } from '@/components/features/catalogs'
import { DepartmentFormDialog, type DepartmentFormValues } from '@/components/features/departments'
import type { Department, DepartmentRepository } from '@/domain/department'
import { FirestoreDepartmentRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'
import { useCachedResource, cacheIdentity } from '@/hooks/useCachedResource'

const PAGE_SIZE = 10  // consistent with the other list pages so rows fill without scrolling

// Module-level lazy singleton — cache key stays stable across navigations.
let _sharedDeptRepo: FirestoreDepartmentRepository | null = null
function getSharedDeptRepo(): FirestoreDepartmentRepository {
  if (!_sharedDeptRepo) _sharedDeptRepo = new FirestoreDepartmentRepository(db())
  return _sharedDeptRepo
}

export interface DepartmentsPageProps { repository?: DepartmentRepository }

export function DepartmentsPage({ repository }: DepartmentsPageProps) {
  const { t } = useTranslation('departments')
  const { user, role } = useAuth()
  const repo = repository ?? getSharedDeptRepo()
  const canMutate = role === 'super_admin'
  const isMobile = useIsMobile()

  const [page, setPage]   = useState(1)
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Department | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const { data, loading, error: fetchError, reload } = useCachedResource<Department[]>(
    `departments:${cacheIdentity(repo)}`,
    () => repo.listDepartments(),
  )
  const rows = data ?? []

  const total = rows.length
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Department>[] = [
    { key: 'name', header: t('col.name'), render: d => <span className="text-text-primary">{d.name}</span> },
  ]

  const handleSubmit = useCallback(async (v: DepartmentFormValues) => {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') await repo.updateDepartment(editing.id, v, { uid: user.id, role })
      else await repo.createDepartment(v, { uid: user.id, role })
      setEditing(null); reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }, [editing, repo, user.id, role, reload, t])

  const askDelete = useCallback(async (d: Department) => {
    setBlockedMsg(null)
    try {
      const count = await repo.countReferences(d.id)
      if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    } catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(d)
  }, [repo, t])

  const confirmDelete = useCallback(async () => {
    if (!deleting) return
    setDelBusy(true)
    try {
      await repo.deleteDepartment(deleting.id, { uid: user.id, role })
      setDeleting(null); setBlockedMsg(null); reload()
    } catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null) }
    } finally { setDelBusy(false) }
  }, [deleting, repo, user.id, role, reload, t])

  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={10} variant="catalog" />
      : <TableSkeleton rows={PAGE_SIZE} columns={2} gridTemplate="minmax(160px,2fr) 80px" lastColAction />
    if (fetchError && rows.length === 0) return <ErrorState onRetry={reload} />
    if (rows.length === 0) return <EmptyState icon="network" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <CatalogTable
        rows={pageRows} columns={columns} canMutate={canMutate}
        onEdit={d => { setSaveError(null); setEditing(d) }}
        onDelete={askDelete}
        minRows={PAGE_SIZE}
        mobileIcon={() => (
          <span className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-sky-500/15 text-sky-300" aria-hidden="true">
            <Icon name="network" size={14} />
          </span>
        )}
        mobileMinRows={PAGE_SIZE}
      />
    )
  }

  return (
    <>
      <ListPageShell flushMobile>
        {/* Floating-card model (same as BranchesPage/CategoriesPage): NO flushMobile
            on the card — keeps rounded-lg radius on mobile; 10px side gutters;
            the .app-shell-content-flush flex chain stretches the card to the
            BottomNav top ('departments' is in AppShell FLUSH_ROUTES). */}
        <ListCard
          className="max-md:mx-[10px]"
          toolbar={
            <CatalogToolbarHeader
              icon="network"
              title={t('title')}
              {...(!loading ? { count: total } : {})}
              canMutate={canMutate}
              isMobile={isMobile}
              createLabel={t('create')}
              onCreate={() => { setSaveError(null); setEditing('new') }}
            />
          }
          pagination={
            /* Always mounted — total=0 during load renders disabled prev/next (EmployeesPage precedent). */
            <CatalogPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          }
        >
          {renderTableRegion()}
        </ListCard>
      </ListPageShell>

      {editing !== null && (
        <DepartmentFormDialog
          open
          initial={editing !== 'new' ? editing : null}
          submitting={submitting} submitError={saveError}
          onSubmit={handleSubmit} onCancel={() => setEditing(null)}
        />
      )}
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={t('delete.title')} body={t('delete.body')}
        confirmLabel={t('delete.confirm')} cancelLabel={t('delete.cancel')}
        blockedMessage={blockedMsg} busy={delBusy}
        onConfirm={confirmDelete} onCancel={() => { setDeleting(null); setBlockedMsg(null) }}
      />
    </>
  )
}
