import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, IconBtn, DataTable, MobileListRow, MobileListPlaceholders } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'

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
  /**
   * Fill contract on BOTH breakpoints: minimum row count. Desktop passes it to
   * DataTable; mobile pads the card list with dashed placeholder slots and
   * stretches rows so the list occupies exactly the ListCard Zone-2 region —
   * same 10-cell look as the assets/employees/licenses etalon lists.
   * Defaults to rows.length (no placeholders).
   */
  minRows?: number
  /**
   * Mobile-only: full 28×28 styled icon tile for each row.
   * When absent a neutral fallback tile with a 'box' icon is rendered.
   */
  mobileIcon?: (row: T) => ReactNode
  /**
   * Mobile-only: custom subline renderer for a row.
   * When provided, it REPLACES the generic restCols-joined subline for that row.
   * The callback owns the entire subline ReactNode (including its wrapper styling).
   * When absent the generic behaviour (join restCols with ' · ' separators) is used.
   */
  mobileSubline?: (row: T) => ReactNode
}

const FALLBACK_TILE = (
  <span
    className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-tertiary"
    aria-hidden="true"
  >
    <Icon name="box" size={14} />
  </span>
)

export function CatalogTable<T extends { id: string }>(props: CatalogTableProps<T>) {
  const {
    rows, columns, canMutate, onEdit, onDelete,
    canDeleteRow, minRows, mobileIcon, mobileSubline,
  } = props
  const { t } = useTranslation('common')
  const editLabel = t('actions.edit', { defaultValue: 'Edit' })
  const deleteLabel = t('actions.delete', { defaultValue: 'Delete' })

  // ── Responsive: shared hook is first-paint-correct and SSR/jsdom safe ────────
  const isMobile = useIsMobile()

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
    // ── Mobile card list via shared MobileListRow trio ───────────────────────
    const [primaryCol, ...restCols] = columns
    return (
      // Fill contract (same as AssetsTable/EmployeesTable mobile): every consumer
      // renders inside a bounded ListCard Zone-2 flex column (catalog routes are
      // in AppShell FLUSH_ROUTES), so rows stretch and placeholder slots pad the
      // list to minRows — 10 identical cells with the pagination pinned below.
      <div className="flex flex-col grow shrink-0">
        {rows.map(row => {
          const canDel = canDeleteRow ? canDeleteRow(row) : true
          const iconTile = mobileIcon ? mobileIcon(row) : FALLBACK_TILE
          const titleNode = (
            <div className="text-[13px] font-bold text-text-primary truncate leading-snug mb-[2px]">
              {primaryCol ? primaryCol.render(row) : null}
            </div>
          )
          // mobileSubline owns the whole subline ReactNode when provided;
          // otherwise fall back to the generic restCols-joined subline.
          const sublineNode: ReactNode | undefined = mobileSubline
            ? mobileSubline(row)
            : restCols.length > 0
              ? (
                <div className="text-[11px] text-text-tertiary truncate leading-snug flex items-center gap-1.5">
                  {restCols.map((c, idx) => (
                    <span key={c.key} className="inline-flex items-center gap-1.5">
                      {idx > 0 && <span aria-hidden="true">·</span>}
                      {c.render(row)}
                    </span>
                  ))}
                </div>
              )
              : undefined
          const rightNode = canMutate ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <IconBtn
                icon="pencil"
                title={editLabel}
                tone="slate"
                onClick={() => onEdit(row)}
                className="max-md:!w-11 max-md:!h-11"
              />
              {canDel && (
                <IconBtn
                  icon="trash-2"
                  title={deleteLabel}
                  tone="rose"
                  onClick={() => onDelete(row)}
                  className="max-md:!w-11 max-md:!h-11"
                />
              )}
            </div>
          ) : undefined
          return (
            <MobileListRow
              key={row.id}
              iconTile={iconTile}
              title={titleNode}
              {...(sublineNode !== undefined ? { subline: sublineNode } : {})}
              {...(rightNode !== undefined ? { right: rightNode } : {})}
              outerStyle={{ flexGrow: 1, flexShrink: 0 }}
            />
          )
        })}
        <MobileListPlaceholders
          count={(minRows ?? rows.length) - rows.length}
          dataTestId="catalog-card-placeholder"
        />
      </div>
    )
  }

  // ── Desktop DataTable — fillHeight: every CatalogTable consumer renders inside
  //    ListCard Zone 2 (bounded flex column), so rows flex-stretch to fill the
  //    card exactly like AssetsTable (58px floor, paginator pinned, no dead band).
  return (
    <DataTable<T>
      columns={dtColumns}
      rows={rows}
      getRowKey={(row) => row.id}
      {...(minRows !== undefined ? { minRows } : {})}
      fillHeight
    />
  )
}
