import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { ImportPhase, ImportProgressEvent } from '@/lib/importXlsx'

interface ImportProgressProps {
  event: ImportProgressEvent | null
}

const PHASE_ORDER: ImportPhase[] = ['employees', 'assets', 'assignments']

export function ImportProgress({ event }: ImportProgressProps) {
  const { t } = useTranslation('import')

  const phaseKey: Record<ImportPhase, string> = {
    employees: t('progress.phaseEmployees'),
    assets: t('progress.phaseAssets'),
    assignments: t('progress.phaseAssignments'),
  }

  const pct = event && event.total > 0
    ? Math.round((event.done / event.total) * 100)
    : 0

  return (
    <div className="space-y-6 py-8 max-w-md mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
          <Icon name="loader-2" size={24} className="text-accent animate-spin" />
        </div>
        <h2 className="text-16 font-semibold text-text-primary mb-1">
          {t('progress.heading')}
        </h2>
        {event && (
          <p className="text-13.5 text-text-tertiary">
            {phaseKey[event.phase]} — {event.done} / {event.total}
          </p>
        )}
      </div>

      {/* Phase list */}
      <div className="space-y-2">
        {PHASE_ORDER.map((phase) => {
          const isActive = event?.phase === phase
          const isDone = event
            ? PHASE_ORDER.indexOf(event.phase) > PHASE_ORDER.indexOf(phase)
            : false
          return (
            <div
              key={phase}
              className={[
                'flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors',
                isActive
                  ? 'bg-accent/10 border-accent/30'
                  : isDone
                    ? 'bg-emerald-950/10 light:bg-emerald-50 border-emerald-800/20 light:border-emerald-200'
                    : 'bg-surface border-border',
              ].join(' ')}
            >
              <span
                className={[
                  'w-5 h-5 rounded-full inline-flex items-center justify-center flex-shrink-0',
                  isActive
                    ? 'bg-accent'
                    : isDone
                      ? 'bg-emerald-600'
                      : 'bg-surface-2 border border-border',
                ].join(' ')}
              >
                {isDone && <Icon name="check" size={11} className="text-white" />}
                {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              </span>
              <span
                className={[
                  'text-13 font-medium',
                  isActive
                    ? 'text-accent-light'
                    : isDone
                      ? 'text-emerald-400 light:text-emerald-700'
                      : 'text-text-subtle',
                ].join(' ')}
              >
                {phaseKey[phase]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      {event && (
        <div>
          <div className="flex justify-between text-12 text-text-subtle mb-1.5 tabular-nums">
            <span>{event.done}</span>
            <span>{pct}%</span>
            <span>{event.total}</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </div>
  )
}
