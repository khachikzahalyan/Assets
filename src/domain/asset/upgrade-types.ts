import type { AssetSpecs } from './types'

export const UPGRADE_COMPONENTS = ['RAM', 'SSD', 'CPU', 'GPU', 'PSU', 'Other'] as const
export type UpgradeComponent = (typeof UPGRADE_COMPONENTS)[number]

export const SPEC_TRACKED = ['CPU', 'RAM', 'SSD', 'GPU'] as const
export type SpecTrackedComponent = (typeof SPEC_TRACKED)[number]

export function isSpecTracked(c: UpgradeComponent): c is SpecTrackedComponent {
  return (SPEC_TRACKED as readonly string[]).includes(c)
}

export const SPEC_KEY: Record<SpecTrackedComponent, keyof AssetSpecs> = {
  CPU: 'cpu',
  RAM: 'ram',
  SSD: 'ssd',
  GPU: 'gpu',
}

export interface UpgradeEvent {
  id: string
  component: UpgradeComponent
  before: string | null
  after: string
  changedAt: string
  changedBy: string
}
