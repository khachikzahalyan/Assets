import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { CATEGORY_COLOR } from '@/components/features/assets/categoryColors'
import type { PartsAsset, UpgradeSlot, PartMovement, Part } from '@/domain/part/types'
import {
  installedRowVisual,
  componentRank,
  fmtPartsDate,
  plural,
  PART_CAT_BY_ID,
} from './partsTokens'

/* ── helpers ─────────────────────────────────────────────────────────────── */

/**
 * Resolve an upgradeCurrent entry's kind + storageType to a partsTokens category key.
 * Mirrors prototype _kindToCategory (parts.html ~2776).
 */
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

/** KIND_LABEL fallback for slot with no spec text. */
const KIND_LABEL: Record<string, string> = {
  ram: 'ОЗУ', cooler: 'Кулер', battery: 'Аккумулятор', storage: 'Накопитель', psu: 'Блок питания',
}

interface NativeRow {
  sku: {
    id: string
    name: string
    category: string
    variantLabel: string | null
  }
  qty: number
  native: true
  entry: UpgradeSlot
}

function makeNativeRow(entry: UpgradeSlot, idx: number): NativeRow {
  const category = kindToCategory(entry.kind, entry.storageType)
  const specText = entry.spec || (entry.replaced ? 'Заменено' : 'Заводской')
  let badge: string | null = entry.storageType ?? null
  if (!badge) {
    if (entry.spec && entry.replaced) badge = 'Заменено'
    else if (entry.kind === 'battery' && !entry.replaced) badge = 'АКБ'
    else badge = null
  }
  return {
    sku: {
      id: `__native_${entry.kind}_${idx}`,
      name: specText || KIND_LABEL[entry.kind] || entry.kind,
      category,
      variantLabel: badge ?? null,
    },
    qty: 1,
    native: true,
    entry,
  }
}

function sortNativeRows(rows: NativeRow[]): NativeRow[] {
  return rows
    .map((r, i) => [r, i] as [NativeRow, number])
    .sort((a, b) => (componentRank(a[0].sku.category) - componentRank(b[0].sku.category)) || (a[1] - b[1]))
    .map(pair => pair[0])
}

/* ── History row helpers — mirrors prototype histDisplayType (parts.html ~4342-4368) ── */

type HistoryDisplayType = 'receive' | 'install' | 'uninstall' | 'move' | 'service' | 'unknown'

function histDisplayType(mv: PartMovement): HistoryDisplayType {
  if (mv.type === 'receive') return 'receive'
  if (mv.type === 'install') return 'install'
  if (mv.type === 'uninstall') return 'uninstall'
  if (mv.type === 'service') return 'service'
  if ((mv as any).displayType === 'move') return 'move'
  return 'unknown'
}

/* ── Component ─────────────────────────────────────────────────────────── */

export interface InstalledDetailPanelProps {
  asset: PartsAsset | null
  onUninstall: (slot: UpgradeSlot, idx: number) => void
  /** Optional: per-device movement history for the «История» inner tab */
  movements?: PartMovement[]
  /** All parts SKUs — for resolving skuId → name in history rows */
  parts?: Part[]
}

type InnerTab = 'installed' | 'history'

/**
 * Right-side panel in the Devices tab.
 * Shows device header + inner tabs «Установлено» / «История».
 * Layout mirrors prototype parts.html lines 4170-4403.
 */
