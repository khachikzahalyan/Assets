import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  ListCard, ListPageShell,
  Icon, Chip,
  Btn, MobileAddButton,
  EmptyState, ErrorState,
  TableSkeleton, CardListSkeleton,
  TabStrip,
} from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CatalogTable, CatalogPagination, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import {
  CategoryFormDialog, type CategoryFormValues,
  CategoryGroupFormDialog,
  CategoryGroupChips,
  PartCategoriesSection,
} from '@/components/features/categories'
import type { Category, CategoryGroup, CategoryRepository, CategoryGroupRepository } from '@/domain/category'
import { getSharedCategoryRepository, getSharedCategoryGroupRepository, getSharedPartCategoryRepository, invalidateReferenceCaches } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { useCachedResource, cacheIdentity } from '@/hooks/useCachedResource'
import { useCategoryGroupCrud } from './useCategoryGroupCrud'
import type { PartCategoryRepository } from '@/domain/part/PartCategoryRepository'

const PAGE_SIZE = 10

type CategoriesTab = 'assets' | 'parts'

interface CategoriesSnapshot {
  groups: CategoryGroup[]
  categories: Category[]
}

export interface CategoriesPageProps {
  repository?: CategoryRepository
  categoryGroupRepository?: CategoryGroupRepository
  /** Injected for tests; production uses the shared singleton. */
  partCategoryRepository?: PartCategoryRepository
}

