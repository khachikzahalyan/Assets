import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, Chip, EmptyState, LoadingState, ErrorState, CardListSkeleton } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { CategoryFormDialog, type CategoryFormValues } from '@/components/features/categories'
import type { Category, CategoryRepository } from '@/domain/category'
import { FirestoreCategoryRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const GROUP_ORDER = ['devices', 'network', 'furniture'] as const

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
  const isMobile = useIsMobile()

  const [rows, setRows]             = useState<Category[]>([])
  const [loading, setLoad]          = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editing, setEditing]       = useState<Category | 'new' | null>(null)
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

  const total = rows.length

  // Group → chip colour (devices/network/furniture).
  const GROUP_CHIP: Record<string, 'blue' | 'green' | 'amber'> = {
    devices: 'blue', network: 'green', furniture: 'amber',
  }

  const columns: CatalogColumn<Category>[] = [
    {
      key: 'name',
      header: t('col.name'),
      width: '2fr',
      render: c => (
        <span className="flex items-center gap-2 min-w-0">
          <Icon name={c.lucideIcon} size={15} className="text-text-tertiary flex-shrink-0" />
          <span className="text-text-primary truncate">{c.name}</span>
        </span>
      ),
    },
    {
      key: 'group',
      header: t('col.group'),
      render: c => (
        <Chip color={GROUP_CHIP[c.group] ?? 'gray'}>{t(`group.${c.group}`)}</Chip>
      ),
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

  function openEdit(cat: Category) {
    setSaveError(null)
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
      const msg = e instanceof Error ? e.message : String(e)
      if (/name already in use/i.test(msg)) setSaveError(t('validation.nameTaken'))
      else setSaveError(t('validation.saveFailed'))
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
    if (loading) return isMobile ? <CardListSkeleton rows={6} variant="catalog" /> : <LoadingState rows={6} />
    if (error)   return <ErrorState onRetry={load} />
    if (rows.length === 0) return (
      <EmptyState icon="tags" title={t('empty.title')} description={t('empty.desc')} />
    )
    // Single clean table, ordered by group then name (group is now a column).
    const ordered = [...rows].sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.group as (typeof GROUP_ORDER)[number])
      const gb = GROUP_ORDER.indexOf(b.group as (typeof GROUP_ORDER)[number])
      if (ga !== gb) return ga - gb
      return a.name.localeCompare(b.name)
    })
    return (
      <CatalogTable
        rows={ordered}
        columns={columns}
        canMutate={canMutate}
        onEdit={openEdit}
        onDelete={askDelete}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon="tags" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
            <Icon name="tags" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

      {editing !== null && (
        <CategoryFormDialog
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
