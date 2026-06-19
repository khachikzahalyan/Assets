import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { DepartmentFormDialog, type DepartmentFormValues } from '@/components/features/departments'
import type { Department, DepartmentRepository } from '@/domain/department'
import { FirestoreDepartmentRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

export interface DepartmentsPageProps { repository?: DepartmentRepository }

export function DepartmentsPage({ repository }: DepartmentsPageProps) {
  const { t } = useTranslation('departments')
  const { user, role } = useAuth()
  const defaultRepo = useMemo<DepartmentRepository>(
    () => new FirestoreDepartmentRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const canMutate = role === 'super_admin'

  const [page, setPage]   = useState(1)
  const [rows, setRows]   = useState<Department[]>([])
  const [loading, setLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Department | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Department | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try { setRows(await repo.listDepartments()) }
    catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [repo, t])
  useEffect(() => { void load() }, [load])

  const total = rows.length
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Department>[] = [
    { key: 'name', header: t('col.name'), render: d => <span className="text-[#F8FAFC]">{d.name}</span> },
  ]

  async function handleSubmit(v: DepartmentFormValues) {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') await repo.updateDepartment(editing.id, v, { uid: user.id, role })
      else await repo.createDepartment(v, { uid: user.id, role })
      setEditing(null); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function askDelete(d: Department) {
    setBlockedMsg(null)
    try {
      const count = await repo.countReferences(d.id)
      if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    } catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(d)
  }
  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try { await repo.deleteDepartment(deleting.id, { uid: user.id, role }); setDeleting(null); setBlockedMsg(null); await load() }
    catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null); setError(t('validation.saveFailed')) }
    } finally { setDelBusy(false) }
  }

  function body() {
    if (loading) return <LoadingState rows={6} />
    if (error) return <ErrorState onRetry={load} />
    if (rows.length === 0) return <EmptyState icon="network" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <>
        <CatalogTable
          rows={pageRows} columns={columns} canMutate={canMutate}
          onEdit={d => { setSaveError(null); setEditing(d) }}
          onDelete={askDelete}
        />
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#2A2F36] mt-2">
            <span className="text-[12px] text-[#64748B]">{t('pagination.range', { from, to, total })}</span>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><Icon name="chevron-right" size={13} className="rotate-180" /></Btn>
              <Btn variant="secondary" size="sm" disabled={to >= total} onClick={() => setPage(p => p + 1)}><Icon name="chevron-right" size={13} /></Btn>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="network" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
            <Icon name="network" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

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
    </div>
  )
}
