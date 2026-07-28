import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { MobileListRow } from '@/components/ui'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { EmployeeAvatar } from './EmployeeAvatar'
import type { Employee } from '@/domain/employee'

export interface EmployeeRowMobileProps {
  employee: Employee
  branchName: string
  deptName: string
  assetCount: number
  /** Called with the employee when the row is clicked.
   *  Receives the employee so the parent can pass a stable callback directly
   *  (avoiding per-row inline-closure creation) and React.memo is effective. */
  onRowClick: (e: Employee) => void
}

/**
 * Mobile employee list row on shared MobileListRow.
 * Used by EmployeesTable when isMobile (≤767px).
 *
 * Icon tile: EmployeeAvatar at size="sm" (28px RoleIcon).
 * Title: ФИО 13px/700.
 * Subline: «{должность} · {отдел}» 11px text-tertiary (omits missing parts, no dangling ·).
 * Right: asset-count pill (CHIP_PALETTE; gray when 0, blue when >0) + branch name 10px muted.
 */
export const EmployeeRowMobile = memo(function EmployeeRowMobile({
  employee,
  branchName,
  deptName,
  assetCount,
  onRowClick,
}: EmployeeRowMobileProps) {
  const { t } = useTranslation('employees')

  // Omit missing parts — no dangling separator
  const sublineParts = [employee.position, deptName].filter(Boolean)
  const sublineText  = sublineParts.join(' · ')

  const iconTile = <EmployeeAvatar size="sm" />

  const titleNode = (
    <div className="text-[13px] font-bold text-text-primary leading-snug truncate mb-[2px]">
      {employee.firstName} {employee.lastName}
    </div>
  )

  const sublineNode = sublineText ? (
    <div className="text-[11px] text-text-tertiary leading-snug truncate">
      {sublineText}
    </div>
  ) : undefined

  // Asset count pill — gray when 0, blue when >0
  const pillPalette = assetCount === 0 ? CHIP_PALETTE.gray : CHIP_PALETTE.blue

  const right = (
    <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
          'text-[10px] font-bold whitespace-nowrap leading-none',
          pillPalette,
        ].join(' ')}
      >
        {assetCount}&nbsp;{t('table.assets')}
      </span>
      {branchName ? (
        <span className="text-[10px] text-text-subtle whitespace-nowrap max-w-[100px] truncate">
          {branchName}
        </span>
      ) : null}
    </div>
  )

  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      onClick={() => onRowClick(employee)}
      /* Fill contract (same as assets rows): rows + placeholder slots grow to
         distribute the card height so no clean band is left above pagination. */
      outerStyle={{ flexGrow: 1, flexShrink: 0 }}
    />
  )
})
