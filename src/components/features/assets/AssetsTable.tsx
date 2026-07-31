import { useMemo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import { HEAD_OFFICE_BRANCH_ID } from '@/domain/asset/transferRules'
import type { ChipColor } from '@/components/ui/chip'
import {
  deriveDisplayStatus,
  statusLabel,
  STATUS_CHIP_COLOR,
  assetTitle,
  isTemporaryAssignment,
  assigneeKind,
} from './assetFormat'
import { resolveCategoryColor } from '@/components/common/categoryColors'
import { AssigneeCell } from './AssigneeCell'
import { MobileCard } from './AssetRowMobile'
import { Chip, DataTable, Icon, MobileListPlaceholders } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'

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
  // Kept in the public API for callers/tests; the desktop edit affordance was
  // never wired (no onEditClick), so the prop is currently unused.
  canMutate: _canMutate,
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

  const desktopColumns = buildDesktopColumns()

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
        const catColor = resolveCategoryColor(a.categoryId, cat?.lucideIcon)

        return (
          <MobileCard
            key={a.id}
            a={a}
            title={title}
            displayStatus={{ ...displayStatus, name: statusLabel(displayStatus, t) }}
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

    {/* ── Desktop grid table (≥ 768px) — shared DataTable (this table is the
        style etalon the component was extracted from; one table everywhere). ── */}
    {!isMobile && (
      <DataTable<Asset>
        aria-label={t('title')}
        columns={desktopColumns}
        rows={rows}
        getRowKey={a => a.id}
        {...(onRowClick !== undefined ? { onRowClick } : {})}
        {...(focusId !== undefined ? { focusRowKey: focusId } : {})}
        minRows={minRows}
        fillHeight
        placeholderTestId="asset-table-placeholder"
      />
    )}
    </>
  )

  // ── Desktop column definitions — cells moved verbatim from the old AssetRow ──
  function buildDesktopColumns(): DataTableColumn<Asset>[] {
    return [
      {
        key: 'asset',
        header: t('cols.asset'),
        width: 'minmax(15rem,2.4fr)',
        cellClassName: 'flex items-center gap-2.5 min-w-0',
        cell: (a) => {
          const cat          = categoryMap.get(a.categoryId)
          const categoryName = cat?.name ?? ''
          const title        = assetTitle(a, categoryName, cat?.group)
          const catColor     = resolveCategoryColor(a.categoryId, cat?.lucideIcon)
          const isRemote     = a.assignment?.workMode === 'remote'
          const subBase      = categoryName || a.brand || '—'
          const sub          = a.serial ? `${subBase} · ${a.serial}` : subBase
          return (
            <>
              {/* Category icon box */}
              <span
                className="w-9 h-9 rounded-lg bg-surface-2 border border-border text-text-tertiary inline-flex items-center justify-center flex-shrink-0 transition-colors duration-[180ms]"
                style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon, borderColor: catColor.icon } : undefined}
              >
                <Icon name={cat?.lucideIcon ?? 'box'} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-15.5 font-semibold text-text-primary truncate leading-tight">
                    {title}
                  </span>
                  {isRemote && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-11 font-semibold uppercase tracking-wide bg-cyan-500/15 text-cyan-300 light:text-cyan-700 border border-cyan-500/30">
                      <Icon name="house" size={10} />
                      {t('badges.remote')}
                    </span>
                  )}
                </div>
                <div className="text-13.5 text-text-tertiary truncate leading-tight mt-0.5">
                  {sub}
                </div>
              </div>
            </>
          )
        },
      },
      {
        key: 'branch',
        header: t('cols.branch'),
        width: 'minmax(8.125rem,1fr)',
        cellClassName: 'flex items-center gap-1.5 min-w-0',
        cell: (a) => {
          const isMainBranch = a.branchId === HEAD_OFFICE_BRANCH_ID
          return (
            <>
              <span className="shrink-0 inline-flex" style={{ color: isMainBranch ? '#10B981' : '#38BDF8' }}>
                <Icon name={isMainBranch ? 'landmark' : 'building'} size={12} />
              </span>
              <span className="text-14.5 text-text-secondary truncate">
                {branchMap.get(a.branchId) ?? '—'}
              </span>
            </>
          )
        },
      },
      {
        key: 'code',
        header: t('cols.code'),
        width: 'minmax(6.25rem,0.85fr)',
        cell: (a) => (
          <span className="inline-block max-w-full truncate font-mono text-14 font-semibold text-text-secondary bg-bg border border-border rounded-md px-1.5 py-0.5">
            {a.invCode}
          </span>
        ),
      },
      {
        key: 'assignee',
        header: t('cols.assignee'),
        width: 'minmax(9.375rem,1.2fr)',
        cellClassName: 'min-w-0',
        cell: (a) => (
          <AssigneeCell
            asset={a}
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
          />
        ),
      },
      {
        key: 'status',
        header: t('cols.status'),
        width: 'minmax(6.875rem,1fr)',
        cell: (a) => {
          const displayStatus = deriveDisplayStatus(a, refData.statuses)
          const statusColor: ChipColor =
            STATUS_CHIP_COLOR[displayStatus.id] ??
            (displayStatus.color as ChipColor) ??
            'gray'
          return <Chip color={statusColor} dot>{statusLabel(displayStatus, t)}</Chip>
        },
      },
      {
        key: 'actions',
        header: '',
        width: '56px',
        cellClassName: 'flex items-center justify-end',
        cell: () => (
          <Icon
            name="chevron-right"
            size={14}
            className="text-text-subtle group-hover:text-accent-light transition-colors ml-0.5"
          />
        ),
      },
    ]
  }
}
