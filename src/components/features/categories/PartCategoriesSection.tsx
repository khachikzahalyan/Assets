/**
 * PartCategoriesSection — management UI for part_categories collection.
 *
 * Responsibilities:
 *   - List ALL part categories (incl. inactive), sorted by order ascending.
 *   - Create: opens PartCategoryFormDialog in create mode.
 *   - Edit: rename (3 langs), icon, tintToken, order, slotKind. Behavior read-only.
 *   - Deactivate / Activate toggle via update({ active: false|true }).
 *   - NO delete affordance (domain forbids deletion; Firestore rules deny it).
 *
 * Visible to super_admin only. canMutate prop controls all write affordances.
 *
 * All mutations go through the injected PartCategoryRepository — withAudit is
 * already run inside the repository adapter; this component is audit-free.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  Chip, Icon,
  EmptyState, ErrorState, TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { PartCategoryFormDialog, type PartCategoryFormValues } from './PartCategoryFormDialog'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import type { PartCategoryRepository, CreatePartCategoryInput, UpdatePartCategoryInput } from '@/domain/part/PartCategoryRepository'
import { TINT_BY_TOKEN, TINT_FALLBACK } from '@/components/features/parts/partsTokens'
import { useCachedResource, cacheIdentity } from '@/hooks/useCachedResource'
import { useIsMobile } from '@/hooks/useIsMobile'

const PAGE_SIZE = 10

export interface PartCategoriesSectionProps {
  repository: PartCategoryRepository
  canMutate: boolean
  /**
   * Controlled page index (1-based). Provided by the parent so CategoriesPage
   * can own pagination and render it in ListCard Zone 3.
   */
  page: number
  onPage: (p: number) => void
  /** Called whenever the total row count changes so the parent can size the paginator. */
  onTotalChange: (total: number) => void
  /**
   * When flipped to true by the parent (e.g. toolbar "Add" button click),
   * the section opens its create dialog and then calls onCreateHandled()
   * so the parent can reset the flag.
   */
  openCreate: boolean
  onCreateHandled: () => void
}

