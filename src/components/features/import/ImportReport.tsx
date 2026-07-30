import { useTranslation } from 'react-i18next'
import { Icon, Btn } from '@/components/ui'
import type { ImportResult } from '@/lib/importXlsx'

interface ImportReportProps {
  result: ImportResult
  onToAssets: () => void
  onImportMore: () => void
}

export function ImportReport({ result, onToAssets, onImportMore }: ImportReportProps) {
  const { t } = useTranslation('import')

  return (
    <div className="space-y-6 py-6 max-w-lg mx-auto">
      {/* Success header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-950/30 light:bg-emerald-50 border border-emerald-800/30 light:border-emerald-200 mb-4">
          <Icon name="check-circle" size={24} className="text-emerald-400 light:text-emerald-700" />
        </div>
        <h2 className="text-[16px] font-semibold text-text-primary">
          {t('report.heading')}
        </h2>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { key: 'report.employeesCreated', count: result.employeesCreated, icon: 'users' },
            { key: 'report.assetsCreated', count: result.assetsCreated, icon: 'package' },
            { key: 'report.assignmentsCreated', count: result.assignmentsCreated, icon: 'link' },
          ] as const
        ).map(({ key, count, icon }) => (
          <div key={key} className="bg-surface border border-border rounded-xl p-3 text-center">
            <Icon name={icon} size={16} className="text-text-tertiary mx-auto mb-1" />
            <div className="text-[22px] font-bold text-text-primary tabular-nums">{count}</div>
            <div className="text-[11px] text-text-tertiary leading-tight mt-0.5">
              {t(key, { count })}
            </div>
          </div>
        ))}
      </div>

      {/* Skipped rows */}
      {result.skipped.length === 0 ? (
        <div className="flex items-center gap-2 bg-emerald-950/10 light:bg-emerald-50 border border-emerald-800/20 light:border-emerald-200 rounded-xl px-4 py-3">
          <Icon name="check" size={14} className="text-emerald-400 light:text-emerald-700 flex-shrink-0" />
          <span className="text-[13px] text-emerald-400 light:text-emerald-700">{t('report.noSkipped')}</span>
        </div>
      ) : (
        <div>
          <h3 className="text-[13px] font-semibold text-text-primary mb-2">{t('report.skippedHeading')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 text-text-subtle font-medium">{t('report.skippedSheet')}</th>
                  <th className="text-left py-1.5 px-2 text-text-subtle font-medium">{t('report.skippedRow')}</th>
                  <th className="text-left py-1.5 px-2 text-text-subtle font-medium">{t('report.skippedReason')}</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((s, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1.5 px-2 text-text-secondary">{s.sheet}</td>
                    <td className="py-1.5 px-2 text-text-secondary tabular-nums">{s.rowNumber}</td>
                    <td className="py-1.5 px-2 text-rose-400 light:text-rose-700">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 justify-center pt-2">
        <Btn variant="secondary" onClick={onImportMore}>
          <Icon name="upload" size={14} />
          {t('report.importMore')}
        </Btn>
        <Btn variant="primary" onClick={onToAssets}>
          <Icon name="arrow-right" size={14} />
          {t('report.toAssets')}
        </Btn>
      </div>
    </div>
  )
}
