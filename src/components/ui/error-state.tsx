import { useTranslation } from 'react-i18next'
import { Icon } from './icon'
import { Btn } from './btn'

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? t('states.errorTitle')
  const resolvedDescription = description ?? t('states.errorDesc')
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="w-14 h-14 rounded-2xl bg-rose-950/40 text-[#FDA4AF] border border-rose-800/40 inline-flex items-center justify-center mb-4">
        <Icon name="triangle-alert" size={24} />
      </span>
      <h3 className="text-[14px] font-semibold text-[#F8FAFC] mb-1">{resolvedTitle}</h3>
      <p className="max-w-sm text-[12.5px] text-[#64748B] mb-4">{resolvedDescription}</p>
      {onRetry && (
        <Btn variant="secondary" size="md" onClick={onRetry}>
          <Icon name="refresh-cw" size={14} />
          {t('actions.retry')}
        </Btn>
      )}
    </div>
  )
}
