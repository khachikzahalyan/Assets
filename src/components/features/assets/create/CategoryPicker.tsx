import { useTranslation } from 'react-i18next'
import { Select } from '@/components/ui'
import type { CategoryRow } from '@/domain/asset'

export interface CategoryCapabilities {
  hasBrandModel: boolean
  hasTypeField: boolean
  requiresSerial: boolean
  hasSpecs: boolean
}

/** Derives form capability flags from a category row. */
export function categoryCapabilities(cat: CategoryRow): CategoryCapabilities {
  const hasBrandModel = cat.group !== 'furniture'
  const hasTypeField = cat.group === 'furniture'
  const requiresSerial = cat.group !== 'furniture'
  const hasSpecs =
    cat.group !== 'furniture' &&
    /laptop|desktop|computer|server|пк|ноут|сервер/i.test(cat.name)
  return { hasBrandModel, hasTypeField, requiresSerial, hasSpecs }
}

export interface CategoryPickerProps {
  categories: CategoryRow[]
  value: string
  onChange: (categoryId: string) => void
}

/** Groups categories by their `group` and renders them as a flat Select with group prefix labels. */
export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  const { t } = useTranslation('assets')

  // Build options with group prefix label for visual grouping
  const groups: Array<'devices' | 'network' | 'furniture'> = ['devices', 'network', 'furniture']
  const groupLabels: Record<string, string> = {
    devices: t('groups.devices'),
    network: t('groups.network'),
    furniture: t('groups.furniture'),
  }

  const options = groups.flatMap(g => {
    const cats = categories.filter(c => c.group === g)
    if (cats.length === 0) return []
    return cats.map(c => ({
      value: c.id,
      label: `${groupLabels[g] ?? g} — ${c.name}`,
    }))
  })

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t('placeholders.category')}
    />
  )
}
