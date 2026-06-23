import { useTranslation } from 'react-i18next'
import type { AssetSpecs } from '@/domain/asset'
import { SpecCombobox } from './SpecCombobox'
import { RamSlots } from './RamSlots'
import { StorageSlots } from './StorageSlots'
import { CPU_SUGGESTIONS } from './specSuggestions'
import { parseRamValue, parseStorageValue } from './ramStorage'

/** Russian plural for «модуль»: 1 модуль · 2 модуля · 5 модулей. */
function pluralModule(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'модуль'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'модуля'
  return 'модулей'
}

/** Russian plural for «диск»: 1 диск · 2 диска · 5 дисков. */
function pluralDisk(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'диск'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'диска'
  return 'дисков'
}

export interface SpecsPanelProps {
  specs: AssetSpecs
  onChange: (next: AssetSpecs) => void
  isServer: boolean
}

/** Характеристики: Процессор (combobox), Видеокарта (free text), ОЗУ + Накопитель builders. */
export function SpecsPanel({ specs, onChange, isServer }: SpecsPanelProps) {
  const { t } = useTranslation('assets')
  const set = (patch: Partial<AssetSpecs>) => onChange({ ...specs, ...patch })

  // B5: slot counts for badges
  const ramSlotCount = parseRamValue(specs.ram || '').slots.length
  const storageSlotCount = parseStorageValue(specs.ssd || '').length

  return (
    <div className="space-y-4">
      {/* B4: section header text-[13px] */}
      <div className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase">Характеристики</div>
      <div className="grid grid-cols-[8rem_1fr] max-md:grid-cols-1 gap-x-4 gap-y-5 max-md:gap-y-4 items-start">
        {/* B4: spec row labels text-[16px]; B4: CPU placeholder from t() */}
        <label htmlFor="asset-spec-cpu" className="text-[16px] font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-[13px] max-md:font-semibold max-md:text-text-tertiary max-md:tracking-[0.06em] max-md:uppercase max-md:pb-0">Процессор</label>
        <SpecCombobox
          id="asset-spec-cpu"
          value={specs.cpu || ''}
          onChange={v => set({ cpu: v })}
          suggestions={CPU_SUGGESTIONS}
          placeholder={t('placeholders.cpu')}
        />

        <label htmlFor="asset-spec-gpu" className="text-[16px] font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-[13px] max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase max-md:pb-0">Видеокарта</label>
        {/* Underline style — matches SpecCombobox for visual consistency */}
        <div className="flex items-center border-b border-border focus-within:border-accent focus-within:shadow-[0_2px_8px_rgba(217,119,87,0.1)] transition-[border-color,box-shadow] duration-200">
          <input
            id="asset-spec-gpu"
            type="text"
            value={specs.gpu || ''}
            onChange={e => set({ gpu: e.target.value })}
            placeholder="Встроенная"
            className="flex-1 min-w-0 px-0 py-2.5 text-[15px] bg-transparent text-text-primary outline-none placeholder:text-text-subtle"
          />
        </div>

        {/* B5: RAM label + count badge when > 1 slot */}
        <span id="asset-spec-ram-label" className="text-[16px] font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-[13px] max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase flex items-center gap-1.5">
          ОЗУ
          {ramSlotCount > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[rgba(249,115,22,0.12)] border border-accent/30 text-accent text-[11px] font-semibold tabular-nums">
              {ramSlotCount} {pluralModule(ramSlotCount)}
            </span>
          )}
        </span>
        <div role="group" aria-labelledby="asset-spec-ram-label">
          <RamSlots value={specs.ram || ''} onChange={v => set({ ram: v })} isServer={isServer} />
        </div>

        {/* B5: Storage label + count badge when > 1 slot */}
        <span id="asset-spec-ssd-label" className="text-[16px] font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-[13px] max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase flex items-center gap-1.5">
          Накопитель
          {storageSlotCount > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[rgba(249,115,22,0.12)] border border-accent/30 text-accent text-[11px] font-semibold tabular-nums">
              {storageSlotCount} {pluralDisk(storageSlotCount)}
            </span>
          )}
        </span>
        <div role="group" aria-labelledby="asset-spec-ssd-label">
          <StorageSlots value={specs.ssd || ''} onChange={v => set({ ssd: v })} />
        </div>
      </div>
    </div>
  )
}
