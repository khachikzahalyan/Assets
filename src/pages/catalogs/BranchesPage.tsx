import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  ListCard, ListPageShell,
  Icon, Chip,
  EmptyState, ErrorState,
  TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, CatalogPagination, ConfirmDeleteDialog, CatalogToolbarHeader, type CatalogColumn } from '@/components/features/catalogs'
import { BranchFormDialog, type BranchFormValues } from '@/components/features/branches'
import type { Branch, BranchListQuery, BranchRepository } from '@/domain/branch'
import { FirestoreBranchRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 10  // consistent with the other list pages so rows fill without scrolling

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
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Branch>[] = [
    { key: 'name', header: t('col.name'), width: 'minmax(160px,2fr)', render: b => <span className="text-text-primary">{b.name}</span> },
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

  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={6} variant="catalog" />
      : <TableSkeleton rows={PAGE_SIZE} columns={4} gridTemplate="minmax(160px,2fr) 1fr 1fr 80px" lastColAction />
    if (error) return <ErrorState onRetry={load} />
    if (rows.length === 0) return <EmptyState icon="building" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <CatalogTable
        rows={pageRows}
        columns={columns}
        canMutate={canMutate}
        onEdit={b => { setSaveError(null); setEditing(b) }}
        onDelete={askDelete}
        minRows={PAGE_SIZE}
        mobileIcon={(b) => (
          <span
            className={[
              'w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0',
              b.type === 'warehouse' ? 'bg-amber-500/15 text-amber-300' : 'bg-sky-500/15 text-sky-300',
            ].join(' ')}
            aria-hidden="true"
          >
            <Icon name={b.type === 'warehouse' ? 'warehouse' : 'building'} size={14} />
          </span>
        )}
        mobileSubline={(b) => (
          <div className="text-[11px] text-text-tertiary truncate leading-snug flex items-center gap-1.5">
            <Chip color={b.type === 'warehouse' ? 'amber' : 'blue'}>{t(`type.${b.type}`)}</Chip>
            {b.city && (
              <>
                <span aria-hidden="true">·</span>
                <span>{b.city}</span>
              </>
            )}
          </div>
        )}
        mobileMinRows={PAGE_SIZE}
      />
    )
  }

  return (
    <>
      <ListPageShell flushMobile>
        {/* Floating-card model (same as AssetsPage/EmployeesPage): NO flushMobile
            on the card — keeps rounded-lg radius on mobile; 10px side gutters;
            the .app-shell-content-flush flex chain stretches the card to the
            BottomNav top ('branches' is in AppShell FLUSH_ROUTES). */}
        <ListCard
          className="max-md:mx-[10px]"
          toolbar={
            <CatalogToolbarHeader
              icon="building"
              title={t('title')}
              count={loading ? undefined : total}
              canMutate={canMutate}
              isMobile={isMobile}
              createLabel={t('create')}
              onCreate={() => { setSaveError(null); setEditing('new') }}
            />
          }
          pagination={
            !loading && !error && total > 0 ? (
              <CatalogPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
            ) : undefined
          }
        >
          {renderTableRegion()}
        </ListCard>
      </ListPageShell>

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
    </>
  )
}
