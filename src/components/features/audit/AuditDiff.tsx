import { useTranslation } from 'react-i18next'
import { computeDiff } from './auditFormat'
import type { AuditLog } from '@/domain/audit'

export interface AuditDiffProps {
  log: AuditLog
}

/**
 * Renders a key-by-key before/after diff of an audit entry. Values are shown
 * AS-IS (masked secrets stay masked — masking happens at write time). There is
 * deliberately no reveal affordance.
 */
export function AuditDiff({ log }: AuditDiffProps) {
  const { t } = useTranslation('audit')
  const rows = computeDiff(log.before, log.after)

  return (
    <div className="bg-[#111315] border border-[#2A2F36] rounded-lg p-3 space-y-2">
      {log.comment && (
        <p className="text-[12px] text-[#94A3B8]">
          <span className="text-[#64748B]">{t('diff.comment')}: </span>{log.comment}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-[12px] text-[#64748B]">{t('diff.noChanges')}</p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[#64748B] text-left">
              <th className="font-medium pb-1 pr-3">{t('diff.field')}</th>
              <th className="font-medium pb-1 pr-3">{t('diff.before')}</th>
              <th className="font-medium pb-1">{t('diff.after')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} className="align-top border-t border-[#2A2F36]">
                <td className="py-1 pr-3 font-mono text-[#94A3B8] whitespace-nowrap">{r.key}</td>
                <td className="py-1 pr-3 font-mono text-[#F87171] break-all">{r.before ?? '—'}</td>
                <td className="py-1 font-mono text-[#34D399] break-all">{r.after ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
