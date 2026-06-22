import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { EmployeeAvatar } from './EmployeeAvatar'
import { formatLocalPhone } from './employeeFormat'
import type { Employee } from '@/domain/employee'

// Grid columns matching prototype EMP_GRID_COLS
const GRID_COLS =
  'minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px'

export interface EmployeeRowProps {
  employee: Employee
  branchName: string
  isHeadOffice: boolean
  deptName: string
  assetCount: number
  onClick: () => void
  onRestore?: ((id: string) => void) | undefined
}

export function EmployeeRow({
  employee,
  branchName,
  isHeadOffice,
  deptName,
  assetCount,
  onClick,
  onRestore,
}: EmployeeRowProps) {
  const { t } = useTranslation('employees')

  const statusColor = employee.status === 'active' ? 'green' : 'violet'

  return (
    <div
      role="row"
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      tabIndex={0}
      className="group cursor-pointer transition-colors duration-150 hover:bg-[rgba(249,115,22,0.08)] border-t border-[#2A2F36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-inset"
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        flex: '1 1 0',
        minHeight: '58px',
        alignItems: 'center',
      }}
    >
      {/* 1 — Employee: avatar + full name */}
      <div
        role="cell"
        className="flex items-center gap-2.5 overflow-hidden px-3 h-full min-w-0"
        style={{ paddingLeft: '20px' }}
      >
        <EmployeeAvatar firstName={employee.firstName} lastName={employee.lastName} id={employee.id} size="sm" />
        <span className="text-[15px] font-semibold text-[#F8FAFC] truncate leading-tight">
          {employee.firstName} {employee.lastName}
        </span>
      </div>

      {/* 2 — Branch: icon + name */}
      <div role="cell" className="flex items-center gap-1.5 overflow-hidden px-3 h-full min-w-0">
        <span
          className="shrink-0 inline-flex"
          style={{ color: isHeadOffice ? '#10B981' : '#38BDF8' }}
        >
          <Icon name={isHeadOffice ? 'landmark' : 'building'} size={12} />
        </span>
        <span className="text-[14.5px] text-[#CBD5E1] truncate">
          {branchName || <span className="text-[#64748B]">—</span>}
        </span>
      </div>

      {/* 3 — Position (primary) + Department (secondary) */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <div className="min-w-0 w-full">
          <div className="text-[14.5px] font-medium text-[#F8FAFC] truncate whitespace-nowrap leading-tight">
            {employee.position || <span className="text-[#64748B]">—</span>}
          </div>
          <div className="text-[13px] text-[#94A3B8] truncate whitespace-nowrap leading-tight mt-0.5">
            {deptName || <span className="text-[#64748B]">—</span>}
          </div>
        </div>
      </div>

      {/* 4 — Phone */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        {employee.phone ? (
          <span className="text-[14px] text-[#CBD5E1] font-mono tabular-nums whitespace-nowrap truncate">
            {formatLocalPhone(employee.phone)}
          </span>
        ) : (
          <span className="text-[14px] text-[#64748B]" aria-label={t('table.phone')}>—</span>
        )}
      </div>

      {/* 5 — Gmail */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        {employee.email ? (
          <span className="text-[14px] text-[#94A3B8] truncate inline-block max-w-full">
            {employee.email}
          </span>
        ) : (
          <span className="text-[14px] text-[#64748B]">—</span>
        )}
      </div>

      {/* 6 — Asset count pill */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[14px] font-medium px-1.5 py-0.5 rounded border ${
            assetCount === 0
              ? 'text-[#64748B] bg-[#111315] border-[#2A2F36]'
              : 'text-[#CBD5E1] bg-[#111315] border-[#2A2F36]/70'
          }`}
          aria-label={t('table.assets')}
        >
          <Icon name="package" size={11} className="text-[#64748B]" />
          {assetCount}
        </span>
      </div>

      {/* 7 — Status chip */}
      <div role="cell" className="flex items-center overflow-hidden px-3 h-full min-w-0">
        <Chip color={statusColor} dot>
          {t(`status.${employee.status}`)}
        </Chip>
      </div>

      {/* 8 — Chevron actions */}
      <div
        role="cell"
        className="flex items-center justify-end overflow-hidden px-3 h-full min-w-0"
        style={{ paddingRight: '12px' }}
      >
        {employee.status === 'terminated' && onRestore && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRestore(employee.id) }}
            title={t('detail.restore')}
            aria-label={t('detail.restore')}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#64748B] hover:text-violet-300 hover:bg-violet-500/10 transition-colors duration-100 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Icon name="rotate-ccw" size={13} />
          </button>
        )}
        <Icon
          name="chevron-right"
          size={14}
          className="text-[#64748B] group-hover:text-[#FB923C] transition-colors duration-150 ml-0.5"
        />
      </div>
    </div>
  )
}
