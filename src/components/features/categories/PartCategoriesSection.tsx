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

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  Btn, Chip, Icon, IconBtn, MobileAddButton,
  EmptyState, ErrorState, TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import { CatalogPagination, ConfirmDeleteDialog } from '@/components/features/catalogs'
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
}

export function PartCategoriesSection({ repository, canMutate }: PartCategoriesSectionProps) {
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
  const [page, setPage] = useState(1)

  // Deactivate / Activate confirmation
  const [toggling, setToggling] = useState<PartCategoryDef | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)

  const reloadAsync = useCallback(async () => { reload() }, [reload])

  // ── Pagination ───────────────────────────────────────────────────────────
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const total = rows.length

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
      setEditing(null); setPage(1); await reloadAsync()
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

  // ── Tint swatch helper ────────────────────────────────────────────────────
  function IconTile({ def }: { def: PartCategoryDef }) {
    const tint = TINT_BY_TOKEN[def.tintToken] ?? TINT_FALLBACK
    return (
      <span
        className={`w-[22px] h-[22px] rounded-md flex-shrink-0 inline-flex items-center justify-center ${tint.iconBg} ${tint.iconText}`}
        aria-hidden="true"
      >
        <Icon name={def.icon} size={12} />
      </span>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function renderTable() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="catalog" />
      : (
        <TableSkeleton
          rows={PAGE_SIZE}
          columns={4}
          gridTemplate="minmax(160px,2fr) 1fr 60px 80px"
          lastColAction
          headers={[t('parts.col.name'), t('parts.col.behavior'), t('parts.col.order'), '']}
        />
      )
    if (fetchError && !data) return <ErrorState onRetry={reload} />
    if (rows.length === 0) return (
      <EmptyState icon="cpu" title={t('parts.empty.title')} description={t('parts.empty.desc')} />
    )

    if (isMobile) {
      return (
        <div className="flex flex-col">
          {pageRows.map(def => {
            const tint = TINT_BY_TOKEN[def.tintToken] ?? TINT_FALLBACK
            return (
              <div
                key={def.id}
                className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0"
              >
                {/* Icon tile */}
                <span
                  className={`w-[36px] h-[36px] rounded-[10px] flex-shrink-0 inline-flex items-center justify-center ${tint.iconBg} ${tint.iconText}`}
                  aria-hidden="true"
                >
                  <Icon name={def.icon} size={16} />
                </span>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[13px] font-bold truncate ${def.active ? 'text-text-primary' : 'text-text-tertiary line-through'}`}>
                      {def.name.ru}
                    </span>
                    {!def.active && (
                      <Chip color="gray" size="sm">{t('parts.status.inactive')}</Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Chip
                      color={def.behavior === 'single' ? 'blue' : def.behavior === 'sized' ? 'amber' : 'violet'}
                      size="sm"
                    >
                      {t(`parts.behavior.${def.behavior}`)}
                    </Chip>
                  </div>
                </div>
                {/* Actions */}
                {canMutate && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IconBtn
                      icon="pencil"
                      title={t('form.save')}
                      tone="slate"
                      onClick={() => { setSaveError(null); setEditing(def) }}
                      className="!w-11 !h-11"
                    />
                    <IconBtn
                      icon={def.active ? 'archive-x' : 'circle-check'}
                      title={def.active ? t('parts.deactivate') : t('parts.activate')}
                      tone={def.active ? 'rose' : 'slate'}
                      onClick={() => setToggling(def)}
                      className="!w-11 !h-11"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }

    // Desktop table
    const gridTemplate = canMutate
      ? 'minmax(160px,2fr) 1fr 60px 120px'
      : 'minmax(160px,2fr) 1fr 60px'

    return (
      <div className="w-full">
        {/* Header row */}
        <div
          className="grid text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle border-b border-border"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-4 py-2.5">{t('parts.col.name')}</div>
          <div className="px-4 py-2.5">{t('parts.col.behavior')}</div>
          <div className="px-4 py-2.5">{t('parts.col.order')}</div>
          {canMutate && <div className="px-4 py-2.5" />}
        </div>
        {/* Data rows */}
        {pageRows.map(def => (
          <div
            key={def.id}
            className="grid items-center border-b border-border last:border-b-0 hover:bg-surface-2/40 transition-colors"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="px-4 py-3 flex items-center gap-2 min-w-0">
              <IconTile def={def} />
              <span className={`truncate text-[13px] ${def.active ? 'text-text-primary' : 'text-text-tertiary line-through'}`}>
                {def.name.ru}
              </span>
              {!def.active && (
                <Chip color="gray" size="sm">{t('parts.status.inactive')}</Chip>
              )}
            </div>
            <div className="px-4 py-3">
              <Chip
                color={def.behavior === 'single' ? 'blue' : def.behavior === 'sized' ? 'amber' : 'violet'}
              >
                {t(`parts.behavior.${def.behavior}`)}
              </Chip>
            </div>
            <div className="px-4 py-3 text-[13px] text-text-tertiary tabular-nums">{def.order}</div>
            {canMutate && (
              <div className="px-4 py-3 flex items-center gap-1 justify-end">
                <IconBtn
                  icon="pencil"
                  title={t('form.editTitle')}
                  tone="slate"
                  onClick={() => { setSaveError(null); setEditing(def) }}
                />
                <IconBtn
                  icon={def.active ? 'archive-x' : 'circle-check'}
                  title={def.active ? t('parts.deactivate') : t('parts.activate')}
                  tone={def.active ? 'rose' : 'slate'}
                  onClick={() => setToggling(def)}
                />
              </div>
            )}
          </div>
        ))}
        {/* Filler rows to maintain height */}
        {Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, i) => (
          <div
            key={`filler-${i}`}
            className="border-b border-border last:border-b-0"
            style={{ height: 49 }}
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  const toggleIsDeactivate = toggling ? toggling.active : true

  return (
    <>
      {/* Section toolbar */}
      <div className="flex items-center justify-end px-5 py-3 max-md:px-3 border-b border-border">
        {canMutate && (
          isMobile ? (
            <MobileAddButton
              onClick={() => { setSaveError(null); setEditing('new') }}
              ariaLabel={t('parts.createBtn')}
            />
          ) : (
            <Btn
              variant="primary"
              size="sm"
              onClick={() => { setSaveError(null); setEditing('new') }}
            >
              <Icon name="plus" size={13} />
              {t('parts.createBtn')}
            </Btn>
          )
        )}
      </div>

      {renderTable()}

      <CatalogPagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {/* Deactivate / Activate confirmation */}
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
