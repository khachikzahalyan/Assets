import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBtn } from '@/components/ui'

export interface CatalogColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export interface CatalogTableProps<T extends { id: string }> {
  rows: T[]
  columns: CatalogColumn<T>[]
  canMutate: boolean
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** Optional: hide delete for a given row (e.g. system statuses). */
  canDeleteRow?: (row: T) => boolean
}

export function CatalogTable<T extends { id: string }>(props: CatalogTableProps<T>) {
  const { rows, columns, canMutate, onEdit, onDelete, canDeleteRow } = props
  const { t } = useTranslation('common')
  const editLabel = t('actions.edit', { defaultValue: 'Edit' })
  const deleteLabel = t('actions.delete', { defaultValue: 'Delete' })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-[#64748B] border-b border-[#2A2F36]">
            {columns.map(c => <th key={c.key} className={`py-2 pr-4 font-medium ${c.className ?? ''}`}>{c.header}</th>)}
            {canMutate && <th className="py-2 w-[80px]" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-[#1F242B] hover:bg-[#161A20]">
              {columns.map(c => <td key={c.key} className={`py-2.5 pr-4 ${c.className ?? ''}`}>{c.render(row)}</td>)}
              {canMutate && (
                <td className="py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <IconBtn icon="pencil" title={editLabel} tone="slate" onClick={() => onEdit(row)} />
                    {(canDeleteRow ? canDeleteRow(row) : true) && (
                      <IconBtn icon="trash-2" title={deleteLabel} tone="rose" onClick={() => onDelete(row)} />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
