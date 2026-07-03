import { useMemo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { ChipColor } from '@/components/ui/chip'
import {
  deriveDisplayStatus,
  STATUS_CHIP_COLOR,
  assetTitle,
  isTemporaryAssignment,
  assigneeKind,
} from './assetFormat'
import { CATEGORY_COLOR } from './categoryColors'
import { AssetRow, GRID_COLS } from './AssetRow'
import { MobileCard } from './AssetRowMobile'
import { MobileListPlaceholders } from '@/components/ui'

// ── AssetsTable ──────────────────────────────────────────────────────────────

export interface AssetsTableProps {
  rows: Asset[]
  ref: AssetReferenceData
  canMutate: boolean
  onRowClick?: (a: Asset) => void
  /**
   * Target minimum row count for the desktop table. Placeholder rows are
   * rendered to fill the gap so the table footprint stays constant.
   * Default: 10 (matches PAGE_SIZE in AssetsPage).
   */
  minRows?: number
  /** Asset id that should be scrolled into view and briefly highlighted. */
  focusId?: string
}

export function AssetsTable({
  rows,
  ref: refData,
  canMutate,
  onRowClick,
  minRows = 10,
  focusId,
}: AssetsTableProps) {
  const { t } = useTranslation('assets')

  const { branchMap, deptMap, categoryMap, employeeMap } = useMemo(
    () => ({
      branchMap:   new Map(refData.branches.map(b => [b.id, b.name])),
      deptMap:     new Map(refData.departments.map(d => [d.id, d.name])),
      categoryMap: new Map(refData.categories.map(c => [c.id, c])),
      employeeMap: new Map(refData.employees.map(e => [e.id, e])),
    }),
    [refData],
  )

  // ── Placeholder rows for fixed table height (desktop only) ──────────────────
  const placeholderCount = Math.max(0, minRows - rows.length)

  // ── Responsive: show mobile cards only when viewport is < 768px ─────────────
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // AssigneeCell / subline translated labels
  const onShelf        = t('assignee.warehouse')
  const onShelfSub     = t('assignee.waiting')
  const deptLabel      = t('qa.department')
  const branchLabel    = t('qa.branch')
  const tempLabel      = t('assignee.temp')
  const kindAuditLabel = t('assignee.kindAudit')
  const kindInternLabel = t('assignee.kindIntern')

  // ── Mobile subline builder ──────────────────────────────────────────────────
  /**
   * Returns a one-line subline string and an amber-color flag for the mobile row.
   *
   * Format:
   *   employee     → "{empName} · {deptName}" (or just "{empName}" if no dept)
   *   audit/intern → "{roleLabel} · {deptName}" in amber (if emp + dept found)
   *   department   → "{deptName}"
   *   branch       → "{branchName}"
   *   temporary    → role label (amber)
   *   warehouse    → onShelf label
   */
  function mobileSublineData(a: Asset): { subline: string; isAuditOrIntern: boolean } {
    const kind = assigneeKind(a)

    if (kind === 'employee') {
      const emp     = a.assignment?.employeeId ? employeeMap.get(a.assignment.employeeId) : undefined
      const tempKind = a.assignment?.tempKind

      let assigneePart: string
      let isAuditOrIntern = false

      if (tempKind === 'audit' || tempKind === 'intern') {
        assigneePart   = tempKind === 'audit' ? kindAuditLabel : kindInternLabel
        isAuditOrIntern = true
      } else {
        const name = emp
          ? [emp.lastName, emp.firstName].filter(Boolean).join(' ') || '—'
          : '—'
        const isTemp = isTemporaryAssignment(a)
        assigneePart = isTemp && name === '—' ? tempLabel : name
      }

      const deptId   = emp?.departmentId
      const deptName = deptId ? deptMap.get(deptId) : undefined
      return { subline: deptName ? `${assigneePart} · ${deptName}` : assigneePart, isAuditOrIntern }
    }

    if (kind === 'temporary') {
      const tempKind = a.assignment?.tempKind
      const label    = tempKind === 'audit' ? kindAuditLabel
        : tempKind === 'intern' ? kindInternLabel : tempLabel
      return { subline: label, isAuditOrIntern: true }
    }

    if (kind === 'department') {
      const name = a.assignment?.departmentId ? deptMap.get(a.assignment.departmentId) ?? '—' : '—'
      return { subline: name, isAuditOrIntern: false }
    }

    if (kind === 'branch') {
      const name = a.assignment?.branchId ? branchMap.get(a.assignment.branchId) ?? '—' : '—'
      return { subline: name, isAuditOrIntern: false }
    }

    // warehouse / none
    return { subline: onShelf, isAuditOrIntern: false }
  }

  return (
    <>
    {/* ── Mobile card list (< 768px) — flex-fill within Zone-2 so the block
        grows on tall phones (no dead space below paginator) and overflows
        naturally on short phones (OUTER scroll container scrolls). All rows
        and placeholder slots use flexGrow:1 + flexShrink:0 with their natural
        height as the minimum — identical to the desktop row fill contract. ── */}
    {isMobile && <div className="flex flex-col grow shrink-0">
      {rows.map(a => {
        const cat          = categoryMap.get(a.categoryId)
        const categoryName = cat?.name ?? ''
        const group        = cat?.group
        const title        = assetTitle(a, categoryName, group)
        const displayStatus = deriveDisplayStatus(a, refData.statuses)
        const statusColor: ChipColor =
          STATUS_CHIP_COLOR[displayStatus.id] ??
          (displayStatus.color as ChipColor) ??
          'gray'
        const { subline, isAuditOrIntern } = mobileSublineData(a)
        const catColor = CATEGORY_COLOR[a.categoryId] ?? null

        return (
          <MobileCard
            key={a.id}
            a={a}
            title={title}
            displayStatus={displayStatus}
            statusColor={statusColor}
            subline={subline}
            isAuditOrIntern={isAuditOrIntern}
            cat={cat}
            catColor={catColor}
            isFocused={focusId === a.id}
            outerStyle={{ flexGrow: 1, flexShrink: 0 }}
            {...(onRowClick !== undefined ? { onRowClick } : {})}
          />
        )
      })}

      {/* Placeholder card slots — pad the list to minRows (10) so the block
          always occupies the same height and the paginator never moves. */}
      <MobileListPlaceholders count={placeholderCount} dataTestId="asset-card-placeholder" />
    </div>}

    {/* ── Desktop grid table (≥ 768px) ── */}
    {!isMobile && <div role="table" aria-label={t('title')} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Header */}
      <div
        role="rowgroup"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: '#111315',
          borderBottom: '1px solid rgba(42,47,54,0.9)',
          flexShrink: 0,
        }}
      >
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLS,
            alignItems: 'center',
            height: 44,
          }}
        >
          <div
            role="columnheader"
            className="flex items-center gap-2 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary"
            style={{ paddingLeft: 20 }}
          >
            {t('cols.asset')}
          </div>
          <div role="columnheader" className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
            {t('cols.branch')}
          </div>
          <div role="columnheader" className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
            {t('cols.code')}
          </div>
          <div role="columnheader" className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
            {t('cols.assignee')}
          </div>
          <div role="columnheader" className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
            {t('cols.status')}
          </div>
          <div role="columnheader" className="px-3" aria-label="" />
        </div>
      </div>

      {/* Body */}
      <div role="rowgroup" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
        {rows.map(a => {
          const cat          = categoryMap.get(a.categoryId)
          const categoryName = cat?.name ?? ''
          const group        = cat?.group
          const title        = assetTitle(a, categoryName, group)

          const displayStatus = deriveDisplayStatus(a, refData.statuses)
          const statusName    = displayStatus.name
          const statusColor: ChipColor =
            STATUS_CHIP_COLOR[displayStatus.id] ??
            (displayStatus.color as ChipColor) ??
            'gray'

          const branchName   = branchMap.get(a.branchId) ?? '—'
          const isMainBranch = a.branchId === 'br_main'
          const catColor     = CATEGORY_COLOR[a.categoryId] ?? null

          return (
            <AssetRow
              key={a.id}
              asset={a}
              title={title}
              categoryName={categoryName}
              categoryIcon={cat?.lucideIcon ?? 'box'}
              catColor={catColor}
              statusName={statusName}
              statusColor={statusColor}
              branchName={branchName}
              isMainBranch={isMainBranch}
              employeeMap={employeeMap}
              deptMap={deptMap}
              branchMap={branchMap}
              onShelf={onShelf}
              onShelfSub={onShelfSub}
              deptLabel={deptLabel}
              branchLabel={branchLabel}
              tempLabel={tempLabel}
              kindAuditLabel={kindAuditLabel}
              kindInternLabel={kindInternLabel}
              canMutate={canMutate}
              onRowClick={onRowClick ?? (() => {})}
              isFocused={focusId === a.id}
            />
          )
        })}

        {/* Placeholder rows — desktop only — maintain fixed table height */}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`__ph_${i}`}
            aria-hidden="true"
            data-testid="asset-table-placeholder"
            className="max-md:hidden"
            style={{
              position: 'relative',
              flex: '1 1 0',
              minHeight: 58,
              borderTop: '1px solid rgba(42,47,54,0.35)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 20,
                right: 20,
                top: '50%',
                height: 1,
                borderTop: '1px dashed rgba(42,47,54,0.5)',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        ))}
      </div>
    </div>}
    </>
  )
}
