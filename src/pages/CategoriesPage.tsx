import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, Chip, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { CategoryFormDialog, type CategoryFormValues } from '@/components/features/categories'
import type { Category, CategoryRepository } from '@/domain/category'
import { FirestoreCategoryRepository } from '@/infra/repositories'
import { EntityInUseError, PrefixLockedError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

export interface CategoriesPageProps { repository?: CategoryRepository }

export function CategoriesPage({ repository }: CategoriesPageProps) {
  const { t } = useTranslation('categories')
  const { user, role } = useAuth()
  const defaultRepo = useMemo<CategoryRepository>(
    () => new FirestoreCategoryRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  const canMutate = role === 'super_admin'

  const [page, setPage]       = useState(1)
  const [rows, setRows]       = useState<Category[]>([])
  const [loading, setLoad]    = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [prefixLocked, setPrefixLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Category | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try { setRows(await repo.listCategories()) }
    catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [repo, t])
  useEffect(() => { void load() }, [load])

  const total   = rows.length
  const from    = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to      = Math.min(page * PAGE_SIZE, total)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Category>[] = [
    {
      key: 'name',
      header: t('col.name'),
      render: c => <span className="text-text-primary">{c.name}</span>,
    },
    {
      key: 'group',
      header: t('col.group'),
      render: c => <Chip color="indigo">{t(`group.${c.group}`)}</Chip>,
    },
    {
      key: 'prefix',
      header: t('col.prefix'),
      render: c => <span className="font-mono text-text-tertiary">{c.prefix}</span>,
    },
    {
      key: 'specs',
      header: t('col.specs'),
      render: c => (
        <Chip color={c.hasSpecs ? 'green' : 'gray'}>
          {t(c.hasSpecs ? 'specs.yes' : 'specs.no')}
        </Chip>
      ),
    },
  ]

  async function openEdit(cat: Category) {
    setSaveError(null)
    try {
      const count = await repo.countReferences(cat.id)
      setPrefixLocked(count > 0)
    } catch {
      setPrefixLocked(false)
    }
    setEditing(cat)
  }

  async function handleSubmit(v: CategoryFormValues) {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') {
        await repo.updateCategory(editing.id, v, { uid: user.id, role })
      } else {
        await repo.createCategory(v, { uid: user.id, role })
      }
      setEditing(null); await load()
    } catch (e) {
      if (e instanceof PrefixLockedError) {
        setSaveError(t('form.prefixLocked'))
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        if (/name already in use/i.test(msg)) setSaveError(t('validation.nameTaken'))
        else if (/prefix already in use/i.test(msg)) setSaveError(t('validation.prefixTaken'))
        else setSaveError(t('validation.saveFailed'))
      }
    } finally { setSubmitting(false) }
  }

  async function askDelete(cat: Category) {
    setBlockedMsg(null)
    try {
      const count = await repo.countReferences(cat.id)
      if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    } catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(cat)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try {
      await repo.deleteCategory(deleting.id, { uid: user.id, role })
      setDeleting(null); setBlockedMsg(null); await load()
    } catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null); setError(t('validation.saveFailed')) }
    } finally { setDelBusy(false) }
  }

  function body() {
    if (loading) return <LoadingState rows={6} />
    if (error)   return <ErrorState onRetry={load} />
    if (rows.length === 0) return (
      <EmptyState icon="tags" title={t('empty.title')} description={t('empty.desc')} />
    )
    return (
      <>
        <CatalogTable
          rows={pageRows} columns={columns} canMutate={canMutate}
          onEdit={openEdit}
          onDelete={askDelete}
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
        icon="tags" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setPrefixLocked(false); setEditing('new') }}>
            <Icon name="tags" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

      {editing !== null && (
        <CategoryFormDialog
          open
          initial={editing !== 'new' ? editing : null}
          prefixLocked={prefixLocked}
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
