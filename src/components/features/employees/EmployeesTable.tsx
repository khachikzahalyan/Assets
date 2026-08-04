import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip, DataTable, MobileListPlaceholders } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { EmployeeAvatar } from './EmployeeAvatar'
import { EmployeeRowMobile } from './EmployeeRowMobile'
import { formatLocalPhone } from './employeeFormat'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

// Grid column widths — must match the EmployeesPage skeleton exactly (track-for-track)
const COL_WIDTHS = [
  'minmax(11.25rem,1.6fr)', // Employee
  'minmax(7.5rem,0.9fr)',   // Branch
  'minmax(8.75rem,1.2fr)',  // Position / Dept
  'minmax(6.875rem,0.85fr)', // Phone
  'minmax(10rem,1.4fr)',    // Gmail
  'minmax(5rem,0.6fr)',     // Assets
  'minmax(6.25rem,0.9fr)',  // Status
  '3.5rem',                 // Chevron / Actions
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
  // Shared hook uses the same (max-width: 767px) query as the former local listener.
  const isMobile = useIsMobile()

  // ── Desktop DataTable columns ────────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<Employee>[]>(() => [
    {
      key: 'employee',
      header: t('table.employee'),
      width: COL_WIDTHS[0],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => (
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0 w-full">
          <EmployeeAvatar size="sm" />
          <span className="text-15 font-semibold text-text-primary truncate leading-tight">
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
              className={`shrink-0 inline-flex ${isHeadOffice ? 'text-emerald-500' : 'text-sky-400 light:text-sky-600'}`}
            >
              <Icon name={isHeadOffice ? 'landmark' : 'building'} size={12} />
            </span>
            <span className="text-14.5 text-text-secondary truncate">
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
            <div className="text-14.5 font-medium text-text-primary truncate whitespace-nowrap leading-tight">
              {emp.position || <span className="text-text-subtle">—</span>}
            </div>
            <div className="text-13 text-text-tertiary truncate whitespace-nowrap leading-tight mt-0.5">
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
        <span className="text-14 text-text-secondary font-mono tabular-nums whitespace-nowrap truncate">
          {formatLocalPhone(emp.phone)}
        </span>
      ) : (
        <span className="text-14 text-text-subtle" aria-label={t('table.phone')}>—</span>
      ),
    },
    {
      key: 'email',
      header: t('table.gmail'),
      width: COL_WIDTHS[4],
      cellClassName: 'overflow-hidden min-w-0',
      cell: (emp) => emp.email ? (
        <span className="text-14 text-text-tertiary truncate inline-block max-w-full">
          {emp.email}
        </span>
      ) : (
        <span className="text-14 text-text-subtle">—</span>
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
            className={`inline-flex items-center gap-1.5 font-mono text-14 font-medium px-1.5 py-0.5 rounded border ${
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
        const statusColor = emp.status === 'active' ? 'green' : 'red'
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
        <div className="flex items-center justify-end gap-1" style={{ paddingRight: '0.25rem' }}>
          {emp.status === 'terminated' && onRestore && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRestore(emp.id) }}
              title={t('detail.restore')}
              aria-label={t('detail.restore')}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-subtle hover:text-violet-300 light:hover:text-violet-700 hover:bg-violet-500/10 transition-colors duration-100 opacity-0 group-hover:opacity-100 focus:opacity-100"
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
    const placeholderCount = Math.max(0, minRows - rows.length)
    return (
      /* grow shrink-0 — the list block stretches inside the Zone-2 flex column
         (assets fill contract) so rows/placeholders distribute the full height */
      <div className="flex flex-col grow shrink-0">
        {rows.map(emp => (
          <EmployeeRowMobile
            key={emp.id}
            employee={emp}
            branchName={emp.branchId ? (branchMap.get(emp.branchId) ?? '') : ''}
            deptName={emp.departmentId ? (deptMap.get(emp.departmentId) ?? '') : ''}
            assetCount={assetCounts[emp.id] ?? 0}
            onRowClick={onRowClick}
          />
        ))}
        <MobileListPlaceholders count={placeholderCount} dataTestId="emp-placeholder-row" />
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
      fillHeight
      aria-label={t('title')}
    />
  )
}
