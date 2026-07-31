import type { CSSProperties } from 'react'
import { Btn, Icon, MobileListRow } from '@/components/ui'
import { RoleIcon } from '@/components/ui/RoleIcon'
import type { User } from '@/domain/user'

export interface RoleRowMobileProps {
  u: User
  isSelf: boolean
  youLabel: string
  changeLabel: string
  onChangeRole: () => void
  /** Forwarded to MobileListRow.outerStyle — parent injects flexGrow/flexShrink for fill contract. */
  outerStyle?: CSSProperties
}

/**
 * Mobile row for a user in the Roles page — wraps ui/MobileListRow.
 * Compact 2-line layout (owner request): the role badge IS the avatar, so the
 * role text is dropped; only name + email remain, keeping the row short enough
 * that a full PAGE_SIZE list fits the card without a page scroll. No status
 * indicator in the list (owner request) — status lives in the filter + dialog.
 * Row is inert; only the right Btn acts.
 */
export function RoleRowMobile({
  u, isSelf, youLabel, changeLabel, onChangeRole, outerStyle,
}: RoleRowMobileProps) {
  // Avatar = the role badge itself (owner request); generic tile only when no role
  const iconTile = u.role ? (
    <RoleIcon role={u.role} size={30} className="shrink-0" />
  ) : (
    <span
      className="w-[1.875rem] h-[1.875rem] rounded-full inline-flex items-center justify-center flex-shrink-0 bg-surface-2 border border-border text-text-subtle"
      aria-hidden="true"
    >
      <Icon name="user" size={14} />
    </span>
  )

  const titleNode = (
    <div className="flex items-center gap-1.5 leading-snug min-w-0">
      <span className="text-13 font-bold text-text-primary truncate">
        {u.displayName || u.email}
      </span>
      {isSelf && (
        <span className="text-10 px-1.5 py-0.5 rounded bg-accent/15 text-accent flex-shrink-0">
          {youLabel}
        </span>
      )}
    </div>
  )

  const sublineNode = (
    <div className="text-11.5 text-text-tertiary truncate leading-snug">{u.email}</div>
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
      {...(outerStyle !== undefined ? { outerStyle } : {})}
      {...(isSelf ? { className: 'bg-accent/5' } : {})}
    />
  )
}
