import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { CATEGORY_COLOR } from '@/components/features/assets/categoryColors'
import type { PartsAsset, UpgradeSlot, PartMovement, Part } from '@/domain/part/types'
import {
  installedRowVisual,
  componentRank,
  fmtPartsDate,
  plural,
  PART_CAT_BY_ID,
} from './partsTokens'

/* ── Local helpers (mirrors InstalledDetailPanel logic, mobile-only path) ── */

function kindToCategory(kind: string, storageType?: string | null): string {
  if (kind === 'ram') return 'ram'
  if (kind === 'cooler') return 'cooler'
  if (kind === 'battery') return 'battery'
  if (kind === 'psu') return 'psu'
  if (kind === 'storage') {
    if (!storageType) return 'ssd'
    const t = storageType.toLowerCase()
    if (t === 'hdd') return 'hdd'
    if (t === 'm.2' || t === 'nvme' || t.includes('m.2')) return 'nvme'
    return 'ssd'
  }
  return kind
}

interface NativeRow {
  id: string
  name: string
  category: string
  variantLabel: string | null
  entry: UpgradeSlot
  slotIdx: number
}

function buildNativeRows(asset: PartsAsset): NativeRow[] {
  return asset.upgradeCurrent
    .map((entry, i) => {
      const category = kindToCategory(entry.kind, entry.storageType)
      const specText = entry.spec || (entry.replaced ? 'Заменено' : 'Заводской')
      let badge: string | null = entry.storageType ?? null
      if (!badge) {
        if (entry.spec && entry.replaced) badge = 'Заменено'
        else if (entry.kind === 'battery' && !entry.replaced) badge = 'АКБ'
      }
      return { id: `__native_${entry.kind}_${i}`, name: specText || entry.kind, category, variantLabel: badge, entry, slotIdx: i }
    })
    .sort((a, b) => {
      const r = componentRank(a.category) - componentRank(b.category)
      return r !== 0 ? r : a.slotIdx - b.slotIdx
    })
}

/* ── Component ─────────────────────────────────────────────────────────── */

export interface DeviceDetailMobileViewProps {
  asset: PartsAsset
  onBack: () => void
  onUninstall: (slot: UpgradeSlot, idx: number) => void
  movements: PartMovement[]
  parts: Part[]
}

type InnerTab = 'installed' | 'history'

/**
 * Full-screen slide-in device detail for mobile (≤767px).
 * Replaces the former MobileSheet bottom-sheet in DevicesTab.
 * Desktop is NOT rendered (component is only mounted when isMobile=true in DevicesTab).
 */
