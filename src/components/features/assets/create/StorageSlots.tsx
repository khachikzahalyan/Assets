import { useState } from 'react'
import { Icon } from '@/components/ui'
import { MiniDropdown } from './MiniDropdown'
import { STORAGE_SIZES, STORAGE_TYPES, parseStorageValue, serializeStorage, type StorageRow } from './ramStorage'

export interface StorageSlotsProps {
  value: string
  onChange: (v: string) => void
}

/** Storage list builder: [type] + [size] rows + «Добавить». Serializes "SSD 256 ГБ + HDD 1 ТБ". */
export function StorageSlots({ value, onChange }: StorageSlotsProps) {
  const [rows, setRows] = useState<StorageRow[]>(() => parseStorageValue(value))

  const update = (next: StorageRow[]) => { setRows(next); onChange(serializeStorage(next)) }
  const addRow = () => {
    if (rows.some(r => !r.size)) return
    update([...rows, { _id: `r${Math.random().toString(36).slice(2, 7)}`, type: 'SSD', size: '256 ГБ' }])
  }
  const removeRow = (id: string) => update(rows.filter(r => r._id !== id))
  const editRow = (id: string, patch: Partial<StorageRow>) => update(rows.map(r => r._id === id ? { ...r, ...patch } : r))

  const typeOptions = STORAGE_TYPES.map(t => ({ value: t, label: t }))
  const sizeOptions = STORAGE_SIZES.map(s => ({ value: s, label: s }))
  const hasEmptyRow = rows.some(r => !r.size)

  return (
    <div className="space-y-2">
      {rows.length === 0 && <div className="text-[14px] text-text-subtle italic py-1">Накопители не добавлены</div>}
      {rows.map((r, idx) => (
        <div key={r._id} className="grid grid-cols-[5rem_1.5rem_1fr_2rem] max-md:grid-cols-[5.25rem_1.5rem_1fr_2rem] gap-x-2 items-center anim-fade-slide-in">
          <MiniDropdown value={r.type} onChange={v => editRow(r._id, { type: v })} options={typeOptions} placeholder="Тип" ariaLabel={`Тип накопителя ${idx + 1}`} />
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-2 text-text-tertiary text-[13px] font-semibold ring-1 ring-border" aria-hidden="true">{idx + 1}</span>
          <MiniDropdown value={r.size} onChange={v => editRow(r._id, { size: v })} options={sizeOptions} placeholder="Размер" ariaLabel={`Размер накопителя ${idx + 1}`} />
          <button
            type="button"
            onClick={() => removeRow(r._id)}
            disabled={rows.length <= 1}
            className="w-8 h-8 inline-flex items-center justify-center text-text-subtle hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Удалить накопитель ${idx + 1}`}
          ><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        disabled={hasEmptyRow}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:text-accent-hover hover:bg-[rgba(249,115,22,0.12)] px-2 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      ><Icon name="plus" size={13} />Добавить</button>
    </div>
  )
}
