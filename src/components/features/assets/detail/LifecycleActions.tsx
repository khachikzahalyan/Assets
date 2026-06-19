import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'

export interface LifecycleActionsProps {
  statusId: string
  canIssue: boolean
  canRepair: boolean
  onSendToRepair: () => void
  onWriteOff: () => void
  onReturn: () => void
}

export function LifecycleActions({
  statusId,
  canIssue,
  canRepair,
  onSendToRepair,
  onWriteOff,
  onReturn,
}: LifecycleActionsProps) {
  const { t } = useTranslation('assets')

  const isDisposed = statusId === 'st_disposed'
  const isRepair = statusId === 'st_repair'
  const isAssigned = statusId === 'st_assigned'

  const showSendToRepair = canRepair && !isRepair && !isDisposed
  const showWriteOff = canIssue && !isDisposed
  const showReturn = canIssue && (isAssigned || isRepair)

  if (!showSendToRepair && !showWriteOff && !showReturn) return null

  return (
    <div className="flex items-center flex-wrap gap-2">
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
