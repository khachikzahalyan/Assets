import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui'
import { MiniDropdown } from './MiniDropdown'
import { RAM_SIZES, RAM_TYPES, parseRamValue, serializeRam, type RamSlot } from './ramStorage'

export interface RamSlotsProps {
  value: string
  onChange: (v: string) => void
  /** Servers may flag ECC; non-servers drop it. */
  isServer?: boolean
}

// Desktop: [DDR-type 5rem] [index 1.5rem] [size 1fr] [remove 2rem]
// Mobile: [DDR-type 4rem] [index 1.5rem] [size 1fr] [remove 2rem] — tighter fixed col
const COL_GRID = 'grid grid-cols-[5rem_1.5rem_1fr_2rem] max-md:grid-cols-[4rem_1.5rem_1fr_2rem] gap-x-2 items-center'

/** RAM list builder: one global DDR type + auto-numbered size slots + «Добавить». */
export function RamSlots({ value, onChange, isServer = false }: RamSlotsProps) {
  const initial = parseRamValue(value)
  const [ddrType, setDdrType] = useState(initial.ddrType)
  const [ecc, setEcc] = useState(initial.ecc)
  const [slots, setSlots] = useState<RamSlot[]>(initial.slots)

  const emit = (s: RamSlot[], t: string, e: boolean) => onChange(serializeRam(s, t, e))

  const setType = (t: string) => { const next = ddrType === t ? '' : t; setDdrType(next); emit(slots, next, ecc) }
  const addSlot = () => {
    if (slots.some(s => !s.size)) return
    const next = [...slots, { _id: `r${Math.random().toString(36).slice(2, 7)}`, size: '' }]
    setSlots(next); emit(next, ddrType, ecc)
  }
  const removeSlot = (id: string) => {
    if (slots.length <= 1) return
    const next = slots.filter(s => s._id !== id)
    setSlots(next); emit(next, ddrType, ecc)
  }
  const editSlot = (id: string, size: string) => {
    const next = slots.map(s => s._id === id ? { ...s, size } : s)
    setSlots(next); emit(next, ddrType, ecc)
  }

  // Drop ECC when the asset is no longer a server. Reads the latest slots/ddrType
  // (included in deps) so the emitted value never goes stale.
  useEffect(() => {
    if (!isServer && ecc) { setEcc(false); emit(slots, ddrType, false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServer, ecc, ddrType, slots])

  const sizeOptions = RAM_SIZES.map(s => ({ value: s, label: s }))
  const typeOptions = RAM_TYPES.map(t => ({ value: t, label: t }))
  const hasEmptySlot = slots.some(s => !s.size)

  return (
    <div className="space-y-1.5">
      {slots.map((s, idx) => (
        <div key={s._id} className={`${COL_GRID} anim-fade-slide-in`}>
          {idx === 0 ? (
            <MiniDropdown value={ddrType} onChange={setType} options={typeOptions} placeholder="DDR" ariaLabel="Тип памяти DDR" />
          ) : <div aria-hidden="true" />}
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-2 text-text-tertiary text-[13px] font-semibold ring-1 ring-border" aria-hidden="true">{idx + 1}</span>
          <MiniDropdown value={s.size} onChange={v => editSlot(s._id, v)} options={sizeOptions} placeholder="Размер модуля" ariaLabel={`Размер модуля ${idx + 1}`} />
          <button
            type="button"
            onClick={() => removeSlot(s._id)}
            disabled={slots.length <= 1}
            className="w-8 h-8 inline-flex items-center justify-center text-text-subtle hover:text-rose-300 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Удалить слот ${idx + 1}`}
          ><Icon name="x" size={14} /></button>
        </div>
      ))}
      <button
        type="button"
        onClick={addSlot}
        disabled={hasEmptySlot}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:text-accent-hover hover:bg-[rgba(249,115,22,0.12)] px-2 py-1 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      ><Icon name="plus" size={13} />Добавить</button>
    </div>
  )
}
