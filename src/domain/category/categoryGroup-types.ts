/**
 * Capability behavior class shared by a CategoryGroup and the categories beneath it.
 * This is the (renamed) original `CategoryGroup` enum — the literal that drives the
 * pure capability engine in `categoryCapabilities.ts`. It is NOT the parent record.
 */
export const CATEGORY_GROUP_BEHAVIORS = ['devices', 'network', 'furniture'] as const
export type CategoryGroupBehavior = (typeof CATEGORY_GROUP_BEHAVIORS)[number]

export function isCategoryGroupBehavior(v: string): v is CategoryGroupBehavior {
  return (CATEGORY_GROUP_BEHAVIORS as readonly string[]).includes(v)
}

/**
 * First-class parent record of the two-level taxonomy: Категория (this) →
 * Подкатегория (the existing `Category`). A group carries the inherited capability
 * `behavior` plus display metadata. Seed group ids equal the behavior literal
 * (`devices` / `network` / `furniture`) so existing asset data needs no migration.
 */
export interface CategoryGroup {
  id: string
  name: string
  /** Capability class inherited by child categories; default `'devices'` for new groups. */
  behavior: CategoryGroupBehavior
  lucideIcon: string
  /** Token name, e.g. `'blue' | 'green' | 'amber' | 'gray'`. */
  color: string
  order: number
  createdAt: string
  updatedAt: string
}
