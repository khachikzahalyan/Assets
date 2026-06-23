import { useTranslation } from 'react-i18next'
import { Chip, Icon, IconBtn } from '@/components/ui'
import type { Asset, EmployeeRow } from '@/domain/asset'
import type { ChipColor } from '@/components/ui/chip'
import { AssigneeCell } from './AssigneeCell'

export const GRID_COLS =
  'minmax(240px,2.4fr) minmax(130px,1fr) minmax(100px,0.85fr) minmax(150px,1.2fr) minmax(110px,1fr) minmax(100px,0.9fr) 56px'

export interface AssetRowProps {
  asset: Asset
  /** Precomputed display title from assetTitle(asset, categoryName, group). */
  title: string
  categoryName: string
  categoryIcon: string
  catColor: { bg: string; icon: string } | null
  statusName: string
  statusColor: ChipColor
  branchName: string
  isMainBranch: boolean
  // AssigneeCell data
  employeeMap: Map<string, EmployeeRow>
  deptMap: Map<string, string>
  branchMap: Map<string, string>
  // AssigneeCell translated labels
  onShelf: string
  onShelfSub: string
  deptLabel: string
  branchLabel: string
  tempLabel: string
  kindAuditLabel: string
  kindInternLabel: string
  /** Absolute date string from fmtDate(asset.updatedAt). */
  formattedTime: string
  canMutate: boolean
  onRowClick: (asset: Asset) => void
  onEditClick?: (asset: Asset) => void
}

export function AssetRow({
  asset,
  title,
  categoryName,
  categoryIcon,
  catColor,
  statusName,
  statusColor,
  branchName,
  isMainBranch,
  employeeMap,
  deptMap,
  branchMap,
  onShelf,
  onShelfSub,
  deptLabel,
  branchLabel,
  tempLabel,
  kindAuditLabel,
  kindInternLabel,
  formattedTime,
  canMutate,
  onRowClick,
  onEditClick,
}: AssetRowProps) {
  const { t } = useTranslation('assets')

  const isRemote = asset.assignment?.workMode === 'remote'
  const subBase = categoryName || asset.brand || '—'
  const sub = asset.serial ? `${subBase} · ${asset.serial}` : subBase

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(asset)
    }
  }

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onRowClick(asset)}
      onKeyDown={handleKeyDown}
      className={[
        'cursor-pointer border-t border-border transition-colors duration-150 group',
        'hover:bg-[rgba(249,115,22,0.08)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(249,115,22,0.40)]',
      ].join(' ')}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        alignItems: 'center',
        flex: '1 1 0',
        minHeight: 58,
      }}
    >
      {/* Cell 1: Asset */}
      <div role="cell" className="py-3 flex items-center gap-2.5 min-w-0" style={{ paddingLeft: 20 }}>
        {/* Category icon box */}
        <span
          className="w-9 h-9 rounded-lg bg-surface-2 border border-border text-text-tertiary inline-flex items-center justify-center flex-shrink-0 transition-colors duration-[180ms]"
          style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon, borderColor: catColor.icon } : undefined}
        >
          <Icon name={categoryIcon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15.5px] font-semibold text-text-primary truncate leading-tight">
              {title}
            </span>
            {isRemote && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Icon name="house" size={10} />
                {t('badges.remote')}
              </span>
            )}
          </div>
          <div className="text-[13.5px] text-text-tertiary truncate leading-tight mt-0.5">
            {sub}
          </div>
        </div>
      </div>

      {/* Cell 2: Branch */}
      <div role="cell" className="py-3 px-3 flex items-center gap-1.5 min-w-0">
        <span
          className="shrink-0 inline-flex"
          style={{ color: isMainBranch ? '#10B981' : '#38BDF8' }}
        >
          <Icon name={isMainBranch ? 'landmark' : 'building'} size={12} />
        </span>
        <span className="text-[14.5px] text-text-secondary truncate">{branchName}</span>
      </div>

      {/* Cell 3: Inv Code */}
      <div role="cell" className="py-3 px-3">
        <span className="inline-block max-w-full truncate font-mono text-[14px] font-semibold text-text-secondary bg-bg border border-border rounded-md px-1.5 py-0.5">
          {asset.invCode}
        </span>
      </div>

      {/* Cell 4: Assignee */}
      <div role="cell" className="py-3 px-3 min-w-0">
        <AssigneeCell
          asset={asset}
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
      </div>

      {/* Cell 5: Status */}
      <div role="cell" className="py-3 px-3">
        <Chip color={statusColor} dot>{statusName}</Chip>
      </div>

      {/* Cell 6: Updated */}
      <div role="cell" className="py-3 px-3">
        <span className="text-[14.5px] text-text-secondary tabular-nums whitespace-nowrap">
          {formattedTime}
        </span>
      </div>

      {/* Cell 7: Actions */}
      <div
        role="cell"
        className="py-3 flex items-center justify-end"
        style={{ paddingRight: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {canMutate && onEditClick && (
          <IconBtn
            icon="settings"
            size="sm"
            title={t('actions.edit')}
            onClick={() => onEditClick(asset)}
            className="opacity-0 group-hover:opacity-100"
          />
        )}
        <Icon
          name="chevron-right"
          size={14}
          className="text-text-subtle group-hover:text-accent-light transition-colors ml-0.5"
        />
      </div>
    </div>
  )
}
