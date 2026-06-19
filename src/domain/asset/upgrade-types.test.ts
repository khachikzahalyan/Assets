import { describe, it, expect } from 'vitest'
import { UPGRADE_COMPONENTS, SPEC_TRACKED, SPEC_KEY, isSpecTracked } from './upgrade-types'
describe('upgrade types', () => {
  it('Monitor is NOT a component', () => { expect(UPGRADE_COMPONENTS as readonly string[]).not.toContain('Monitor') })
  it('SPEC_TRACKED is CPU/RAM/SSD/GPU only', () => { expect([...SPEC_TRACKED].sort()).toEqual(['CPU', 'GPU', 'RAM', 'SSD']) })
  it('isSpecTracked: PSU and Other are not tracked', () => {
    expect(isSpecTracked('RAM')).toBe(true); expect(isSpecTracked('PSU')).toBe(false); expect(isSpecTracked('Other')).toBe(false)
  })
  it('SPEC_KEY maps to AssetSpecs keys', () => { expect(SPEC_KEY.RAM).toBe('ram'); expect(SPEC_KEY.SSD).toBe('ssd') })
})
