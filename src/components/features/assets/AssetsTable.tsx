import { useMemo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { ChipColor } from '@/components/ui/chip'
import { Chip, Icon } from '@/components/ui'
import {
  deriveDisplayStatus,
  STATUS_CHIP_COLOR,
  assetTitle,
  fmtDate,
  isTemporaryAssignment,
  assigneeKind,
} from './assetFormat'
import { CATEGORY_COLOR } from './categoryColors'
import { AssetRow, GRID_COLS } from './AssetRow'

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
}

export function AssetsTable({
  rows,
  ref: refData,
  canMutate,
  onRowClick,
  minRows = 10,
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
  // Fills the gap between real rows and minRows so the card footprint stays constant.
  const placeholderCount = Math.max(0, minRows - rows.length)

  // ── Responsive: show mobile cards only when viewport is < 768px ─────────────
  // Using state + matchMedia so the layout is correct on first paint and updates
  // on resize. jsdom does not implement matchMedia — guard with typeof check so
  // isMobile stays false in tests, preventing duplicate text nodes.
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

  // AssigneeCell translated labels
  const onShelf    = t('assignee.warehouse')
  const onShelfSub = t('assignee.waiting')
  const deptLabel  = t('qa.department')
  const branchLabel = t('qa.branch')
  const tempLabel  = t('assignee.temp')
  const kindAuditLabel = t('assignee.kindAudit')
  const kindInternLabel = t('assignee.kindIntern')

  // ── Mobile card list helpers ────────────────────────────────────────────────
  /**
   * Derives a one-line assignee display name for the mobile card row.
   * Mirrors the prototype §5 assignee logic: audit/intern kinds show the role
   * label (amber); regular employees show lastName firstName; departments,
   * branches, and warehouse show their respective names.
   */
  function mobileAssigneeName(a: Asset): { name: string; isAuditOrIntern: boolean } {
    const kind = assigneeKind(a)

    if (kind === 'employee') {
      const emp = a.assignment?.employeeId ? employeeMap.get(a.assignment.employeeId) : undefined
      const tempKind = a.assignment?.tempKind
      if (tempKind === 'audit' || tempKind === 'intern') {
        const label = tempKind === 'audit' ? kindAuditLabel : kindInternLabel
        return { name: label, isAuditOrIntern: true }
      }
      const name = emp
        ? [emp.lastName, emp.firstName].filter(Boolean).join(' ') || '—'
        : '—'
      const isTemp = isTemporaryAssignment(a)
      return { name: isTemp ? (name === '—' ? tempLabel : name) : name, isAuditOrIntern: false }
    }

    if (kind === 'temporary') {
      const tempKind = a.assignment?.tempKind
      const label = tempKind === 'audit' ? kindAuditLabel
        : tempKind === 'intern' ? kindInternLabel : tempLabel
      return { name: label, isAuditOrIntern: true }
    }

    if (kind === 'department') {
      const name = a.assignment?.departmentId ? deptMap.get(a.assignment.departmentId) ?? '—' : '—'
      return { name, isAuditOrIntern: false }
    }

    if (kind === 'branch') {
      const name = a.assignment?.branchId ? branchMap.get(a.assignment.branchId) ?? '—' : '—'
      return { name, isAuditOrIntern: false }
    }

    // warehouse / none
    return { name: onShelf, isAuditOrIntern: false }
  }

  return (
    <>
    {/* ── Mobile card list (< 768px) — conditionally rendered via matchMedia ── */}
    {isMobile && <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      {rows.map(a => {
        const cat = categoryMap.get(a.categoryId)
        const categoryName = cat?.name ?? ''
        const group = cat?.group
        const title = assetTitle(a, categoryName, group)
        const displayStatus = deriveDisplayStatus(a, refData.statuses)
        const statusColor: ChipColor =
          STATUS_CHIP_COLOR[displayStatus.id] ??
          (displayStatus.color as ChipColor) ??
          'gray'
        const { name: assigneeName, isAuditOrIntern } = mobileAssigneeName(a)

        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick?.(a)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick?.(a) } }}
            className="flex flex-row items-center gap-3 bg-surface px-[14px] py-[11px] border-b border-white/[0.06] cursor-pointer transition-colors duration-[140ms] min-h-[64px] box-border last:border-b-0 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(249,115,22,0.40)]"
          >
            {/* Icon tile — always muted on mobile (prototype §5 spec) */}
            <span
              className="w-8 h-8 min-w-[32px] rounded-[8px] bg-white/[0.04] border-[0.5px] border-white/[0.06] inline-flex items-center justify-center flex-shrink-0 text-white/60"
            >
              <Icon name={cat?.lucideIcon ?? 'box'} size={16} />
            </span>

            {/* 2-row content column — flex-1 so it fills space between icon and card edge */}
            <div className="flex-1 min-w-0 flex flex-col gap-[6px]">
              {/* Row 1: name (flex-1 truncate) + status pill (shrink-0, flush right) */}
              <div className="flex items-center justify-between gap-2 min-w-0 min-h-[20px]">
                <span className="text-[14px] font-semibold text-white/95 leading-[18px] whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0">
                  {title}
                </span>
                <span className="shrink-0 inline-flex items-center">
                  <Chip color={statusColor} dot size="sm">{displayStatus.name}</Chip>
                </span>
              </div>

              {/* Row 2: assignee (flex-1 truncate) + inv-code badge (shrink-0, flush right — same edge as pill above) */}
              <div className="flex items-center justify-between gap-2 min-h-[18px] min-w-0">
                <span
                  className={[
                    'text-[12px] leading-[18px] whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0',
                    isAuditOrIntern ? 'text-[#FCD34D]' : 'text-white/55',
                  ].join(' ')}
                >
                  {assigneeName}
                </span>
                <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-[10px] text-accent-light bg-transparent border border-[rgba(249,115,22,0.3)] rounded-[4px] px-[6px] h-[18px] leading-[16px] tracking-[0.02em] shrink-0 whitespace-nowrap inline-flex items-center">
                  {a.invCode}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>}

    {/* ── Desktop grid table (≥ 768px) — always rendered; hidden via CSS on mobile ── */}
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
          {/* Asset col header */}
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
          <div role="columnheader" className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
            {t('cols.updated')}
          </div>
          <div role="columnheader" className="px-3" aria-label="" />
        </div>
      </div>

      {/* Body */}
      <div role="rowgroup" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
        {rows.map(a => {
          const cat = categoryMap.get(a.categoryId)
          const categoryName = cat?.name ?? ''
          const group = cat?.group
          const title = assetTitle(a, categoryName, group)

          const displayStatus = deriveDisplayStatus(a, refData.statuses)
          const statusName = displayStatus.name
          const statusColor: ChipColor =
            STATUS_CHIP_COLOR[displayStatus.id] ??
            (displayStatus.color as ChipColor) ??
            'gray'

          const branchName = branchMap.get(a.branchId) ?? '—'
          const isMainBranch = a.branchId === 'br_main'
          const catColor = CATEGORY_COLOR[a.categoryId] ?? null
          const formattedTime = fmtDate(a.updatedAt)

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
              formattedTime={formattedTime}
              canMutate={canMutate}
              onRowClick={onRowClick ?? (() => {})}
            />
          )
        })}

        {/* Placeholder rows — desktop only (max-md:hidden) — maintain fixed table height.
            MUST NOT have role="row" so getAllByRole('row') counts stay correct.
            aria-hidden, pointer-events:none, no hover, no focus. */}
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
            {/* Faint dashed center line — signals intentional empty slot */}
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
