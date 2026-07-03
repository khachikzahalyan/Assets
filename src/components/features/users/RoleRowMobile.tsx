import { Btn, Chip, Icon, MobileListRow } from '@/components/ui'
import { RoleIcon } from '@/components/ui/RoleIcon'
import type { User } from '@/domain/user'

export interface RoleRowMobileProps {
  u: User
  isSelf: boolean
  roleLabel: string
  statusLabel: string
  youLabel: string
  changeLabel: string
  onChangeRole: () => void
}

/**
 * Mobile row for a user in the Roles page — wraps ui/MobileListRow.
 * Row itself is inert; only the right Change Btn is interactive.
 */
export function RoleRowMobile({
  u, isSelf, roleLabel, statusLabel, youLabel, changeLabel, onChangeRole,
}: RoleRowMobileProps) {
  const iconTile = (
    <span
      className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-subtle"
      aria-hidden="true"
    >
      <Icon name="user" size={13} />
    </span>
  )

  const titleNode = (
    <div className="flex items-center gap-1.5 leading-snug mb-[2px] min-w-0">
      <span className="text-[13px] font-bold text-text-primary truncate">
        {u.displayName || u.email}
      </span>
      {isSelf && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent flex-shrink-0">
          {youLabel}
        </span>
      )}
    </div>
  )

  const sublineNode = (
    <div className="text-[11px] leading-snug">
      <div className="text-text-tertiary truncate">{u.email}</div>
      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
        <Chip color="gray">
          <RoleIcon role={u.role} size={16} className="shrink-0 mr-0.5" />
          {roleLabel}
        </Chip>
        <span className="text-text-tertiary">{statusLabel}</span>
      </div>
    </div>
  )

  const right = (
    <Btn size="sm" variant="secondary" onClick={onChangeRole}>
      <Icon name="shield-check" size={13} />
      {changeLabel}
    </Btn>
  )

  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      {...(isSelf ? { className: 'bg-accent/5' } : {})}
    />
  )
}