export function CategoriesPage({ repository, categoryGroupRepository, partCategoryRepository }: CategoriesPageProps) {
  const { t } = useTranslation('categories')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()

  const repo         = repository ?? getSharedCategoryRepository()
  const groupRepo    = categoryGroupRepository ?? getSharedCategoryGroupRepository()
  const partCatRepo  = partCategoryRepository ?? getSharedPartCategoryRepository()
  const canMutate    = role === 'super_admin'

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CategoriesTab>('assets')

  // ── Parts tab pagination state (lifted so Zone 3 lives in ListCard) ──────
  const [partPage, setPartPage]         = useState(1)
  const [partTotal, setPartTotal]       = useState(0)
  const [partAddRequested, setPartAddRequested] = useState(false)

  // ── Data ─────────────────────────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // ── SWR cache ─────────────────────────────────────────────────────────────
  const cacheKey = `categories:${cacheIdentity(repo)}:${cacheIdentity(groupRepo)}`
  const { data, loading, error: fetchError, reload } = useCachedResource<CategoriesSnapshot>(
    cacheKey,
    async () => {
      const [groups, categories] = await Promise.all([
        groupRepo.listCategoryGroups(),
        repo.listCategories(),
      ])
      return { groups, categories }
    },
  )
  const groups = data?.groups ?? []
  const rows   = data?.categories ?? []

  // Sync selectedGroupId when groups data arrives (first load or after mutation).
  useEffect(() => {
    if (!data?.groups) return
    setSelectedGroupId(prev =>
      prev !== null && data.groups.some(g => g.id === prev) ? prev : (data.groups[0]?.id ?? null),
    )
  }, [data])

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

  // ── Group CRUD (hook) ─────────────────────────────────────────────────────
  // useCategoryGroupCrud expects `load: () => Promise<void>`.
  // useCachedResource's `reload` returns void — wrap to satisfy the type.
  const reloadAsync = useCallback(async () => { reload() }, [reload])
  const [pageError, setPageError] = useState<string | null>(null)

  const {
    groupEditing, setGroupEditing,
    groupSubmitting,
    groupSaveError, setGroupSaveError,
    groupDeleting, setGroupDeleting,
    groupBlockedMsg, setGroupBlockedMsg,
    groupDelBusy,
    handleGroupSubmit, askDeleteGroup, confirmDeleteGroup,
  } = useCategoryGroupCrud(groupRepo, reloadAsync, setPageError)

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: CatalogColumn<Category>[] = [
    {
      key: 'name',
      header: t('col.name'),
      width: '2fr',
      render: c => (
        <span className="flex items-center gap-2 min-w-0">
          {/* Desktop-only inline icon — on mobile the category icon lives in the
              row's icon TILE (mobileIcon), so this duplicate is hidden there. */}
          <Icon name={c.lucideIcon} size={15} className="text-text-tertiary flex-shrink-0 max-md:hidden" />
          <span className="text-text-primary truncate">{c.name}</span>
          {/* Mobile-only inline specs chip — keeps row to a single line so the
              list fits without page scroll. Hidden on desktop where the specs
              column already shows it. */}
          <span className="flex-shrink-0 md:hidden">
            <Chip color={c.hasSpecs ? 'green' : 'gray'} size="sm">
              {t(c.hasSpecs ? 'specs.yes' : 'specs.no')}
            </Chip>
          </span>
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
    const actor = { uid: user.id, role, displayName: user.name }
    try {
      if (editing && editing !== 'new') {
        await repo.updateCategory(editing.id, { ...v, categoryGroupId: selectedGroupId, group: selectedGroup.behavior }, actor)
      } else {
        await repo.createCategory({ ...v, group: selectedGroup.behavior, categoryGroupId: selectedGroupId }, actor)
      }
      invalidateReferenceCaches()  // asset rows resolve category names/icons by id
      setEditing(null); setPage(1); reload()
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
      await repo.deleteCategory(deleting.id, { uid: user.id, role, displayName: user.name })
      invalidateReferenceCaches()
      setDeleting(null); setBlockedMsg(null); setPage(1); reload()
    } catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null) }
    } finally { setDelBusy(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={10} variant="catalog" />
      // Name track is '2fr' (not minmax) — the real column defines width: '2fr',
      // which DataTable joins verbatim into gridTemplateColumns.
      : <TableSkeleton rows={PAGE_SIZE} columns={3} gridTemplate="2fr 1fr 5rem" lastColAction headers={[t('col.name'), t('col.specs'), '']} />
    if ((fetchError || pageError) && !data) return <ErrorState onRetry={reload} />
    if (!selectedGroupId || filtered.length === 0) return (
      <EmptyState icon="tags" title={t('empty.title')} description={t('empty.desc')} />
    )
    return (
      <CatalogTable
        rows={pageRows} columns={columns} canMutate={canMutate} onEdit={openEdit} onDelete={askDelete}
        minRows={PAGE_SIZE}
        mobileIcon={(c) => (
          /* The category's OWN icon in the tile (meaningful), replacing the
             generic "tags" icon; the inline name-column icon is hidden on mobile. */
          <span className="w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-secondary" aria-hidden="true">
            <Icon name={c.lucideIcon} size={14} />
          </span>
        )}
        mobileSubline={() => null}
      />
    )
  }

  return (
    <>
      <ListPageShell flushMobile>
        <ListCard
          className="max-md:mx-2.5"
          toolbar={
            <>
              {/* Tab strip — add button sits in the SAME row, right-aligned
                  (licenses-page pattern: tabs left, primary action right) */}
              {canMutate && (
                <div className="flex items-center justify-between gap-3 px-5 max-md:px-3.5 max-md:items-end max-md:bg-surface-2 border-b border-border">
                  <TabStrip<CategoriesTab>
                    tabs={[
                      { id: 'assets' as CategoriesTab, label: t('tabs.assets') },
                      { id: 'parts'  as CategoriesTab, label: t('tabs.parts')  },
                    ]}
                    active={activeTab}
                    onChange={setActiveTab}
                    size="md"
                    className="max-md:pt-[5px]"
                  />
                  <div className="shrink-0">
                    {isMobile ? (
                      <MobileAddButton
                        onClick={activeTab === 'assets'
                          ? () => { setSaveError(null); setEditing('new') }
                          : () => setPartAddRequested(true)}
                        ariaLabel={activeTab === 'assets' ? t('createSubcategory') : t('parts.createBtn')}
                        className="max-md:my-[3px] self-center"
                      />
                    ) : (
                      <Btn
                        variant="primary"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={activeTab === 'assets'
                          ? () => { setSaveError(null); setEditing('new') }
                          : () => setPartAddRequested(true)}
                      >
                        <Icon name="plus" size={13} />
                        {activeTab === 'assets' ? t('createSubcategory') : t('parts.createBtn')}
                      </Btn>
                    )}
                  </div>
                </div>
              )}

              {/* Asset categories sub-toolbar (chips + add subcategory) */}
              {activeTab === 'assets' && (
                <div className="flex items-center gap-3 px-5 py-3 max-md:px-3">
                  {/* Left: chips — overflow-hidden so they don't push the button off-screen */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {loading ? (
                      // The group count is async, so 3 chips is a fixed approximation of
                      // the loaded count. Acceptable per owner rules: the h-8 chip row
                      // height is fixed and the real add-group chip renders below, so the
                      // row's footprint is stable regardless of the eventual chip count.
                      <div className="flex flex-wrap gap-2 max-md:flex-nowrap max-md:overflow-x-auto no-scrollbar">
                        {[80, 100, 72].map(w => (
                          <div key={w} style={{ width: w }} className="h-8 rounded-lg bg-surface-2 animate-pulse flex-shrink-0" />
                        ))}
                        {/* "+ add group" dashed chip: always visible so footprint matches loaded state */}
                        {canMutate && (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-border text-text-tertiary text-13 font-semibold tracking-tight whitespace-nowrap flex-shrink-0 opacity-50 cursor-not-allowed"
                          >
                            <Icon name="plus" size={13} />
                            {t('create')}
                          </button>
                        )}
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'assets' && <div className="border-t border-border" />}

            </>
          }
          pagination={
            /* Desktop-only pinned pagination; mobile copy lives inside the scroller */
            <div className="max-md:hidden">
              {activeTab === 'assets'
                ? <CatalogPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
                : <CatalogPagination page={partPage} pageSize={PAGE_SIZE} total={partTotal} onPage={setPartPage} />
              }
            </div>
          }
        >
          {/* Mobile: outer scroll container bounded to Zone-2 height so the list
              scrolls INSIDE the card — not the whole page. Identical pattern to
              EmployeesPage / AssetsPage. Desktop: h-full pass-through. */}
          <div className="flex-1 min-h-0 max-md:overflow-y-auto max-md:flex max-md:flex-col">
            {/* Mobile: inner flex-fill wrapper — grows to push pagination to the
                bottom; shrink-0 lets content exceed the container (outer scrolls).
                Desktop: h-full block pass-through. */}
            <div className="h-full max-md:h-auto max-md:grow max-md:shrink-0 max-md:flex max-md:flex-col">
              {activeTab === 'assets'
                ? renderTableRegion()
                : (
                  <PartCategoriesSection
                    repository={partCatRepo}
                    canMutate={canMutate}
                    page={partPage}
                    onPage={setPartPage}
                    onTotalChange={setPartTotal}
                    openCreate={partAddRequested}
                    onCreateHandled={() => setPartAddRequested(false)}
                  />
                )
              }
            </div>
            {/* Mobile-only pagination copy inside the scroller */}
            {isMobile && !loading && activeTab === 'assets' && filtered.length > 0 && (
              <CatalogPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
            )}
            {isMobile && !loading && activeTab === 'parts' && partTotal > 0 && (
              <CatalogPagination page={partPage} pageSize={PAGE_SIZE} total={partTotal} onPage={setPartPage} />
            )}
          </div>
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
