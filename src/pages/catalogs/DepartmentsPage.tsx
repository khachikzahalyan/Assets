import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  ListCard, ListPageShell,
  Icon,
  EmptyState, ErrorState,
  TableSkeleton, CardListSkeleton,
  DIALOG_BACKDROP, MODAL_SHEET,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, CatalogPagination, ConfirmDeleteDialog, CatalogToolbarHeader, type CatalogColumn } from '@/components/features/catalogs'
import { DepartmentFormDialog, type DepartmentFormValues } from '@/components/features/departments'
import type { Department, DepartmentRepository } from '@/domain/department'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import { getSharedDepartmentRepository, getSharedEmployeeRepository, invalidateReferenceCaches } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { useCachedResource, cacheIdentity } from '@/hooks/useCachedResource'
import { useMemo } from 'react'

const PAGE_SIZE = 10  // consistent with the other list pages so rows fill without scrolling

export interface DepartmentsPageProps {
  repository?: DepartmentRepository
  employeeRepository?: EmployeeRepository
}

export function DepartmentsPage({ repository, employeeRepository }: DepartmentsPageProps) {
  const { t } = useTranslation('departments')
  const { user, role } = useAuth()
  const repo = repository ?? getSharedDepartmentRepository()
  const empRepo = employeeRepository ?? getSharedEmployeeRepository()
  const canMutate = role === 'super_admin'
  const isMobile = useIsMobile()

  const [page, setPage]   = useState(1)
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Department | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)
  // Department whose employee list is open in the roster dialog
  const [viewing, setViewing]       = useState<Department | null>(null)

  const { data, loading, error: fetchError, reload } = useCachedResource<Department[]>(
    `departments:${cacheIdentity(repo)}`,
    () => repo.listDepartments(),
  )
  const rows = data ?? []

  // Active-employee headcount per department (owner request) — one cached fetch,
  // counted client-side; terminated employees are excluded.
  const { data: empData } = useCachedResource<Employee[]>(
    `departments:headcount:${cacheIdentity(empRepo)}`,
    () => empRepo.listEmployees(),
  )
  const headcount = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const e of empData ?? []) {
      if (e.status === 'terminated') continue
      if (e.departmentId) map[e.departmentId] = (map[e.departmentId] ?? 0) + 1
    }
    return map
  }, [empData])

  const total = rows.length
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Department>[] = [
    { key: 'name', header: t('col.name'), width: 'minmax(10rem,2fr)', render: d => <span className="text-text-primary">{d.name}</span> },
    {
      key: 'employees',
      header: t('col.employees'),
      render: d => (
        /* Click opens the department roster dialog (owner request) */
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setViewing(d) }}
          className="inline-flex items-center gap-1.5 h-7 px-2 -ml-2 rounded-md text-13 text-text-tertiary tabular-nums hover:text-text-primary hover:bg-surface-2 transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
          aria-label={`${t('col.employees')} — ${d.name}`}
        >
          <Icon name="users" size={13} className="flex-shrink-0" />
          {empData === undefined ? '—' : (headcount[d.id] ?? 0)}
        </button>
      ),
    },
  ]

  // Active employees of the department whose roster dialog is open
  const viewingEmployees = viewing
    ? (empData ?? []).filter(e => e.departmentId === viewing.id && e.status !== 'terminated')
    : []

  const handleSubmit = useCallback(async (v: DepartmentFormValues) => {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') await repo.updateDepartment(editing.id, v, { uid: user.id, role, displayName: user.name })
      else await repo.createDepartment(v, { uid: user.id, role, displayName: user.name })
      invalidateReferenceCaches()  // asset/location views resolve dept names by id
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
      await repo.deleteDepartment(deleting.id, { uid: user.id, role, displayName: user.name })
      invalidateReferenceCaches()
      setDeleting(null); setBlockedMsg(null); reload()
    } catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null) }
    } finally { setDelBusy(false) }
  }, [deleting, repo, user.id, role, reload, t])

  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={10} variant="catalog" />
      : canMutate
        // super_admin: name + employees + 5rem action track (mirrors CatalogTable's
        // appended __actions column when canMutate). Employees track is the default '1fr'.
        ? <TableSkeleton rows={PAGE_SIZE} columns={3} gridTemplate="minmax(10rem,2fr) 1fr 5rem" lastColAction headers={[t('col.name'), t('col.employees'), '']} />
        // asset_admin: view-only — CatalogTable drops the action column, so no 5rem track.
        : <TableSkeleton rows={PAGE_SIZE} columns={2} gridTemplate="minmax(10rem,2fr) 1fr" headers={[t('col.name'), t('col.employees')]} />
    if (fetchError && rows.length === 0) return <ErrorState onRetry={reload} />
    if (rows.length === 0) return <EmptyState icon="network" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <CatalogTable
        rows={pageRows} columns={columns} canMutate={canMutate}
        onEdit={d => { setSaveError(null); setEditing(d) }}
        onDelete={askDelete}
        minRows={PAGE_SIZE}
        mobileIcon={() => (
          <span className="w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-sky-500/15 text-sky-300 light:text-sky-700" aria-hidden="true">
            <Icon name="network" size={14} />
          </span>
        )}
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
          className="max-md:mx-2.5"
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

      {/* Department roster dialog — active employees of the clicked department.
          Portalled to document.body (project standard: the shell is a stacking
          context, inline fixed backdrops get clipped). */}
      {viewing !== null && createPortal(
        <div
          role="presentation"
          className={`${DIALOG_BACKDROP} backdrop-blur-sm`}
          onClick={e => { if (e.target === e.currentTarget) setViewing(null) }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="dept-roster-title"
            className={`w-full max-w-md bg-surface border border-border rounded-xl max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[85dvh] max-md:overflow-y-auto shadow-2xl mx-4 max-md:mx-0 ${MODAL_SHEET}`}
          >
            <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-md bg-sky-500/15 text-sky-300 inline-flex items-center justify-center flex-shrink-0 light:text-sky-700">
                  <Icon name="network" size={14} />
                </span>
                <h2 id="dept-roster-title" className="text-15 font-bold text-text-primary truncate">
                  {viewing.name}
                </h2>
                <span className="text-12 text-text-subtle tabular-nums flex-shrink-0">
                  {viewingEmployees.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label={t('delete.cancel')}
                className="w-7 h-7 rounded-md text-text-subtle hover:text-text-primary hover:bg-surface-2 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Icon name="x" size={15} />
              </button>
            </header>

            <div className="px-2 pb-4 max-h-[60dvh] overflow-y-auto">
              {viewingEmployees.length === 0 ? (
                <p className="px-3 py-8 text-center text-13 text-text-tertiary">
                  {t('employeesDialog.empty')}
                </p>
              ) : (
                viewingEmployees.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors">
                    <span className="w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-subtle" aria-hidden="true">
                      <Icon name="user" size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-13 font-semibold text-text-primary truncate leading-snug">
                        {e.firstName} {e.lastName}
                      </div>
                      {e.position && (
                        <div className="text-11.5 text-text-tertiary truncate leading-snug">{e.position}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
