import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, Chip, EmptyState, LoadingState, ErrorState, CardListSkeleton } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { BranchFormDialog, type BranchFormValues } from '@/components/features/branches'
import type { Branch, BranchListQuery, BranchRepository } from '@/domain/branch'
import { FirestoreBranchRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

export interface BranchesPageProps { repository?: BranchRepository }

export function BranchesPage({ repository }: BranchesPageProps) {
  const { t } = useTranslation('branches')
  const { user, role } = useAuth()
  const defaultRepo = useMemo<BranchRepository>(
    () => new FirestoreBranchRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const canMutate = role === 'super_admin' || role === 'asset_admin'
  const isMobile = useIsMobile()

  const [query] = useState<BranchListQuery>({ type: 'all', search: '' })
  const [page, setPage]   = useState(1)
  const [rows, setRows]   = useState<Branch[]>([])
  const [loading, setLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Branch | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try { setRows(await repo.listBranches(query)) }
    catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [repo, query, t])
  useEffect(() => { void load() }, [load])

  const total = rows.length
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Branch>[] = [
    { key: 'name', header: t('col.name'), render: b => <span className="text-text-primary">{b.name}</span> },
    { key: 'type', header: t('col.type'), render: b => <Chip color={b.type === 'warehouse' ? 'amber' : 'blue'}>{t(`type.${b.type}`)}</Chip> },
    { key: 'city', header: t('col.city'), render: b => <span className="text-text-tertiary">{b.city ?? '—'}</span> },
  ]

  async function handleSubmit(v: BranchFormValues) {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') await repo.updateBranch(editing.id, v, { uid: user.id, role })
      else await repo.createBranch(v, { uid: user.id, role })
      setEditing(null); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function askDelete(b: Branch) {
    setBlockedMsg(null)
    try {
      const count = await repo.countReferences(b.id)
      if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    } catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(b)
  }
  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try { await repo.deleteBranch(deleting.id, { uid: user.id, role }); setDeleting(null); setBlockedMsg(null); await load() }
    catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null); setError(t('validation.saveFailed')) }
    } finally { setDelBusy(false) }
  }

  function body() {
    if (loading) return isMobile ? <CardListSkeleton rows={6} variant="catalog" /> : <LoadingState rows={6} />
    if (error) return <ErrorState onRetry={load} />
    if (rows.length === 0) return <EmptyState icon="building" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <>
        <CatalogTable
          rows={pageRows} columns={columns} canMutate={canMutate}
          onEdit={b => { setSaveError(null); setEditing(b) }}
          onDelete={askDelete}
        />
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
            <span className="text-[12px] text-text-subtle">{t('pagination.range', { from, to, total })}</span>
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
    <div className="space-y-5">
      <PageHeader
        icon="building" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
            <Icon name="building" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

      {editing !== null && (
        <BranchFormDialog
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