export function InstalledDetailPanel({ asset, onUninstall, movements = [], parts = [] }: InstalledDetailPanelProps) {
  const { t } = useTranslation('parts')
  const [innerTab, setInnerTab] = useState<InnerTab>('installed')

  /* ── No selection placeholder ── */
  if (!asset) {
    return (
      <div className="h-full bg-surface border border-border rounded-xl shadow-sm shadow-black/30 flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
            <Icon name="monitor" size={20} />
          </span>
          <div className="text-[15.5px] font-semibold text-text-secondary">{t('device.selectPrompt')}</div>
          <div className="text-[14px] text-text-tertiary mt-1">{t('device.selectHint')}</div>
        </div>
      </div>
    )
  }

  /* ── Build installed rows from upgradeCurrent (native rows) ── */
  const nativeRows = sortNativeRows(
    asset.upgradeCurrent.map((entry, i) => makeNativeRow(entry, i))
  )

  /* Component count with Russian plural */
  const n = nativeRows.length
  const componentCountLabel = n === 0
    ? t('device.noComponents', 'Нет компонентов')
    : `${n} ${plural(n, 'компонент', 'компонента', 'компонентов')}`

  /* History for this asset (filter by assetId) */
  const assetHistory = movements.filter(
    mv => mv.assetId === asset.assetId || mv.assetId === asset.id
  )

  return (
    <div className="h-full bg-surface border border-border rounded-xl shadow-sm shadow-black/30 flex flex-col overflow-hidden">
      {/* ── Device header ── */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-10 h-10 rounded-xl inline-flex items-center justify-center flex-shrink-0"
            style={
              CATEGORY_COLOR[asset.categoryId]
                ? { backgroundColor: CATEGORY_COLOR[asset.categoryId]!.bg, color: CATEGORY_COLOR[asset.categoryId]!.icon }
                : { backgroundColor: 'rgba(249,115,22,0.10)', color: '#F97316' }
            }
          >
            <Icon name={asset.categoryIcon || 'monitor'} size={18} />
          </span>
          <div className="min-w-0">
            <div className="text-[18px] font-bold text-text-primary truncate leading-tight">{asset.name}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-mono text-[13.5px] text-text-tertiary">{asset.id}</span>
              <span className="text-[13.5px] text-text-subtle">{componentCountLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inner tab bar ── */}
      <div className="flex items-center gap-0 px-5 border-b border-border flex-shrink-0 bg-bg">
        <button
          type="button"
          onClick={() => setInnerTab('installed')}
          className={`h-10 px-4 text-[14.5px] transition-colors cursor-pointer border-b-2 ${
            innerTab === 'installed'
              ? 'text-accent border-accent font-semibold'
              : 'text-text-tertiary border-transparent hover:text-text-primary hover:border-[#3A3F46]'
          }`}
        >
          {t('device.tabInstalled', 'Установлено')}
          <span
            className={`ml-1.5 px-1.5 rounded text-[12.5px] tabular-nums ${
              innerTab === 'installed'
                ? 'bg-[#F97316]/15 text-accent'
                : 'bg-surface-2 text-text-subtle'
            }`}
          >
            {nativeRows.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setInnerTab('history')}
          className={`h-10 px-4 text-[14.5px] transition-colors cursor-pointer border-b-2 ${
            innerTab === 'history'
              ? 'text-accent border-accent font-semibold'
              : 'text-text-tertiary border-transparent hover:text-text-primary hover:border-[#3A3F46]'
          }`}
        >
          {t('device.tabHistory', 'История')}
          <span
            className={`ml-1.5 px-1.5 rounded text-[12.5px] tabular-nums ${
              innerTab === 'history'
                ? 'bg-[#F97316]/15 text-accent'
                : 'bg-surface-2 text-text-subtle'
            }`}
          >
            {assetHistory.length}
          </span>
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {innerTab === 'installed' ? (
          <InstalledBody rows={nativeRows} onUninstall={onUninstall} t={t} />
        ) : (
          <HistoryBody movements={assetHistory} parts={parts} t={t} />
        )}
      </div>
    </div>
  )
}

/* ── InstalledBody (inner «Установлено» content) ──────────────────────── */

interface InstalledBodyProps {
  rows: NativeRow[]
  onUninstall: (slot: UpgradeSlot, idx: number) => void
  t: ReturnType<typeof useTranslation<'parts'>>['t']
}

function InstalledBody({ rows, onUninstall, t }: InstalledBodyProps) {
  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-xs">
          <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
            <Icon name="package" size={20} />
          </span>
          <div className="text-[15px] font-semibold text-text-secondary">{t('device.noPartsTitle')}</div>
          <div className="text-[14px] text-text-tertiary mt-1">{t('device.noPartsDesc')}</div>
        </div>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((row, listIdx) => {
        const { icon: catIcon, tint } = installedRowVisual(row.sku.category)
        const catLabel = PART_CAT_BY_ID[row.sku.category]?.label ?? row.sku.category

        /* Find real index in asset.upgradeCurrent.
           The row.sku.id encodes the original index as `__native_<kind>_<idx>` */
        const rawIdx = parseInt(row.sku.id.split('_').pop() ?? '0', 10)
        const slotIdx = Number.isNaN(rawIdx) ? listIdx : rawIdx

        return (
          <li
            key={row.sku.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[#111315]/60 transition-colors group"
          >
            <span
              className={`w-9 h-9 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}
            >
              <Icon name={catIcon} size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate text-text-primary">
                {row.sku.name}
                {row.sku.variantLabel && (
                  <>
                    {' · '}
                    <span className={row.entry.replaced ? 'text-amber-300' : undefined}>
                      {row.sku.variantLabel}
                    </span>
                  </>
                )}
              </div>
              <div className="text-[13px] text-text-subtle mt-0.5">{catLabel}</div>
            </div>
            {row.native ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12.5px] font-medium text-text-tertiary border border-border bg-surface-2 flex-shrink-0">
                <Icon name="settings" size={10} />
                {t('device.nativeLabel', 'Конфиг.')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onUninstall(row.entry, slotIdx)}
                title={t('actions.uninstall')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[13.5px] font-semibold text-sky-300 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15 transition-colors flex-shrink-0"
              >
                <Icon name="rotate-ccw" size={11} />
                {t('device.uninstallBtn', 'Снять')}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ── HistoryBody (inner «История» content — simplified chronological list) */

interface HistoryBodyProps {
  movements: PartMovement[]
  parts: Part[]
  t: ReturnType<typeof useTranslation<'parts'>>['t']
}

function HistoryBody({ movements, parts, t }: HistoryBodyProps) {
  if (movements.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-[14px] text-text-tertiary text-center">
          {t('device.historyEmpty', 'На этом устройстве пока нет истории')}
        </div>
      </div>
    )
  }

  /* Build skuById for label resolution — mirrors prototype line 3344 */
  const skuById: Record<string, Part> = Object.fromEntries(parts.map(p => [p.id, p]))

  /* Chronological: newest first */
  const sorted = [...movements].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  return (
    <ul className="divide-y divide-border">
      {sorted.map((mv, i) => {
        const dt = histDisplayType(mv)
        const isBroken = !!(mv as any).broken
        const isFactory = !!(mv as any).factory && dt === 'install'
        const isServiceReplace = !!(mv as any).serviceReplace && (dt === 'install' || dt === 'uninstall')

        /* Dot colour — mirrors prototype lines 4351-4357 */
        const dotColor =
          dt === 'receive'                     ? 'bg-emerald-500'
          : (dt === 'install' && isFactory)    ? 'bg-emerald-500'
          : dt === 'install'                   ? 'bg-violet-500'
          : dt === 'uninstall'                 ? 'bg-blue-500'
          : dt === 'move'                      ? 'bg-amber-500'
          : dt === 'service'                   ? 'bg-cyan-500'
          : 'bg-slate-500'

        /* Action chip — mirrors prototype lines 4358-4368 */
        const actionChip = (() => {
          if (isBroken)
            return <Chip color="red" size="sm"><Icon name="x-circle" size={11} />{t('journal.scrapped')}</Chip>
          if (isServiceReplace)
            return <Chip color="orange" size="sm"><Icon name="wrench" size={11} />{t('journal.serviceReplace')}</Chip>
          if (isFactory && dt === 'install')
            return <Chip color="green" size="sm"><Icon name="package" size={11} />{t('journal.factory')}</Chip>
          if (dt === 'receive')
            return <Chip color="green" size="sm"><Icon name="inbox" size={11} />+{mv.qty}</Chip>
          if (dt === 'install')
            return <Chip color="violet" size="sm"><Icon name="wrench" size={11} />{t('journal.installed')}</Chip>
          if (dt === 'uninstall')
            return <Chip color="blue" size="sm"><Icon name="rotate-ccw" size={11} />{t('journal.uninstalled')}</Chip>
          if (dt === 'move')
            return <Chip color="amber" size="sm"><Icon name="arrow-left-right" size={11} />{t('journal.move')}</Chip>
          if (dt === 'service')
            return <Chip color="cyan" size="sm"><Icon name="clipboard-list" size={11} />{(mv as any).kindLabel ?? t('device.service')}</Chip>
          return null
        })()

        /* SKU label — resolves from parts array; service rows get note text */
        const rowSku = skuById[mv.skuId] ?? null
        const skuLabel =
          dt === 'service'
            ? ((mv as any).note ?? (mv as any).kindLabel ?? t('device.service'))
            : rowSku
              ? ((rowSku.name || '') + (rowSku.variantLabel ? ' ' + rowSku.variantLabel : ''))
              : (mv.skuId || '—')

        /* Category icon plaque — sized to match the «Установлено» rows
           (coloured w-9 h-9 plaque via installedRowVisual). */
        const rowVisual = rowSku ? installedRowVisual(rowSku.category) : null
        const catLabel = rowSku ? (PART_CAT_BY_ID[rowSku.category]?.label ?? '') : ''

        return (
          <li
            key={mv.id || i}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[#111315]/60 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
            <span
              className={`w-9 h-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${
                rowVisual ? `${rowVisual.tint.iconBg} ${rowVisual.tint.iconText}` : 'bg-surface-2 text-text-tertiary'
              }`}
            >
              <Icon name={rowVisual?.icon ?? 'package'} size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold truncate text-text-primary">{skuLabel}</div>
              {catLabel && <div className="text-[13px] text-text-subtle mt-0.5">{catLabel}</div>}
            </div>
            <div className="flex-shrink-0">{actionChip}</div>
            <div className="text-[13px] font-medium text-text-tertiary tabular-nums whitespace-nowrap flex-shrink-0">
              {fmtPartsDate(mv.at)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
