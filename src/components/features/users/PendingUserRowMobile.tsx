import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileListRow } from '@/components/ui'
import type { PendingUser } from '@/domain/user'

export interface PendingUserRowMobileProps {
  pu: PendingUser
  formattedDate: string
  onAssign: () => void
  /** Forwarded to MobileListRow's outerStyle — parent injects flexGrow/flexShrink for fill contract. */
  outerStyle?: CSSProperties
}

/**
 * Mobile row for a pending user — wraps ui/MobileListRow.
 * Row itself is inert (no onClick); only the footer Btn is interactive.
 */
export function PendingUserRowMobile({ pu, formattedDate, onAssign, outerStyle }: PendingUserRowMobileProps) {
  const { t } = useTranslation('pending-users')

  const iconTile = (
    <span
      className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-subtle"
      aria-hidden="true"
    >
      <Icon name="user" size={13} />
    </span>
  )

  const titleNode = (
    <div className="text-[13px] font-bold text-text-primary truncate leading-snug mb-[2px]">
      {pu.displayName || pu.email}
    </div>
  )

  const sublineNode = (
    <div className="text-[11px] leading-snug">
      <div className="text-text-tertiary truncate">{pu.email}</div>
      <div className="text-text-subtle mt-0.5">{formattedDate}</div>
    </div>
  )

  const footer = (
    <Btn size="sm" variant="primary" onClick={onAssign} className="w-full mt-0.5">
      <Icon name="user-plus" size={13} />
      {t('assign')}
    </Btn>
  )

  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      footer={footer}
      {...(outerStyle !== undefined ? { outerStyle } : {})}
    />
  )
}
