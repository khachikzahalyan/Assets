import { useTranslation } from 'react-i18next'
import { Icon } from './icon'
import { Btn } from './btn'

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  /**
   * Inline mode: drops the full-height fill (`h-full min-h-[18rem] flex-1`) so
   * the block sizes to its content. Use when the error renders as a banner
   * ABOVE coexisting live data (e.g. a partial-load dashboard/tab) rather than
   * as the sole occupant of a page/table region.
   */
  compact?: boolean
}

export function ErrorState({ title, description, onRetry, compact = false }: ErrorStateProps) {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? t('states.errorTitle')
  const resolvedDescription = description ?? t('states.errorDesc')
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${
      compact ? 'py-8' : 'h-full min-h-[18rem] flex-1 py-16'
    }`}>
      <span className="w-14 h-14 rounded-2xl bg-rose-950/40 light:bg-rose-50 text-[#FDA4AF] light:text-rose-700 border border-rose-800/40 light:border-rose-200 inline-flex items-center justify-center mb-4">
        <Icon name="triangle-alert" size={24} />
      </span>
      <h3 className="text-14 font-semibold text-text-primary mb-1">{resolvedTitle}</h3>
      <p className="max-w-sm text-12.5 text-text-subtle mb-4">{resolvedDescription}</p>
      {onRetry && (
        <Btn variant="secondary" size="md" onClick={onRetry}>
          <Icon name="refresh-cw" size={14} />
          {t('actions.retry')}
        </Btn>
      )}
    </div>
  )
}
