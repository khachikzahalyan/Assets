import { describe, it, expect } from 'vitest'
import type { CategoryRow } from './types'
import { resolveCategoryCapabilities, deriveCategoryFlags } from './categoryCapabilities'

/** Minimal CategoryRow factory — only the fields the resolver reads. */
function row(over: Partial<CategoryRow> & Pick<CategoryRow, 'id' | 'group' | 'name'>): CategoryRow {
  return {
    lucideIcon: 'box',
    ...over,
  } as CategoryRow
}

describe('resolveCategoryCapabilities — taxonomy table', () => {
  it('cat_computer → specs + OEM + serial, brand/model, no type field', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_computer', group: 'devices', name: 'Компьютер' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(true)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.hasBrandModel).toBe(true)
    expect(caps.hasTypeField).toBe(false)
  })

  it('cat_macbook_pro → specs yes, OEM license NO, serial yes', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_macbook_pro', group: 'devices', name: 'MacBook Pro' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.isLaptop).toBe(true)
  })

  it('cat_monitor → no specs, no OEM, serial yes, no type field', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_monitor', group: 'devices', name: 'Монитор' }))
    expect(caps.hasSpecs).toBe(false)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.hasTypeField).toBe(false)
  })

  it('cat_server → specs + OEM + serial, isServer, hasBrandModel, no type field', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_server', group: 'network', name: 'Сервер' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(true)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.isServer).toBe(true)
    expect(caps.hasBrandModel).toBe(true)
    expect(caps.hasTypeField).toBe(false)
  })

  it('cat_laptop → specs + OEM + serial, isLaptop (non-Apple so OEM yes)', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_laptop', group: 'devices', name: 'Ноутбук' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(true)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.isLaptop).toBe(true)
    expect(caps.isServer).toBe(false)
  })

  it('cat_macbook_air → specs yes, OEM NO (Apple laptop family), isLaptop', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_macbook_air', group: 'devices', name: 'MacBook Air' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.requiresSerial).toBe(true)
    expect(caps.isLaptop).toBe(true)
  })

  it('cat_router → non-server network: serial yes, no specs, no OEM, isNetwork yes', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_router', group: 'network', name: 'Роутер' }))
    expect(caps.requiresSerial).toBe(true)
    expect(caps.hasSpecs).toBe(false)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.isNetwork).toBe(true)
    expect(caps.isServer).toBe(false)
    expect(caps.hasTypeField).toBe(false)
  })

  it('furniture (cat_desk) → type field, no serial / specs / OEM, no brand/model', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_desk', group: 'furniture', name: 'Стол офисный' }))
    expect(caps.hasTypeField).toBe(true)
    expect(caps.requiresSerial).toBe(false)
    expect(caps.hasSpecs).toBe(false)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.hasBrandModel).toBe(false)
  })

  it('furniture (cat_chair) → type field, no serial', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_chair', group: 'furniture', name: 'Стул' }))
    expect(caps.hasTypeField).toBe(true)
    expect(caps.requiresSerial).toBe(false)
    expect(caps.hasSpecs).toBe(false)
    expect(caps.hasOemLicense).toBe(false)
  })
})

describe('resolveCategoryCapabilities — heuristic fallback (unknown id)', () => {
  it('unknown device id → group heuristic: serial yes, OEM no', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_custom_xyz', group: 'devices', name: 'Нечто' }))
    expect(caps.requiresSerial).toBe(true)
    expect(caps.hasOemLicense).toBe(false)
    expect(caps.hasTypeField).toBe(false)
    expect(caps.hasSpecs).toBe(false)
  })

  it('unknown id with name containing "компьютер" → spec heuristic fires', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_unknown_comp', group: 'devices', name: 'Компьютер Особый' }))
    expect(caps.hasSpecs).toBe(true)
    expect(caps.hasOemLicense).toBe(false) // heuristic does not grant OEM
    expect(caps.requiresSerial).toBe(true)
  })

  it('unknown furniture id → typeField via group heuristic, no serial', () => {
    const caps = resolveCategoryCapabilities(row({ id: 'cat_custom_furn', group: 'furniture', name: 'Полка нестандартная' }))
    expect(caps.hasTypeField).toBe(true)
    expect(caps.requiresSerial).toBe(false)
    expect(caps.hasSpecs).toBe(false)
    expect(caps.hasOemLicense).toBe(false)
  })
})

