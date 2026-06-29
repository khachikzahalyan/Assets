import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { EmployeeAvatar } from './EmployeeAvatar'
import { formatLocalPhone } from './employeeFormat'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

// Grid column widths — must match the original GRID_COLS exactly for visual parity
const COL_WIDTHS = [
  'minmax(180px,1.6fr)', // Employee
  'minmax(120px,0.9fr)', // Branch
  'minmax(140px,1.2fr)', // Position / Dept
  'minmax(110px,0.85fr)', // Phone
  'minmax(160px,1.4fr)', // Gmail
  'minmax(80px,0.6fr)',  // Assets
  'minmax(100px,0.9fr)', // Status
  '56px',                // Chevron / Actions
] as const

export interface EmployeesTableProps {
  rows: Employee[]
  branches: RefRow[]
  departments: RefRow[]
  /** Map of employee id → assigned asset count. */
  assetCounts: Record<string, number>
  /** The branch id that represents the head office (uses landmark icon + green). */
  headOfficeBranchId?: string | null
  onRowClick: (e: Employee) => void
  onRestore?: (id: string) => void
  /** Minimum number of rows to show (fills remainder with placeholder rows). Defaults to 10. */
  minRows?: number
}

export function EmployeesTable({
  rows,
  branches,
  departments,
  assetCounts,
  headOfficeBranchId,
  onRowClick,
  onRestore,
  minRows = 10,
}: EmployeesTableProps) {
  const { t } = useTranslation('employees')

  const { branchMap, deptMap } = useMemo(
    () => ({
      branchMap: new Map(branches.map(b => [b.id, b.name])),
      deptMap:   new Map(departments.map(d => [d.id, d.name])),
    }),
    [branches, departments],
  )

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

  // ── Desktop DataTable columns ────────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<Employee>[]>(() => [
    {
      key: 'employee',
      header: t('table.employee'),
      width: COL_WIDTHS[0],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => (
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0 w-full">
          <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} id={emp.id} size="sm" />
          <span className="text-[15px] font-semibold text-text-primary truncate leading-tight">
            {emp.firstName} {emp.lastName}
          </span>
        </div>
      ),
    },
    {
      key: 'branch',
      header: t('table.branch'),
      width: COL_WIDTHS[1],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => {
        const branchName = emp.branchId ? (branchMap.get(emp.branchId) ?? '') : ''
        const isHeadOffice = !!headOfficeBranchId && emp.branchId === headOfficeBranchId
        return (
          <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
            <span
              className="shrink-0 inline-flex"
              style={{ color: isHeadOffice ? '#10B981' : '#38BDF8' }}
            >
              <Icon name={isHeadOffice ? 'landmark' : 'building'} size={12} />
            </span>
            <span className="text-[14.5px] text-text-secondary truncate">
              {branchName || <span className="text-text-subtle">—</span>}
            </span>
          </div>
        )
      },
    },
    {
      key: 'position',
      header: t('table.position'),
      width: COL_WIDTHS[2],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => {
        const deptName = emp.departmentId ? (deptMap.get(emp.departmentId) ?? '') : ''
        return (
          <div className="min-w-0 w-full">
            <div className="text-[14.5px] font-medium text-text-primary truncate whitespace-nowrap leading-tight">
              {emp.position || <span className="text-text-subtle">—</span>}
            </div>
            <div className="text-[13px] text-text-tertiary truncate whitespace-nowrap leading-tight mt-0.5">
              {deptName || <span className="text-text-subtle">—</span>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'phone',
      header: t('table.phone'),
      width: COL_WIDTHS[3],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => emp.phone ? (
        <span className="text-[14px] text-text-secondary font-mono tabular-nums whitespace-nowrap truncate">
          {formatLocalPhone(emp.phone)}
        </span>
      ) : (
        <span className="text-[14px] text-text-subtle" aria-label={t('table.phone')}>—</span>
      ),
    },
    {
      key: 'email',
      header: t('table.gmail'),
      width: COL_WIDTHS[4],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => emp.email ? (
        <span className="text-[14px] text-text-tertiary truncate inline-block max-w-full">
          {emp.email}
        </span>
      ) : (
        <span className="text-[14px] text-text-subtle">—</span>
      ),
    },
    {
      key: 'assets',
      header: t('table.assets'),
      width: COL_WIDTHS[5],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => {
        const assetCount = assetCounts[emp.id] ?? 0
        return (
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[14px] font-medium px-1.5 py-0.5 rounded border ${
              assetCount === 0
                ? 'text-text-subtle bg-bg border-border'
                : 'text-text-secondary bg-bg border-border/70'
            }`}
            aria-label={t('table.assets')}
          >
            <Icon name="package" size={11} className="text-text-subtle" />
            {assetCount}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('table.status'),
      width: COL_WIDTHS[6],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => {
        const statusColor = emp.status === 'active' ? 'green' : 'violet'
        return (
          <Chip color={statusColor} dot>
            {t(`status.${emp.status}`)}
          </Chip>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      width: COL_WIDTHS[7],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => (
        <div className="flex items-center justify-end gap-1" style={{ paddingRight: '4px' }}>
          {emp.status === 'terminated' && onRestore && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRestore(emp.id) }}
              title={t('detail.restore')}
              aria-label={t('detail.restore')}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-subtle hover:text-violet-300 hover:bg-violet-500/10 transition-colors duration-100 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <Icon name="rotate-ccw" size={13} />
            </button>
          )}
          <Icon
            name="chevron-right"
            size={14}
            className="text-text-subtle group-hover:text-accent-light transition-colors duration-150 ml-0.5"
          />
        </div>
      ),
    },
  ], [t, branchMap, deptMap, headOfficeBranchId, assetCounts, onRestore])

  // ── Mobile card list (< 768px) ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {rows.map(emp => {
          const branchName = emp.branchId ? (branchMap.get(emp.branchId) ?? '') : ''
          const deptName   = emp.departmentId ? (deptMap.get(emp.departmentId) ?? '') : ''
          const isHeadOffice = !!headOfficeBranchId && emp.branchId === headOfficeBranchId
          const assetCount = assetCounts[emp.id] ?? 0
          const statusColor = emp.status === 'active' ? 'green' : 'violet'

          return (
            <div
              key={emp.id}
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(emp)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(emp) } }}
              className="flex flex-row items-start gap-3 bg-surface px-[14px] py-[10px] border-b border-white/[0.06] cursor-pointer transition-colors duration-[140ms] min-h-[68px] box-border last:border-b-0 active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(249,115,22,0.40)]"
            >
              {/* Icon tile */}
              <span className="w-8 h-8 min-w-[32px] rounded-[8px] bg-white/[0.04] border-[0.5px] border-white/[0.06] inline-flex items-center justify-center flex-shrink-0 text-white/60 mt-[1px]">
                <Icon name="user" size={16} />
              </span>

              {/* 3-row content column */}
              <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                {/* Row 1: name + status chip */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[14px] font-semibold text-white/95 leading-[18px] truncate flex-1 min-w-0">
                    {emp.firstName} {emp.lastName}
                  </span>
                  <span className="shrink-0 leading-none">
                    <Chip color={statusColor} dot size="sm">{t(`status.${emp.status}`)}</Chip>
                  </span>
                </div>

                {/* Row 2: position · department */}
                <div className="text-[12.5px] text-text-tertiary truncate">
                  {emp.position ?? ''}
                  {deptName ? ` · ${deptName}` : ''}
                </div>

                {/* Row 3: branch + asset count */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="shrink-0 inline-flex"
                      style={{ color: isHeadOffice ? '#10B981' : '#38BDF8' }}
                    >
                      <Icon name={isHeadOffice ? 'landmark' : 'building'} size={11} />
                    </span>
                    <span className="text-[12px] text-text-subtle truncate">
                      {branchName || '—'}
                    </span>
                  </div>
                  <span className="text-[12px] text-text-subtle shrink-0">
                    {assetCount} {t('table.assets')}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Desktop DataTable (≥ 768px) ─────────────────────────────────────────────
  return (
    <DataTable<Employee>
      columns={columns}
      rows={rows}
      getRowKey={(emp) => emp.id}
      onRowClick={onRowClick}
      minRows={minRows}
      placeholderTestId="emp-placeholder-row"
      aria-label={t('title')}
    />
  )
}