export function PartCategoriesSection({
  repository, canMutate, page, onPage, onTotalChange, openCreate, onCreateHandled,
}: PartCategoriesSectionProps) {
  const { t } = useTranslation('categories')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()

  // ── SWR cache ────────────────────────────────────────────────────────────
  const cacheKey = `partCategories:${cacheIdentity(repository)}`
  const { data, loading, error: fetchError, reload } = useCachedResource<PartCategoryDef[]>(
    cacheKey,
    () => repository.listAll(),
  )
  const rows = data ?? []

  // ── CRUD state ───────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<PartCategoryDef | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Deactivate / Activate confirmation
  const [toggling, setToggling] = useState<PartCategoryDef | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)

  const reloadAsync = useCallback(async () => { reload() }, [reload])

  // ── Pagination ───────────────────────────────────────────────────────────
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = rows.length

  // Notify parent of total count whenever it changes so CatalogPagination
  // in Zone 3 of ListCard is sized correctly.
  useEffect(() => { onTotalChange(total) }, [total, onTotalChange])

  // When the parent toolbar "Add" button fires, open the create dialog.
  useEffect(() => {
    if (!openCreate) return
    setSaveError(null)
    setEditing('new')
    onCreateHandled()
  }, [openCreate, onCreateHandled])

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleSubmit(v: PartCategoryFormValues) {
    setSubmitting(true); setSaveError(null)
    const actor = { uid: user.id, role, displayName: user.name }
    try {
      if (editing && editing !== 'new') {
        // Edit — behavior, slotKind, storageType are immutable after creation;
        // UpdatePartCategoryInput only accepts: name, icon, tintToken, order, active, variants, generations
        const patch: UpdatePartCategoryInput = {
          name: v.name,
          icon: v.icon,
          tintToken: v.tintToken,
          order: v.order,
        }
        await repository.update(editing.id, patch, actor)
      } else {
        // Create — behavior MUST be present
        const input: CreatePartCategoryInput = {
          name: v.name,
          icon: v.icon,
          tintToken: v.tintToken,
          order: v.order,
          behavior: v.behavior!,
          slotKind: v.slotKind,
          ...(v.storageType ? { storageType: v.storageType } : {}),
        }
        await repository.create(input, actor)
      }
      setEditing(null); onPage(1); await reloadAsync()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/already exists/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function confirmToggle() {
    if (!toggling) return
    setToggleBusy(true)
    const actor = { uid: user.id, role, displayName: user.name }
    try {
      await repository.update(toggling.id, { active: !toggling.active }, actor)
      setToggling(null); await reloadAsync()
    } catch {
      setToggling(null)
    } finally { setToggleBusy(false) }
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const columns = useMemo<CatalogColumn<PartCategoryDef>[]>(() => [
    {
      key: 'name',
      header: t('parts.col.name'),
      width: 'minmax(10rem,2fr)',
      render: (def) => {
        const tint = TINT_BY_TOKEN[def.tintToken] ?? TINT_FALLBACK
        return (
          <span className={`flex items-center gap-2 min-w-0 ${!def.active ? 'opacity-40' : ''}`}>
            {/* Desktop-only inline icon — on mobile the icon lives in the row's
                icon tile (mobileIcon), so this duplicate is hidden there. */}
            <span
              className={`w-[1.375rem] h-[1.375rem] rounded-md flex-shrink-0 inline-flex items-center justify-center ${tint.iconBg} ${tint.iconText} max-md:hidden`}
              aria-hidden="true"
            >
              <Icon name={def.icon} size={12} />
            </span>
            <span className="truncate text-13 text-text-primary">{def.name.ru}</span>
            {!def.active && (
              <Chip color="gray" size="sm">{t('parts.status.inactive')}</Chip>
            )}
          </span>
        )
      },
    },
    {
      key: 'behavior',
      header: t('parts.col.behavior'),
      render: (def) => (
        <span className={!def.active ? 'opacity-40' : ''}>
          <Chip
            color={def.behavior === 'single' ? 'blue' : def.behavior === 'sized' ? 'amber' : 'violet'}
          >
            {t(`parts.behavior.${def.behavior}`)}
          </Chip>
        </span>
      ),
    },
    {
      key: 'order',
      header: t('parts.col.order'),
      width: 'minmax(4.5rem,4.5rem)',
      render: (def) => (
        <span className={`text-13 text-text-tertiary tabular-nums ${!def.active ? 'opacity-40' : ''}`}>
          {def.order}
        </span>
      ),
    },
  ], [t])

  // ── Mobile icon tile ──────────────────────────────────────────────────────
  const mobileIcon = useCallback((def: PartCategoryDef) => {
    const tint = TINT_BY_TOKEN[def.tintToken] ?? TINT_FALLBACK
    return (
      <span
        className={`w-[1.75rem] h-[1.75rem] rounded-[8px] flex-shrink-0 inline-flex items-center justify-center ${tint.iconBg} ${tint.iconText}`}
        aria-hidden="true"
      >
        <Icon name={def.icon} size={14} />
      </span>
    )
  }, [])

  // ── Mobile subline: behavior chip only (sort order is admin-internal clutter) ──
  const mobileSubline = useCallback((def: PartCategoryDef) => (
    <div className="flex items-center gap-1.5 text-11 text-text-tertiary truncate leading-snug">
      <Chip
        color={def.behavior === 'single' ? 'blue' : def.behavior === 'sized' ? 'amber' : 'violet'}
        size="sm"
      >
        {t(`parts.behavior.${def.behavior}`)}
      </Chip>
    </div>
  ), [t])

  // ── Render ────────────────────────────────────────────────────────────────
  function renderTable() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="catalog" />
      : (
        <TableSkeleton
          rows={PAGE_SIZE}
          columns={4}
          gridTemplate="minmax(10rem,2fr) 1fr 4.5rem 5rem"
          lastColAction
          headers={[t('parts.col.name'), t('parts.col.behavior'), t('parts.col.order'), '']}
        />
      )
    if (fetchError && !data) return <ErrorState onRetry={reload} />
    if (rows.length === 0) return (
      <EmptyState icon="cpu" title={t('parts.empty.title')} description={t('parts.empty.desc')} />
    )

    return (
      <CatalogTable<PartCategoryDef>
        rows={pageRows}
        columns={columns}
        canMutate={canMutate}
        onEdit={(def) => { setSaveError(null); setEditing(def) }}
        onDelete={(def) => setToggling(def)}
        // Trash icon label becomes the toggle action; no row is ever truly blocked
        canDeleteRow={() => true}
        minRows={PAGE_SIZE}
        mobileIcon={mobileIcon}
        mobileSubline={mobileSubline}
      />
    )
  }

  const toggleIsDeactivate = toggling ? toggling.active : true

  return (
    <>
      {renderTable()}

      {/* Deactivate / Activate confirmation — wired to the onDelete slot of CatalogTable */}
      <ConfirmDeleteDialog
        open={toggling !== null}
        title={toggleIsDeactivate ? t('parts.deactivateConfirm.title') : t('parts.activateConfirm.title')}
        body={toggleIsDeactivate ? t('parts.deactivateConfirm.body') : t('parts.activateConfirm.body')}
        confirmLabel={toggleIsDeactivate ? t('parts.deactivateConfirm.confirm') : t('parts.activateConfirm.confirm')}
        cancelLabel={toggleIsDeactivate ? t('parts.deactivateConfirm.cancel') : t('parts.activateConfirm.cancel')}
        busy={toggleBusy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />

      {editing !== null && (
        <PartCategoryFormDialog
          open
          initial={editing !== 'new' ? editing : null}
          submitting={submitting}
          submitError={saveError}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  )
}
