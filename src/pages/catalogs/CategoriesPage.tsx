import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  ListCard, ListPageShell,
  Btn, Icon, Chip,
  EmptyState, ErrorState,
  TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import {
  CategoryFormDialog, type CategoryFormValues,
  CategoryGroupFormDialog,
  CategoryGroupChips,
} from '@/components/features/categories'
import { PaginationBar } from '@/components/features/assets/PaginationBar'
import type { Category, CategoryGroup, CategoryRepository, CategoryGroupRepository } from '@/domain/category'
import { FirestoreCategoryRepository, FirestoreCategoryGroupRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'
import { useCategoryGroupCrud } from './useCategoryGroupCrud'

const PAGE_SIZE = 10

export interface CategoriesPageProps {
  repository?: CategoryRepository
  categoryGroupRepository?: CategoryGroupRepository
}

export function CategoriesPage({ repository, categoryGroupRepository }: CategoriesPageProps) {
  const { t } = useTranslation('categories')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()

  const defaultRepo = useMemo<CategoryRepository>(
    () => new FirestoreCategoryRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const defaultGroupRepo = useMemo<CategoryGroupRepository>(
    () => new FirestoreCategoryGroupRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo      = repository ?? defaultRepo
  const groupRepo = categoryGroupRepository ?? defaultGroupRepo
  const canMutate = role === 'super_admin'

  // ── Data ─────────────────────────────────────────────────────────────────
  const [groups, setGroups]                   = useState<CategoryGroup[]>([])
  const [rows, setRows]                       = useState<Category[]>([])
  const [loading, setLoad]                    = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // ── Subcategory CRUD state ────────────────────────────────────────────────
  const [editing, setEditing]       = useState<Category | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Category | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)
  const [page, setPage]             = useState(1)

  // ── Derived ───────────────────────────────────────────────────────────────
  const counts = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const c of rows) map[c.categoryGroupId] = (map[c.categoryGroupId] ?? 0) + 1
    return map
  }, [rows])

  const selectedGroup = useMemo(
    () => groups.find(g => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const filtered = useMemo(
    () => rows.filter(c => c.categoryGroupId === selectedGroupId).sort((a, b) => a.name.localeCompare(b.name)),
    [rows, selectedGroupId],
  )
  const total    = filtered.length
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try {
      const [gs, cs] = await Promise.all([groupRepo.listCategoryGroups(), repo.listCategories()])
      setGroups(gs)
      setRows(cs)
      setSelectedGroupId(prev =>
        prev !== null && gs.some(g => g.id === prev) ? prev : (gs[0]?.id ?? null),
      )
    } catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [groupRepo, repo, t])
  useEffect(() => { void load() }, [load])

  // ── Group CRUD (hook) ─────────────────────────────────────────────────────
  const {
    groupEditing, setGroupEditing,
    groupSubmitting,
    groupSaveError, setGroupSaveError,
    groupDeleting, setGroupDeleting,
    groupBlockedMsg, setGroupBlockedMsg,
    groupDelBusy,
    handleGroupSubmit, askDeleteGroup, confirmDeleteGroup,
  } = useCategoryGroupCrud(groupRepo, load, setError)

  // ── Columns ───────────────────────────────────────────────────────────────
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
      key: 'specs',
      header: t('col.specs'),
      render: c => (
        <Chip color={c.hasSpecs ? 'green' : 'gray'}>
          {t(c.hasSpecs ? 'specs.yes' : 'specs.no')}
        </Chip>
      ),
    },
  ]

  // ── Subcategory handlers ──────────────────────────────────────────────────
  function openEdit(cat: Category) { setSaveError(null); setEditing(cat) }

  async function handleSubmit(v: CategoryFormValues) {
    if (!selectedGroupId || !selectedGroup) return
    setSubmitting(true); setSaveError(null)
    const actor = { uid: user.id, role }
    try {
      if (editing && editing !== 'new') {
        await repo.updateCategory(editing.id, { ...v, categoryGroupId: selectedGroupId, group: selectedGroup.behavior }, actor)
      } else {
        await repo.createCategory({ ...v, group: selectedGroup.behavior, categoryGroupId: selectedGroupId }, actor)
      }
      setEditing(null); setPage(1); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function askDelete(cat: Category) {
    setBlockedMsg(null)
    try { const n = await repo.countReferences(cat.id); if (n > 0) setBlockedMsg(t('delete.inUse', { count: n })) }
    catch { /* fall through; confirmDelete re-guards */ }
    setDeleting(cat)
  }

  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try {
      await repo.deleteCategory(deleting.id, { uid: user.id, role })
      setDeleting(null); setBlockedMsg(null); setPage(1); await load()
    } catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null); setError(t('validation.saveFailed')) }
    } finally { setDelBusy(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={6} variant="catalog" />
      : <TableSkeleton rows={PAGE_SIZE} columns={3} gridTemplate="minmax(160px,2fr) 1fr 80px" lastColAction />
    if (error) return <ErrorState onRetry={load} />
    if (!selectedGroupId || filtered.length === 0) return (
      <EmptyState icon="tags" title={t('empty.title')} description={t('empty.desc')} />
    )
    return (
      <CatalogTable rows={pageRows} columns={columns} canMutate={canMutate} onEdit={openEdit} onDelete={askDelete} minRows={PAGE_SIZE} />
    )
  }

  return (
    <>
      <ListPageShell flushMobile>
        <ListCard
          flushMobile
          toolbar={
            <>
              {/* Row 1: heading + add-subcategory button */}
              <div className="flex items-center justify-between gap-3 px-5 py-3 max-md:px-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="tags" size={16} className="text-text-tertiary flex-shrink-0" />
                  <h1 className="text-[15px] font-semibold text-text-primary">{t('subcategories')}</h1>
                  {!loading && (
                    <span className="text-[13px] text-text-tertiary tabular-nums">{total}</span>
                  )}
                </div>
                {canMutate && (
                  <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
                    <Icon name="plus" size={14} />{t('createSubcategory')}
                  </Btn>
                )}
              </div>
              <div className="border-t border-border" />
              {/* Row 2: group chips */}
              {loading ? (
                <div className="flex flex-wrap gap-2 px-5 py-3 max-md:px-3">
                  {[80, 100, 72].map(w => (
                    <div key={w} style={{ width: w }} className="h-8 rounded-full bg-surface-2 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-3 max-md:px-3">
                  <CategoryGroupChips
                    groups={groups}
                    counts={counts}
                    selectedId={selectedGroupId ?? ''}
                    onSelect={id => { setSelectedGroupId(id); setPage(1) }}
                    onEdit={g => { setGroupSaveError(null); setGroupEditing(g) }}
                    onDelete={askDeleteGroup}
                    onAdd={() => { setGroupSaveError(null); setGroupEditing('new') }}
                    canMutate={canMutate}
                  />
                </div>
              )}
              <div className="border-t border-border" />
            </>
          }
          pagination={
            !loading && !error && total > PAGE_SIZE ? (
              <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
            ) : undefined
          }
        >
          {renderTableRegion()}
        </ListCard>
      </ListPageShell>

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

      {groupEditing !== null && (
        <CategoryGroupFormDialog
          open
          initial={groupEditing !== 'new' ? groupEditing : null}
          submitting={groupSubmitting} submitError={groupSaveError}
          onSubmit={handleGroupSubmit} onCancel={() => setGroupEditing(null)}
        />
      )}
      <ConfirmDeleteDialog
        open={groupDeleting !== null}
        title={t('groupDelete.title')} body={t('groupDelete.body')}
        confirmLabel={t('groupDelete.confirm')} cancelLabel={t('groupDelete.cancel')}
        blockedMessage={groupBlockedMsg} busy={groupDelBusy}
        onConfirm={confirmDeleteGroup} onCancel={() => { setGroupDeleting(null); setGroupBlockedMsg(null) }}
      />
    </>
  )
}