describe('resolveCategoryCapabilities — explicit Firestore flag overrides', () => {
  it('doc hasOemLicense:true on cat_monitor beats taxonomy (false)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_monitor', group: 'devices', name: 'Монитор', hasOemLicense: true }),
    )
    expect(caps.hasOemLicense).toBe(true)
  })

  it('doc hasOemLicense:false on cat_computer beats taxonomy (true)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_computer', group: 'devices', name: 'Компьютер', hasOemLicense: false }),
    )
    expect(caps.hasOemLicense).toBe(false)
  })

  it('doc hasSpecs:true on cat_monitor beats taxonomy (false)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_monitor', group: 'devices', name: 'Монитор', hasSpecs: true }),
    )
    expect(caps.hasSpecs).toBe(true)
  })

  it('doc hasSpecs:false on cat_computer beats taxonomy (true)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_computer', group: 'devices', name: 'Компьютер', hasSpecs: false }),
    )
    expect(caps.hasSpecs).toBe(false)
  })

  it('doc requiresSerial:false on cat_laptop beats taxonomy (true)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_laptop', group: 'devices', name: 'Ноутбук', requiresSerial: false }),
    )
    expect(caps.requiresSerial).toBe(false)
  })

  it('doc hasTypeField:true on cat_computer beats taxonomy (false)', () => {
    const caps = resolveCategoryCapabilities(
      row({ id: 'cat_computer', group: 'devices', name: 'Компьютер', hasTypeField: true }),
    )
    expect(caps.hasTypeField).toBe(true)
    // hasBrandModel is derived from hasTypeField — should now be false
    expect(caps.hasBrandModel).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deriveCategoryFlags — concrete values
// ---------------------------------------------------------------------------
describe('deriveCategoryFlags — concrete flag values', () => {
  it('cat_computer: hasSpecs=true hasOemLicense=true requiresSerial=true hasTypeField=false', () => {
    expect(deriveCategoryFlags('cat_computer', 'devices')).toEqual({
      hasSpecs: true, hasOemLicense: true, requiresSerial: true, hasTypeField: false,
    })
  })

  it('cat_macbook_pro: hasSpecs=true hasOemLicense=false (Apple) requiresSerial=true hasTypeField=false', () => {
    expect(deriveCategoryFlags('cat_macbook_pro', 'devices')).toEqual({
      hasSpecs: true, hasOemLicense: false, requiresSerial: true, hasTypeField: false,
    })
  })

  it('cat_monitor: hasSpecs=false hasOemLicense=false requiresSerial=true hasTypeField=false', () => {
    expect(deriveCategoryFlags('cat_monitor', 'devices')).toEqual({
      hasSpecs: false, hasOemLicense: false, requiresSerial: true, hasTypeField: false,
    })
  })

  it('cat_server: hasSpecs=true hasOemLicense=true requiresSerial=true hasTypeField=false', () => {
    expect(deriveCategoryFlags('cat_server', 'network')).toEqual({
      hasSpecs: true, hasOemLicense: true, requiresSerial: true, hasTypeField: false,
    })
  })

  it('cat_desk (furniture): hasSpecs=false hasOemLicense=false requiresSerial=false hasTypeField=true', () => {
    expect(deriveCategoryFlags('cat_desk', 'furniture')).toEqual({
      hasSpecs: false, hasOemLicense: false, requiresSerial: false, hasTypeField: true,
    })
  })

  it('unknown id + group=devices fallback: requiresSerial=true all else false', () => {
    expect(deriveCategoryFlags('cat_unknown_xyz', 'devices')).toEqual({
      hasSpecs: false, hasOemLicense: false, requiresSerial: true, hasTypeField: false,
    })
  })

  it('unknown id + group=furniture fallback: hasTypeField=true requiresSerial=false all else false', () => {
    expect(deriveCategoryFlags('cat_unknown_xyz', 'furniture')).toEqual({
      hasSpecs: false, hasOemLicense: false, requiresSerial: false, hasTypeField: true,
    })
  })
})

// ---------------------------------------------------------------------------
// deriveCategoryFlags agrees with resolveCategoryCapabilities (no-doc-flag path)
// This suite LOCKS the two functions together so they cannot drift.
// ---------------------------------------------------------------------------
type FourFlags = { hasSpecs: boolean; hasOemLicense: boolean; requiresSerial: boolean; hasTypeField: boolean }

function fourFlags(caps: ReturnType<typeof resolveCategoryCapabilities>): FourFlags {
  return {
    hasSpecs:      caps.hasSpecs,
    hasOemLicense: caps.hasOemLicense,
    requiresSerial: caps.requiresSerial,
    hasTypeField:  caps.hasTypeField,
  }
}

describe('deriveCategoryFlags agrees with resolveCategoryCapabilities (no-doc-flag path)', () => {
  const cases: Array<{ id: string; group: 'devices' | 'network' | 'furniture' }> = [
    { id: 'cat_computer',    group: 'devices'   },
    { id: 'cat_macbook_pro', group: 'devices'   },
    { id: 'cat_monitor',     group: 'devices'   },
    { id: 'cat_server',      group: 'network'   },
    { id: 'cat_desk',        group: 'furniture' },
    { id: 'cat_unknown_xyz', group: 'devices'   },
    { id: 'cat_unknown_xyz', group: 'furniture' },
  ]

  for (const { id, group } of cases) {
    it(`id=${id} group=${group}`, () => {
      const direct = deriveCategoryFlags(id, group)
      const viaResolve = fourFlags(resolveCategoryCapabilities(
        row({ id, group, name: '' }),
      ))
      expect(direct).toEqual(viaResolve)
    })
  }
})
