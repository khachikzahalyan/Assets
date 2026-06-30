import { describe, it, expect } from 'vitest'
import { CATEGORY_GROUP_BEHAVIORS, isCategoryGroupBehavior } from './categoryGroup-types'

describe('CategoryGroupBehavior', () => {
  it('lists the three behavior classes', () => {
    expect(CATEGORY_GROUP_BEHAVIORS).toEqual(['devices', 'network', 'furniture'])
  })
  it('guards behavior strings', () => {
    expect(isCategoryGroupBehavior('devices')).toBe(true)
    expect(isCategoryGroupBehavior('samokat')).toBe(false)
  })
})
