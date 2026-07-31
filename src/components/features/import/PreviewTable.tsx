import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/ui'
import type { EmployeePlanRow, AssetPlanRow, RowIssue } from '@/lib/importXlsx'

interface PreviewTableProps {
  sheet: 'employees' | 'assets'
  rows: EmployeePlanRow[] | AssetPlanRow[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderIssues(issues: RowIssue[], t: (key: string, opts?: any) => string): string[] {
  return issues.map(i => {
    // Keys from validate.ts arrive as e.g. 'errors.firstNameRequired' or 'warnings.commentDropped'
    // Strip the prefix since we look them up relative to the import namespace root.
    const key = i.key
    const result = t(key, i.params ?? {})
    // If the key resolved to itself (missing), return the raw key as fallback
    if (result === key) return key
    return result
  })
}

export function PreviewTable({ sheet, rows }: PreviewTableProps) {
  const { t } = useTranslation('import')

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-13.5 text-text-tertiary">
        {t('preview.noRows')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-13 border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 text-text-tertiary font-medium w-12">{t('preview.cols.row')}</th>
            {sheet === 'employees' ? (
              <>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.nameLastName')}</th>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.email')}</th>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.department')}</th>
              </>
            ) : (
              <>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.category')}</th>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.brandModel')}</th>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.invCode')}</th>
                <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.branch')}</th>
              </>
            )}
            <th className="text-left py-2 px-3 text-text-tertiary font-medium">{t('preview.cols.status')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isError = row.status === 'error'
            const allIssues = [...(row.errors ?? []), ...(row.warnings ?? [])]
            const issueTexts = renderIssues(allIssues, t)

            return (
              <tr
                key={row.rowNumber}
                className={`border-b border-border/50 ${isError ? 'bg-rose-950/10 light:bg-rose-50' : 'bg-emerald-950/5 light:bg-emerald-50/50'}`}
              >
                <td className="py-2 px-3 tabular-nums text-text-subtle">{row.rowNumber}</td>
                {sheet === 'employees' ? (
                  <>
                    <td className="py-2 px-3 text-text-primary">
                      {(row as EmployeePlanRow).input
                        ? `${(row as EmployeePlanRow).input!.firstName} ${(row as EmployeePlanRow).input!.lastName}`
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-text-secondary font-mono text-12">
                      {(row as EmployeePlanRow).input?.email ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-text-secondary">
                      {(row as EmployeePlanRow).input?.departmentId ?? '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 text-text-primary">
                      {(row as AssetPlanRow).input?.categoryId ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-text-secondary">
                      {(row as AssetPlanRow).input
                        ? `${(row as AssetPlanRow).input!.brand ?? ''} ${(row as AssetPlanRow).input!.model ?? ''}`.trim() || '—'
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-text-secondary font-mono text-12">
                      {(row as AssetPlanRow).invCode ? (
                        <span className="inline-flex items-center gap-1">
                          {(row as AssetPlanRow).invCode}
                          {(row as AssetPlanRow).invCodeGenerated && (
                            <Chip color="blue" size="sm">{t('preview.autoChip')}</Chip>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3 text-text-secondary">
                      {(row as AssetPlanRow).input?.branchId ?? '—'}
                    </td>
                  </>
                )}
                <td className="py-2 px-3">
                  {isError ? (
                    <div className="space-y-0.5">
                      {issueTexts.map((msg, i) => (
                        <div key={i} className="text-rose-400 light:text-rose-700 text-12">{msg}</div>
                      ))}
                    </div>
                  ) : (
                    <Chip color={row.warnings.length > 0 ? 'amber' : 'green'} size="sm">
                      {row.warnings.length > 0 ? '⚠ OK' : '✓ OK'}
                    </Chip>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
