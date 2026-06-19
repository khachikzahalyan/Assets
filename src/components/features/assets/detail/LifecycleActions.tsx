import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'

export interface LifecycleActionsProps {
  statusId: string
  canIssue: boolean
  canRepair: boolean
  canAssign: boolean
  onSendToRepair: () => void
  onWriteOff: () => void
  onReturn: () => void
  onAssign: () => void
}

export function LifecycleActions({
  statusId,
  canIssue,
  canRepair,
  canAssign,
  onSendToRepair,
  onWriteOff,
  onReturn,
  onAssign,
}: LifecycleActionsProps) {
  const { t } = useTranslation('assets')

  const isWarehouse = statusId === 'st_warehouse'
  const isDisposed = statusId === 'st_disposed'
  const isRepair = statusId === 'st_repair'
  const isAssigned = statusId === 'st_assigned'

  const showAssign = canAssign && isWarehouse
  const showSendToRepair = canRepair && !isRepair && !isDisposed
  const showWriteOff = canIssue && !isDisposed
  const showReturn = canIssue && (isAssigned || isRepair)

  if (!showAssign && !showSendToRepair && !showWriteOff && !showReturn) return null

  return (
    <div className="flex items-center flex-wrap gap-2">
      {showAssign && (
        <Btn variant="primary" size="sm" onClick={onAssign}>
          <Icon name="user-check" size={13} />
          {t('assign.action')}
        </Btn>
      )}
      {showReturn && (
        <Btn variant="secondary" size="sm" onClick={onReturn}>
          <Icon name="undo-2" size={13} />
          {t('form.return')}
        </Btn>
      )}
      {showSendToRepair && (
        <Btn variant="secondary" size="sm" onClick={onSendToRepair}>
          <Icon name="wrench" size={13} />
          {t('form.sendToRepair')}
        </Btn>
      )}
      {showWriteOff && (
        <Btn variant="danger" size="sm" onClick={onWriteOff}>
          <Icon name="trash-2" size={13} />
          {t('form.writeOff')}
        </Btn>
      )}
    </div>
  )
}
