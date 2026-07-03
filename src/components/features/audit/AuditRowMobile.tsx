import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Chip, MobileListRow } from '@/components/ui'
import { AuditDiff } from './AuditDiff'
import { formatAuditTs, resolveActorName, entityLink } from './auditFormat'
import type { AuditLog, AuditLogReferenceData } from '@/domain/audit'
import type { AuditEntityType } from '@/domain/audit'

const ENTITY_ICON: Partial<Record<AuditEntityType, string>> = {
  asset: 'box',
  employee: 'user',
  user: 'shield-check',
  branch: 'building',
  department: 'network',
  license: 'key-round',
  server_license: 'key-round',
  category: 'tags',
  categoryGroup: 'tags',
}

function iconForEntity(type: AuditEntityType): string {
  return ENTITY_ICON[type] ?? 'history'
}

export interface AuditRowMobileProps {
  log: AuditLog
  refData: AuditLogReferenceData
  isOpen: boolean
  onToggle: () => void
}

/**
 * Mobile audit log row — wraps ui/MobileListRow with audit-specific slot content.
 * Extracted from AuditTable to keep AuditTable well under 300 lines.
 */
export function AuditRowMobile({ log, refData, isOpen, onToggle }: AuditRowMobileProps) {
  const { t, i18n } = useTranslation('audit')
  const navigate = useNavigate()

  const link = entityLink(log)

  const iconTile = (
    <span
      className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-tertiary"
      aria-hidden="true"
    >
      <Icon name={iconForEntity(log.entityType)} size={14} />
    </span>
  )

  const titleNode = (
    <div className="text-[13px] font-bold text-text-primary truncate leading-snug mb-[2px]">
      {resolveActorName(log.actorUid, refData.actors)}
    </div>
  )

  const sublineNode = (
    <div className="text-[11px] text-text-tertiary leading-snug">
      <div className="truncate">
        {t(`action.${log.action}`, { defaultValue: log.action })}
        {' · '}
        {formatAuditTs(log.at, i18n.language)}
      </div>
      <div className="mt-0.5">
        {link != null ? (
          <span
            role="link"
            onClick={(e) => { e.stopPropagation(); navigate(link) }}
            className="font-mono text-[11px] text-accent-light underline cursor-pointer"
          >
            {log.entityId}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-text-subtle">{log.entityId}</span>
        )}
      </div>
    </div>
  )

  const right = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <Chip>
        {t(`entity.${log.entityType}`, { defaultValue: log.entityType })}
      </Chip>
      <Icon
        name="chevron-right"
        size={13}
        className={`text-text-subtle transition-transform ${isOpen ? 'rotate-90' : ''}`}
      />
    </div>
  )

  const footer = isOpen ? (
    <div className="mt-1 -mx-[14px] -mb-[7px] bg-[#15181C] px-3 py-2 border-t border-border">
      <AuditDiff log={log} />
    </div>
  ) : undefined

  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      onClick={onToggle}
      {...(footer !== undefined ? { footer } : {})}
    />
  )
}
