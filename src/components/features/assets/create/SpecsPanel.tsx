import { useTranslation } from 'react-i18next'
import type { AssetSpecs } from '@/domain/asset'
import { SpecCombobox } from '@/components/ui'
import { RamSlots } from './RamSlots'
import { StorageSlots } from './StorageSlots'
import { CPU_SUGGESTIONS, SERVER_CPU_SUGGESTIONS } from './specSuggestions'
import { parseRamValue, parseStorageValue } from './ramStorage'

export interface SpecsPanelProps {
  specs: AssetSpecs
  onChange: (next: AssetSpecs) => void
  isServer: boolean
  /** When false the Видеокарта field is hidden. True only for computers + laptops. */
  hasGpu: boolean
  /** Change this value to force RamSlots and StorageSlots to remount (e.g. on category change). */
  resetKey?: string | number
}

/** Характеристики: Процессор (combobox), Видеокарта (free text), ОЗУ + Накопитель builders. */
export function SpecsPanel({ specs, onChange, isServer, hasGpu, resetKey }: SpecsPanelProps) {
  const { t } = useTranslation('assets')
  const set = (patch: Partial<AssetSpecs>) => onChange({ ...specs, ...patch })

  // B5: slot counts for badges
  const ramSlotCount = parseRamValue(specs.ram || '').slots.length
  const storageSlotCount = parseStorageValue(specs.ssd || '').length

  return (
    <div className="space-y-4">
      {/* B4: section header text-13 */}
      <div className="text-13 font-semibold text-text-tertiary tracking-[0.06em] uppercase">{t('form.specs')}</div>
      <div className="grid grid-cols-[8rem_1fr] max-md:grid-cols-1 gap-x-4 gap-y-5 max-md:gap-y-4 items-start">
        {/* B4: spec row labels text-16; B4: CPU placeholder from t() */}
        <label htmlFor="asset-spec-cpu" className="text-16 font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-13 max-md:font-semibold max-md:text-text-tertiary max-md:tracking-[0.06em] max-md:uppercase max-md:pb-0">{t('form.specCpu')}</label>
        <SpecCombobox
          id="asset-spec-cpu"
          value={specs.cpu || ''}
          onChange={v => set({ cpu: v })}
          suggestions={isServer ? SERVER_CPU_SUGGESTIONS : CPU_SUGGESTIONS}
          placeholder={t('placeholders.cpu')}
        />

        {hasGpu && (
          <label htmlFor="asset-spec-gpu" className="text-16 font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-13 max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase max-md:pb-0">{t('form.specGpu')}</label>
        )}
        {hasGpu && (
          /* Underline style — matches SpecCombobox for visual consistency */
          <div className="flex items-center border-b border-border focus-within:border-accent focus-within:shadow-[0_2px_8px_rgba(217,119,87,0.1)] transition-[border-color,box-shadow] duration-200">
            <input
              id="asset-spec-gpu"
              type="text"
              value={specs.gpu || ''}
              onChange={e => set({ gpu: e.target.value })}
              placeholder={t('placeholders.gpu')}
              className="flex-1 min-w-0 px-0 py-2.5 text-15 bg-transparent text-text-primary outline-none placeholder:text-text-subtle"
            />
          </div>
        )}

        {/* B5: RAM label + count badge when > 1 slot */}
        <span id="asset-spec-ram-label" className="text-16 font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-13 max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase flex flex-wrap items-center gap-1.5">
          {t('form.specRam')}
          {ramSlotCount > 1 && (
            <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-accent text-11 font-semibold tabular-nums">
              {t('form.specRamModule', { count: ramSlotCount })}
            </span>
          )}
        </span>
        <div role="group" aria-labelledby="asset-spec-ram-label">
          <RamSlots key={`ram-${resetKey ?? 0}`} value={specs.ram || ''} onChange={v => set({ ram: v })} isServer={isServer} />
        </div>

        {/* B5: Storage label + count badge when > 1 slot */}
        <span id="asset-spec-ssd-label" className="text-16 font-medium text-text-tertiary pt-2 max-md:pt-0 max-md:text-13 max-md:font-semibold max-md:tracking-[0.06em] max-md:uppercase flex flex-wrap items-center gap-1.5">
          {t('form.specSsd')}
          {storageSlotCount > 1 && (
            <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/30 text-accent text-11 font-semibold tabular-nums">
              {t('form.specSsdDisk', { count: storageSlotCount })}
            </span>
          )}
        </span>
        <div role="group" aria-labelledby="asset-spec-ssd-label">
          <StorageSlots key={`ssd-${resetKey ?? 0}`} value={specs.ssd || ''} onChange={v => set({ ssd: v })} isServer={isServer} />
        </div>
      </div>
    </div>
  )
}
