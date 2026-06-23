import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EmployeeRow } from './EmployeeRow'
import { Icon, Chip } from '@/components/ui'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

// Grid columns — must match EmployeeRow exactly
const GRID_COLS =
  'minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px'

// The first branch in any list is treated as head office by convention; the
// true head-office check compares against the configured branch id.
// Since the domain does not carry a headOffice flag on RefRow, we expose it
// via a prop so the page can pass it down.
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

  // Placeholder rows to maintain constant 10-row footprint (desktop only)
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
              {/* Icon tile — generic muted user icon (matches prototype mobile card) */}
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

  // ── Desktop grid table (≥ 768px) ────────────────────────────────────────────
  return (
    <div
      role="table"
      aria-label={t('title')}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* Sticky header */}
      <div
        role="rowgroup"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          height: '44px',
          minHeight: '44px',
          alignItems: 'center',
          background: '#111315',
          borderBottom: '1px solid rgba(42,47,54,0.9)',
          flexShrink: 0,
        }}
      >
        {[
          { label: t('table.employee'), pl: '20px' },
          { label: t('table.branch'), pl: '12px' },
          { label: t('table.position'), pl: '12px' },
          { label: t('table.phone'), pl: '12px' },
          { label: t('table.gmail'), pl: '12px' },
          { label: t('table.assets'), pl: '12px' },
          { label: t('table.status'), pl: '12px' },
          { label: '', pl: '12px' },
        ].map(({ label, pl }, i) => (
          <div
            key={i}
            role="columnheader"
            className="px-3 text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary truncate overflow-hidden min-w-0"
            style={{ paddingLeft: pl }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Data rows + placeholder rows */}
      <div
        role="rowgroup"
        style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}
      >
        {rows.map(emp => (
          <EmployeeRow
            key={emp.id}
            employee={emp}
            branchName={emp.branchId ? (branchMap.get(emp.branchId) ?? '') : ''}
            isHeadOffice={!!headOfficeBranchId && emp.branchId === headOfficeBranchId}
            deptName={emp.departmentId ? (deptMap.get(emp.departmentId) ?? '') : ''}
            assetCount={assetCounts[emp.id] ?? 0}
            onClick={() => onRowClick(emp)}
            onRestore={onRestore}
          />
        ))}

        {/* Placeholder rows — desktop only (max-md:hidden) — maintain fixed table height.
            MUST NOT have role="row" so getAllByRole('row') counts stay correct.
            aria-hidden, pointer-events:none, no hover, no focus. */}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`__ph_${i}`}
            aria-hidden="true"
            data-testid="emp-placeholder-row"
            className="max-md:hidden"
            style={{
              position: 'relative',
              flex: '1 1 0',
              minHeight: '58px',
              borderTop: '1px solid rgba(42,47,54,0.35)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '20px',
                right: '20px',
                top: '50%',
                height: '1px',
                borderTop: '1px dashed rgba(42,47,54,0.5)',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
