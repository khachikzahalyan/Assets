/**
 * Unit tests for detailFormat.ts pure helpers:
 *   buildSpecsLines, extractStorageCapacity, detectStorageType, storageBadgeAccent.
 *
 * NOTE: buildSpecsLines basic ordering is also covered in auditToHistoryEvent.test.ts
 * (legacy file). This file focuses on the storage-helpers behaviour and the
 * exact icon/accent names introduced by the tech-spec tile fix.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSpecsLines,
  buildSpecsCopyText,
  extractStorageCapacity,
  detectStorageType,
  storageBadgeAccent,
} from './detailFormat'

// ---------------------------------------------------------------------------
// buildSpecsLines — labelKey values and ordering
// ---------------------------------------------------------------------------

describe('buildSpecsLines — labelKey values and ordering', () => {
  const FULL_SPECS = {
    cpu: 'Intel Core i7-1265U',
    gpu: 'Intel Iris Xe',
    ram: '16 ГБ',
    ssd: 'Samsung 990 PRO 1 ТБ NVMe',
  }

  it('returns 4 lines in cpu→gpu→ram→ssd order for full specs', () => {
    const lines = buildSpecsLines(FULL_SPECS)

    expect(lines).toHaveLength(4)
    expect(lines[0]!.labelKey).toBe('form.specCpu')
    expect(lines[1]!.labelKey).toBe('form.specGpu')
    expect(lines[2]!.labelKey).toBe('form.specRam')
    expect(lines[3]!.labelKey).toBe('form.specSsd')
  })

  it('cpu line has icon "cpu" and accent "indigo"', () => {
    const lines = buildSpecsLines(FULL_SPECS)
    expect(lines[0]).toMatchObject({ icon: 'cpu', accent: 'indigo' })
  })

  it('gpu line has icon "circuit-board" and accent "violet"', () => {
    const lines = buildSpecsLines(FULL_SPECS)
    expect(lines[1]).toMatchObject({ icon: 'circuit-board', accent: 'violet' })
  })

  it('ram line has icon "memory-stick" and accent "emerald"', () => {
    const lines = buildSpecsLines(FULL_SPECS)
    expect(lines[2]).toMatchObject({ icon: 'memory-stick', accent: 'emerald' })
  })

  it('ssd line has icon "hard-drive" and accent "sky"', () => {
    const lines = buildSpecsLines(FULL_SPECS)
    expect(lines[3]).toMatchObject({ icon: 'hard-drive', accent: 'sky' })
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — CPU presence regression
// ---------------------------------------------------------------------------

describe('buildSpecsLines — CPU line presence', () => {
  it('cpu line is present when cpu is set, and value === the input cpu string', () => {
    const specs = { cpu: 'Intel Core i7-1265U', ram: '16 ГБ' }

    const lines = buildSpecsLines(specs)

    const cpuLine = lines.find(l => l.labelKey === 'form.specCpu')
    expect(cpuLine).toBeDefined()
    expect(cpuLine!.value).toBe('Intel Core i7-1265U')
  })

  it('no cpu line when cpu is empty string', () => {
    const specs = { cpu: '', ram: '8 ГБ', ssd: '512 ГБ' }

    const lines = buildSpecsLines(specs)

    expect(lines.find(l => l.labelKey === 'form.specCpu')).toBeUndefined()
    expect(lines.find(l => l.labelKey === 'form.specRam')).toBeDefined()
    expect(lines.find(l => l.labelKey === 'form.specSsd')).toBeDefined()
  })

  it('no cpu line when cpu is undefined', () => {
    const specs = { ram: '16 ГБ' }

    const lines = buildSpecsLines(specs)

    expect(lines.find(l => l.labelKey === 'form.specCpu')).toBeUndefined()
    expect(lines).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — null/undefined input
// ---------------------------------------------------------------------------

describe('buildSpecsLines — null / undefined input', () => {
  it('returns [] for null', () => {
    expect(buildSpecsLines(null)).toEqual([])
  })

  it('returns [] for undefined', () => {
    expect(buildSpecsLines(undefined)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// extractStorageCapacity
// ---------------------------------------------------------------------------

describe('extractStorageCapacity', () => {
  it('"Samsung 990 PRO 1 ТБ NVMe" → "1 ТБ"', () => {
    expect(extractStorageCapacity('Samsung 990 PRO 1 ТБ NVMe')).toBe('1 ТБ')
  })

  it('"512 GB" → "512 ГБ" (normalised ASCII to Cyrillic)', () => {
    expect(extractStorageCapacity('512 GB')).toBe('512 ГБ')
  })

  it('"256 ГБ SSD" → "256 ГБ"', () => {
    expect(extractStorageCapacity('256 ГБ SSD')).toBe('256 ГБ')
  })

  it('"2 TB Samsung" → "2 ТБ"', () => {
    expect(extractStorageCapacity('2 TB Samsung')).toBe('2 ТБ')
  })

  it('"no capacity here" → null', () => {
    expect(extractStorageCapacity('no capacity here')).toBeNull()
  })

  it('empty string → null', () => {
    expect(extractStorageCapacity('')).toBeNull()
  })

  // Lowercase Cyrillic coverage (Issue 3)
  it('"512 гб" → "512 ГБ" (lowercase Cyrillic)', () => {
    expect(extractStorageCapacity('512 гб')).toBe('512 ГБ')
  })

  it('"1 тб" → "1 ТБ" (lowercase Cyrillic)', () => {
    expect(extractStorageCapacity('1 тб')).toBe('1 ТБ')
  })
})

// ---------------------------------------------------------------------------
// detectStorageType
// ---------------------------------------------------------------------------

describe('detectStorageType', () => {
  it('"Samsung 990 PRO 1 ТБ NVMe" → "NVMe"', () => {
    expect(detectStorageType('Samsung 990 PRO 1 ТБ NVMe')).toBe('NVMe')
  })

  it('"WD Blue M.2 512GB" → "M.2"', () => {
    expect(detectStorageType('WD Blue M.2 512GB')).toBe('M.2')
  })

  it('"Crucial MX500 SSD 512GB" → "SSD"', () => {
    expect(detectStorageType('Crucial MX500 SSD 512GB')).toBe('SSD')
  })

  it('"Seagate Barracuda HDD 1TB" → "HDD"', () => {
    expect(detectStorageType('Seagate Barracuda HDD 1TB')).toBe('HDD')
  })

  it('"SAS 600GB drive" → "SAS"', () => {
    expect(detectStorageType('SAS 600GB drive')).toBe('SAS')
  })

  it('"512 ГБ" (bare capacity, no type token) → null', () => {
    expect(detectStorageType('512 ГБ')).toBeNull()
  })

  it('"1 ТБ" → null', () => {
    expect(detectStorageType('1 ТБ')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// storageBadgeAccent
// ---------------------------------------------------------------------------

describe('storageBadgeAccent', () => {
  it('"NVMe" → "violet"', () => {
    expect(storageBadgeAccent('NVMe')).toBe('violet')
  })

  it('"M.2" → "violet"', () => {
    expect(storageBadgeAccent('M.2')).toBe('violet')
  })

  it('"HDD" → "amber"', () => {
    expect(storageBadgeAccent('HDD')).toBe('amber')
  })

  it('"SAS" → "amber"', () => {
    expect(storageBadgeAccent('SAS')).toBe('amber')
  })

  it('"SSD" → "sky"', () => {
    expect(storageBadgeAccent('SSD')).toBe('sky')
  })

  it('"SATA" → "sky" (falls through to default)', () => {
    expect(storageBadgeAccent('SATA')).toBe('sky')
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — ssd badge fields
// ---------------------------------------------------------------------------

describe('buildSpecsLines — ssd badge field', () => {
  it('"Samsung 990 PRO 1 ТБ NVMe": ssd line has badge "NVMe" and badgeAccent "violet"', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine).toBeDefined()
    expect(ssdLine!.badge).toBe('NVMe')
    expect(ssdLine!.badgeAccent).toBe('violet')
  })

  it('"512 ГБ" (bare capacity, no type token): ssd line has no badge', () => {
    const lines = buildSpecsLines({ ssd: '512 ГБ' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine).toBeDefined()
    expect(ssdLine!.badge).toBeUndefined()
    expect(ssdLine!.badgeAccent).toBeUndefined()
  })

  it('"500 GB HDD": ssd line has badge "HDD" and badgeAccent "amber"', () => {
    const lines = buildSpecsLines({ ssd: '500 GB HDD' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine!.badge).toBe('HDD')
    expect(ssdLine!.badgeAccent).toBe('amber')
  })

  it('ssd value is the capacity string (not the raw full string) when capacity found', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    // value = extracted capacity; raw string is preserved in rawValue
    expect(ssdLine!.value).toBe('1 ТБ')
  })

  it('ssd value falls back to raw string when no capacity found', () => {
    const lines = buildSpecsLines({ ssd: 'Unknown SSD' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine!.value).toBe('Unknown SSD')
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — rawValue (Issue 4)
// ---------------------------------------------------------------------------

describe('buildSpecsLines — rawValue for storage fidelity', () => {
  it('ssd line has rawValue = original string when capacity is found', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine!.rawValue).toBe('Samsung 990 PRO 1 ТБ NVMe')
  })

  it('ssd line has no rawValue when no capacity is found (value IS the raw string)', () => {
    const lines = buildSpecsLines({ ssd: 'Unknown SSD' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(ssdLine!.rawValue).toBeUndefined()
  })

  it('cpu/gpu/ram lines never have rawValue', () => {
    const lines = buildSpecsLines({
      cpu: 'Intel Core i7-1265U',
      gpu: 'Intel Iris Xe',
      ram: '16 ГБ',
    })
    for (const line of lines) {
      expect(line.rawValue).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// buildSpecsCopyText — full fidelity via rawValue (Issue 4)
// ---------------------------------------------------------------------------

describe('buildSpecsCopyText — copy text fidelity', () => {
  /** Minimal resolve function — mirrors what t() returns for the ru locale. */
  const resolveRu: Record<string, string> = {
    'form.specCpu':      'Процессор',
    'form.specGpu':      'Видеокарта',
    'form.specRam':      'Оперативная память',
    'form.specSsd':      'Накопитель',
    'form.specSsdPlural':'Накопители',
  }
  const t = (key: string) => resolveRu[key] ?? key

  it('storage copy text uses rawValue (full model+capacity string), not stripped capacity', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const text = buildSpecsCopyText(lines, t)

    // Must contain full fidelity string — not just "1 ТБ"
    expect(text).toContain('Samsung 990 PRO 1 ТБ NVMe')
    expect(text).toContain('Накопитель:')
  })

  it('storage tile value still shows compact capacity (not full raw)', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const ssdLine = lines.find(l => l.labelKey === 'form.specSsd')

    // tile value = compact; rawValue = full
    expect(ssdLine!.value).toBe('1 ТБ')
    expect(ssdLine!.rawValue).toBe('Samsung 990 PRO 1 ТБ NVMe')
  })

  it('copy text for cpu uses value directly (no rawValue)', () => {
    const lines = buildSpecsLines({ cpu: 'Intel Core i7-1265U' })
    const text = buildSpecsCopyText(lines, t)

    expect(text).toBe('Процессор: Intel Core i7-1265U')
  })

  it('full asset copy text has correct format', () => {
    const lines = buildSpecsLines({
      cpu: 'Intel Core i7-1265U',
      gpu: 'Intel Iris Xe',
      ram: '16 ГБ',
      ssd: 'Samsung 990 PRO 1 ТБ NVMe',
    })
    const text = buildSpecsCopyText(lines, t)
    const rows = text.split('\n')

    expect(rows[0]).toBe('Процессор: Intel Core i7-1265U')
    expect(rows[1]).toBe('Видеокарта: Intel Iris Xe')
    expect(rows[2]).toBe('Оперативная память: 16 ГБ')
    expect(rows[3]).toBe('Накопитель: Samsung 990 PRO 1 ТБ NVMe')
  })

  it('multi-slot copy text has ONE Накопители line with all drives joined by " + "', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ' })
    const text = buildSpecsCopyText(lines, t)
    const rows = text.split('\n')

    // Only ONE row for storage (plural label)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toBe('Накопители: SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ')
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — multi-slot storage (updated: one tile with slots array)
// ---------------------------------------------------------------------------

describe('buildSpecsLines — multi-slot storage', () => {
  it('"SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ" yields ONE SpecLine (plural label) with 3 slots', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ' })
    // Only ONE storage SpecLine regardless of slot count
    const storageLines = lines.filter(l =>
      l.labelKey === 'form.specSsd' || l.labelKey === 'form.specSsdPlural',
    )

    expect(storageLines).toHaveLength(1)
    expect(storageLines[0]!.labelKey).toBe('form.specSsdPlural')
    expect(storageLines[0]!.slots).toHaveLength(3)
  })

  it('first slot has badge "SSD" (sky) and value "256 ГБ"', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ' })
    const storageLine = lines.find(l => l.labelKey === 'form.specSsdPlural')!
    const slots = storageLine.slots!

    expect(slots[0]!.badge).toBe('SSD')
    expect(slots[0]!.badgeAccent).toBe('sky')
    expect(slots[0]!.value).toBe('256 ГБ')
  })

  it('second slot has badge "HDD" (amber) and value "1 ТБ"', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ' })
    const storageLine = lines.find(l => l.labelKey === 'form.specSsdPlural')!
    const slots = storageLine.slots!

    expect(slots[1]!.badge).toBe('HDD')
    expect(slots[1]!.badgeAccent).toBe('amber')
    expect(slots[1]!.value).toBe('1 ТБ')
  })

  it('third slot has badge "M.2" (violet) and value "512 ГБ"', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ' })
    const storageLine = lines.find(l => l.labelKey === 'form.specSsdPlural')!
    const slots = storageLine.slots!

    expect(slots[2]!.badge).toBe('M.2')
    expect(slots[2]!.badgeAccent).toBe('violet')
    expect(slots[2]!.value).toBe('512 ГБ')
  })

  it('single-slot ssd produces exactly 1 storage line with singular label and 1 slot', () => {
    const lines = buildSpecsLines({ ssd: 'Samsung 990 PRO 1 ТБ NVMe' })
    const storageLine = lines.find(l => l.labelKey === 'form.specSsd')

    expect(storageLine).toBeDefined()
    expect(storageLine!.slots).toHaveLength(1)
  })

  it('two-slot "SSD 512 ГБ + HDD 2 ТБ" — slot order is preserved in the slots array', () => {
    const lines = buildSpecsLines({ ssd: 'SSD 512 ГБ + HDD 2 ТБ' })
    const storageLine = lines.find(l => l.labelKey === 'form.specSsdPlural')!
    const slots = storageLine.slots!

    expect(slots).toHaveLength(2)
    expect(slots[0]!.badge).toBe('SSD')
    expect(slots[1]!.badge).toBe('HDD')
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines — factory status value colour (Bug 2 fix)
// ---------------------------------------------------------------------------

describe('buildSpecsLines — factory status valueClassName', () => {
  it('cooling line has valueClassName "text-emerald-300" for a laptop category', () => {
    const lines = buildSpecsLines({ cpu: 'i7' }, 'cat_laptop')
    const cooling = lines.find(l => l.labelKey === 'detail.specs.cooling')

    expect(cooling).toBeDefined()
    expect(cooling!.valueClassName).toBe('text-emerald-300')
  })

  it('battery line has valueClassName "text-emerald-300" for a laptop category', () => {
    const lines = buildSpecsLines({ cpu: 'i7' }, 'cat_laptop')
    const battery = lines.find(l => l.labelKey === 'detail.specs.battery')

    expect(battery).toBeDefined()
    expect(battery!.valueClassName).toBe('text-emerald-300')
  })

  it('PSU line has valueClassName "text-emerald-300" for a desktop category', () => {
    const lines = buildSpecsLines({ cpu: 'i7' }, 'cat_desktop')
    const psu = lines.find(l => l.labelKey === 'detail.specs.psu')

    expect(psu).toBeDefined()
    expect(psu!.valueClassName).toBe('text-emerald-300')
  })

  it('cpu / gpu / ram / ssd lines do NOT carry valueClassName', () => {
    const lines = buildSpecsLines({
      cpu: 'Intel Core i7',
      gpu: 'Intel Iris Xe',
      ram: '16 ГБ',
      ssd: 'SSD 512 ГБ',
    })
    for (const line of lines.filter(l => ['form.specCpu', 'form.specGpu', 'form.specRam', 'form.specSsd'].includes(l.labelKey))) {
      expect(line.valueClassName).toBeUndefined()
    }
  })
})
