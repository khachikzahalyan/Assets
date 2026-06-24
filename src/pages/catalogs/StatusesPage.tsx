import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, Chip, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { AssetStatusFormDialog, type AssetStatusFormValues } from '@/components/features/statuses'
import type { AssetStatus, AssetStatusRepository } from '@/domain/asset_status'
import { FirestoreAssetStatusRepository } from '@/infra/repositories'
import { EntityInUseError, SystemEntityProtectedError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

export interface StatusesPageProps { repository?: AssetStatusRepository }

export function StatusesPage({ repository }: StatusesPageProps) {
  const { t } = useTranslation('statuses')
  const { user, role } = useAuth()
  const defaultRepo = useMemo<AssetStatusRepository>(
    () => new FirestoreAssetStatusRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const canMutate = role === 'super_admin'

  const [page, setPage]       = useState(1)
  const [rows, setRows]       = useState<AssetStatus[]>([])
  const [loading, setLoad]    = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [editing, setEditing] = useState<AssetStatus | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<AssetStatus | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try { setRows(await repo.listAssetStatuses()) }
    catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [repo, t])
  useEffect(() => { void load() }, [load])

  const total    = rows.length
  const from     = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to       = Math.min(page * PAGE_SIZE, total)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<AssetStatus>[] = [
    {
      key: 'name',
      header: t('col.name'),
      render: s => <span className="text-text-primary">{s.name}</span>,
    },
    {
      key: 'color',
      header: t('col.color'),
      render: s => <Chip color={s.color as 'gray' | 'green' | 'blue' | 'red' | 'amber' | 'orange' | 'indigo' | 'violet' | 'teal' | 'cyan'}>{s.color}</Chip>,
    },
    {
      key: 'final',
      header: t('col.final'),
      render: s => (
        <Chip color={s.isFinal ? 'red' : 'gray'}>
          {t(s.isFinal ? 'final.yes' : 'final.no')}
        </Chip>
      ),
    },
    {
      key: 'system',
      header: t('col.system'),
      render: s => s.isSystem
        ? <Chip color="indigo">{t('systemBadge')}</Chip>
        : <span className="text-text-subtle">—</span>,
    },
    {
      key: 'order',
      header: t('col.order'),
      render: s => <span className="text-text-tertiary">{s.sortOrder}</span>,
    },
  ]

  async function handleSubmit(v: AssetStatusFormValues) {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') {
        await repo.updateAssetStatus(editing.id, v, { uid: user.id, role })
      } else {
        await repo.createAssetStatus(v, { uid: user.id, role })
      }
      setEditing(null); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/name already in use/i.test(msg)) setSaveError(t('validation.nameTaken'))
      else setSaveError(t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function askDelete(status: AssetStatus) {
    setBlockedMsg(null)
    try {
      const count = await repo.countReferences(status.id)
      if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    } catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(status)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try {
      await repo.deleteAssetStatus(deleting.id, { uid: user.id, role })
      setDeleting(null); setBlockedMsg(null); await load()
    } catch (e) {
      if (e instanceof EntityInUseError) {
        setBlockedMsg(t('delete.inUse', { count: e.count }))
      } else if (e instanceof SystemEntityProtectedError) {
        setBlockedMsg(t('delete.systemProtected'))
      } else {
        setDeleting(null); setError(t('validation.saveFailed'))
      }
    } finally { setDelBusy(false) }
  }

  function body() {
    if (loading) return <LoadingState rows={6} />
    if (error)   return <ErrorState onRetry={load} />
    if (rows.length === 0) return (
      <EmptyState icon="circle-dot" title={t('empty.title')} description={t('empty.desc')} />
    )
    return (
      <>
        <CatalogTable
          rows={pageRows}
          columns={columns}
          canMutate={canMutate}
          onEdit={s => { setSaveError(null); setEditing(s) }}
          onDelete={askDelete}
          canDeleteRow={s => !s.isSystem}
        />
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-2">
            <span className="text-[12px] text-text-subtle">
              {t('pagination.range', { from, to, total })}
            </span>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <Icon name="chevron-right" size={13} className="rotate-180" />
              </Btn>
              <Btn variant="secondary" size="sm" disabled={to >= total} onClick={() => setPage(p => p + 1)}>
                <Icon name="chevron-right" size={13} />
              </Btn>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="circle-dot" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
            <Icon name="circle-dot" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

      {editing !== null && (
        <AssetStatusFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          initial={editing !== 'new' ? editing : null}
          submitting={submitting}
          submitError={saveError}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
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
