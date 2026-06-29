import type { ReactNode } from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBtn, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'

export interface CatalogColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
  /** CSS grid track width for the DataTable desktop view. Defaults to '1fr'. */
  width?: string
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

  // ── Responsive: matchMedia so the layout is correct on first paint ───────────
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Desktop DataTable columns ────────────────────────────────────────────────
  const dtColumns = useMemo<DataTableColumn<T>[]>(() => {
    const cols: DataTableColumn<T>[] = columns.map(c => ({
      key: c.key,
      header: c.header,
      width: c.width ?? '1fr',
      cell: c.render,
      ...(c.className ? { headerClassName: c.className, cellClassName: c.className } : {}),
    }))
    if (canMutate) {
      cols.push({
        key: '__actions',
        header: '',
        width: '80px',
        align: 'right',
        cell: (row) => (
          <div className="flex items-center gap-1 justify-end">
            <IconBtn icon="pencil" title={editLabel} tone="slate" onClick={() => onEdit(row)} />
            {(canDeleteRow ? canDeleteRow(row) : true) && (
              <IconBtn icon="trash-2" title={deleteLabel} tone="rose" onClick={() => onDelete(row)} />
            )}
          </div>
        ),
      })
    }
    return cols
  }, [columns, canMutate, canDeleteRow, onEdit, onDelete, editLabel, deleteLabel])

  if (isMobile) {
    // ── Mobile card list ────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col divide-y divide-[#1F242B]">
        {rows.map(row => {
          const [primaryCol, ...restCols] = columns
          const canDel = canDeleteRow ? canDeleteRow(row) : true
          return (
            <div key={row.id} className="flex items-start justify-between gap-3 py-3 px-1">
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                {/* Primary field (first column) */}
                <div className="text-[14px] font-medium text-text-primary">
                  {primaryCol ? primaryCol.render(row) : null}
                </div>
                {/* Secondary fields (remaining columns) */}
                {restCols.map(c => (
                  <div key={c.key} className="text-[12px] text-text-tertiary flex items-center gap-1.5">
                    <span className="text-[11px] text-text-subtle">{c.header}:</span>
                    {c.render(row)}
                  </div>
                ))}
              </div>

              {/* Actions */}
              {canMutate && (
                <div className="flex items-center gap-1 flex-shrink-0 self-center">
                  <button
                    type="button"
                    aria-label={editLabel}
                    onClick={() => onEdit(row)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-subtle hover:text-text-primary hover:bg-surface-2 transition-colors"
                  >
                    <IconBtn icon="pencil" title={editLabel} tone="slate" onClick={() => onEdit(row)} />
                  </button>
                  {canDel && (
                    <button
                      type="button"
                      aria-label={deleteLabel}
                      onClick={() => onDelete(row)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-subtle hover:text-rose-400 hover:bg-surface-2 transition-colors"
                    >
                      <IconBtn icon="trash-2" title={deleteLabel} tone="rose" onClick={() => onDelete(row)} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Desktop DataTable ───────────────────────────────────────────────────────
  return (
    <DataTable<T>
      columns={dtColumns}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  )
}
