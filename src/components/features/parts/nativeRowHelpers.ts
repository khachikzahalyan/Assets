import type { UpgradeSlot } from '@/domain/part/types'

export function kindToCategory(kind: string, storageType?: string | null): string {
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

export const KIND_LABEL: Record<string, string> = {
  ram: 'ОЗУ', cooler: 'Кулер', battery: 'Аккумулятор', storage: 'Накопитель', psu: 'Блок питания',
}

export interface NativeRowCore {
  category: string
  specText: string
  variantLabel: string | null
  state: 'factory' | 'replaced' | null
  nameForDeviceMobile: string
  nameForPanel: string
}

export function computeNativeRowCore(entry: UpgradeSlot, _idx: number): NativeRowCore {
  const category = kindToCategory(entry.kind, entry.storageType)
  const specText = entry.spec || (entry.replaced ? 'Заменено' : 'Заводской')
  let variantLabel: string | null = entry.storageType ?? null
  if (!variantLabel && entry.spec && entry.replaced) variantLabel = 'Заменено'
  const state: 'factory' | 'replaced' | null = entry.spec ? null : (entry.replaced ? 'replaced' : 'factory')
  const nameForDeviceMobile = specText || entry.kind
  const nameForPanel = specText || KIND_LABEL[entry.kind] || entry.kind
  return { category, specText, variantLabel, state, nameForDeviceMobile, nameForPanel }
}