export function DeviceDetailMobileView({
  asset, onBack, onUninstall, movements, parts,
}: DeviceDetailMobileViewProps) {
  const { t } = useTranslation('parts')
  const [innerTab, setInnerTab] = useState<InnerTab>('installed')

  const rows = buildNativeRows(asset)
  const n = rows.length
  const componentCountLabel = `${n} ${plural(n, 'компонент', 'компонента', 'компонентов')}`
  const assetHistory = movements.filter(mv => mv.assetId === asset.assetId)
  const sortedHistory = [...assetHistory].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  const catColor = CATEGORY_COLOR[asset.categoryId] ?? null
  const iconName = asset.categoryIcon || 'monitor'
  const skuById = Object.fromEntries(parts.map(p => [p.id, p]))

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-bg"
      style={{ animation: 'slideIn .22s ease' }}
    >
      {/* Back button header */}
      <div className="flex items-center h-11 px-3.5 border-b border-border flex-shrink-0 bg-surface-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-accent text-[13px] font-semibold"
        >
          <Icon name="chevron-left" size={16} />
          {t('tabs.devices', 'Устройства')}
        </button>
      </div>

      {/* Device hero + inner tabs */}
      <div className="flex-shrink-0 bg-surface-2 border-b border-border px-4 pt-3.5 pb-0">
        <div className="flex items-center gap-3 mb-3.5">
          <span
            className="w-11 h-11 rounded-xl inline-flex items-center justify-center flex-shrink-0"
            style={catColor
              ? { backgroundColor: catColor.bg, color: catColor.icon }
              : { backgroundColor: 'rgba(96,165,250,0.12)', color: '#60A5FA' }
            }
          >
            <Icon name={iconName} size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-text-primary leading-tight tracking-[-0.3px]">{asset.name}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[12px] text-text-tertiary font-mono">{asset.id}</span>
              <span className="text-text-subtle text-[12px]">·</span>
              <span className="text-[12px] text-text-subtle">{componentCountLabel}</span>
            </div>
          </div>
        </div>

        {/* Inner tab bar */}
        <div className="flex">
          {([
            { id: 'installed' as InnerTab, label: t('device.tabInstalled', 'Установлено'), count: n },
            { id: 'history' as InnerTab, label: t('device.tabHistory', 'История'), count: assetHistory.length },
          ]).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setInnerTab(tab.id)}
              className={`relative flex items-center gap-1.5 pb-2 mr-4 text-[13px] font-semibold transition-colors
                ${innerTab === tab.id ? 'text-text-primary' : 'text-text-subtle'}`}
            >
              {tab.label}
              <span className={`px-1.5 rounded text-[10px] font-bold tabular-nums
                ${innerTab === tab.id ? 'bg-accent text-white' : 'bg-surface text-text-subtle'}`}>
                {tab.count}
              </span>
              {innerTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-[68px]">
        {innerTab === 'installed' ? (
          rows.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-[14px] text-text-tertiary text-center">
              {t('device.noPartsTitle')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map(row => {
                const { icon: catIcon, tint } = installedRowVisual(row.category)
                const catLabel = PART_CAT_BY_ID[row.category]?.label ?? row.category
                return (
                  <li key={row.id} className="flex items-center gap-3 px-3.5 py-3.5">
                    <span className={`w-[34px] h-[34px] rounded-[9px] ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
                      <Icon name={catIcon} size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-text-primary leading-tight">
                        {row.name}{row.variantLabel ? ` · ${row.variantLabel}` : ''}
                      </div>
                      <div className="text-[11.5px] text-text-secondary mt-0.5">{catLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUninstall(row.entry, row.slotIdx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-text-tertiary text-[11px] font-semibold flex-shrink-0"
                    >
                      <Icon name="settings" size={10} />
                      {t('device.nativeLabel', 'Конфиг.')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          sortedHistory.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-[14px] text-text-tertiary text-center">
              {t('device.historyEmpty')}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sortedHistory.map((mv, i) => {
                const rowSku = skuById[mv.skuId] ?? null
                const skuLabel = rowSku
                  ? rowSku.name + (rowSku.variantLabel ? ' ' + rowSku.variantLabel : '')
                  : mv.skuId || '—'
                const catLabel = rowSku ? (PART_CAT_BY_ID[rowSku.category]?.label ?? '') : ''
                const rowVisual = rowSku ? installedRowVisual(rowSku.category) : null
                const dotColor =
                  mv.type === 'receive' ? 'bg-emerald-500'
                  : mv.type === 'install' ? 'bg-violet-500'
                  : mv.type === 'uninstall' ? 'bg-blue-500'
                  : 'bg-slate-500'
                return (
                  <li key={mv.id || i} className="flex items-center gap-3 px-3.5 py-3">
                    <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${dotColor}`} />
                    <span className={`w-[34px] h-[34px] rounded-[9px] flex-shrink-0 inline-flex items-center justify-center
                      ${rowVisual ? `${rowVisual.tint.iconBg} ${rowVisual.tint.iconText}` : 'bg-surface-2 text-text-tertiary'}`}>
                      <Icon name={rowVisual?.icon ?? 'package'} size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-text-primary truncate">{skuLabel}</div>
                      {catLabel && <div className="text-[11.5px] text-text-secondary mt-0.5">{catLabel}</div>}
                    </div>
                    <span className="text-[10.5px] font-mono text-text-subtle flex-shrink-0">{fmtPartsDate(mv.at)}</span>
                  </li>
                )
              })}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
