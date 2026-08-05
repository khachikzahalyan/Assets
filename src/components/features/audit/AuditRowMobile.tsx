import { memo } from 'react'
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
  /** The currently-expanded log id (null = none). Used to derive isOpen locally
   *  so the parent can pass a stable `onToggle` without closing over `expanded`. */
  expandedId: string | null
  /** Called with the log id when the row is clicked. Stable via useCallback in AuditTable. */
  onToggle: (id: string) => void
}

/**
 * Mobile audit log row — wraps ui/MobileListRow with audit-specific slot content.
 * Extracted from AuditTable to keep AuditTable well under 300 lines.
 */
export const AuditRowMobile = memo(function AuditRowMobile({ log, refData, expandedId, onToggle }: AuditRowMobileProps) {
  const isOpen = expandedId === log.id
  const { t, i18n } = useTranslation('audit')
  const navigate = useNavigate()

  const link = entityLink(log)

  const iconTile = (
    <span
      className="w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-tertiary"
      aria-hidden="true"
    >
      <Icon name={iconForEntity(log.entityType)} size={14} />
    </span>
  )

  const titleNode = (
    <div className="text-13 font-bold text-text-primary truncate leading-snug mb-0.5">
      {resolveActorName(log.actorUid, refData.actors, log.actorName)}
    </div>
  )

  const sublineNode = (
    <div className="text-11 text-text-tertiary leading-snug">
      <div className="truncate">
        {t(`action.${log.action}`, { defaultValue: log.action })}
        {' · '}
        {formatAuditTs(log.at, i18n.language)}
      </div>
      <div className="mt-0.5">
        {link != null ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(link) }}
            className="font-mono text-11 text-accent-light underline cursor-pointer bg-transparent border-0 p-0 m-0"
          >
            {log.entityId}
          </button>
        ) : (
          <span className="font-mono text-11 text-text-subtle">{log.entityId}</span>
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
    <div className="mt-1 -mx-3.5 -mb-[0.4375rem] bg-[#15181C] light:bg-surface-sunken px-3 py-2 border-t border-border">
      <AuditDiff log={log} />
    </div>
  ) : undefined

  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      onClick={() => onToggle(log.id)}
      {...(footer !== undefined ? { footer } : {})}
      /* Fill contract (same as EmployeeRowMobile/CatalogTable rows): rows +
         placeholder slots grow to distribute the card height evenly. */
      outerStyle={{ flexGrow: 1, flexShrink: 0 }}
    />
  )
})
