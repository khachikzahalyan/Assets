/**
 * Global locale synchronisation test.
 *
 * For every namespace JSON under src/locales/ru/:
 *   1. en/<namespace>.json contains EXACTLY the same set of leaf dot-paths.
 *   2. hy/<namespace>.json contains EXACTLY the same set of leaf dot-paths.
 *   (Missing keys in en/hy are errors. Extra keys in en/hy are also errors.)
 *
 * Additional conformance checks absorbed from the old per-namespace tests:
 *   - parts:     toast interpolation alignment + placeholder guard + distinctness
 *   - dashboard: cross-locale distinctness with exact value assertions
 *   - audit:     pagination interpolation + col.time exact values
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import i18n from '@/lib/i18n'

// Imported directly so the Armenian exact-value assertions read from the file
// rather than embedding raw Unicode in this source.
import ruParts from '@/locales/ru/parts.json'
import enParts from '@/locales/en/parts.json'
import hyParts from '@/locales/hy/parts.json'
import hyDashboard from '@/locales/hy/dashboard.json'
import hyAudit from '@/locales/hy/audit.json'

// ---------------------------------------------------------------------------
// Load all locale files dynamically via import.meta.glob
// ---------------------------------------------------------------------------

const ruModules = import.meta.glob('@/locales/ru/*.json', { eager: true })
const enModules = import.meta.glob('@/locales/en/*.json', { eager: true })
const hyModules = import.meta.glob('@/locales/hy/*.json', { eager: true })

/** Extract namespace name from a glob path like "…/locales/ru/assets.json" → "assets" */
function nsFromPath(p: string): string {
  return p.replace(/.*\//, '').replace('.json', '')
}

type JsonObj = Record<string, unknown>

const ruByNs: Record<string, JsonObj> = {}
const enByNs: Record<string, JsonObj> = {}
const hyByNs: Record<string, JsonObj> = {}

for (const [p, mod] of Object.entries(ruModules))
  ruByNs[nsFromPath(p)] = (mod as { default: JsonObj }).default
for (const [p, mod] of Object.entries(enModules))
  enByNs[nsFromPath(p)] = (mod as { default: JsonObj }).default
for (const [p, mod] of Object.entries(hyModules))
  hyByNs[nsFromPath(p)] = (mod as { default: JsonObj }).default

// ---------------------------------------------------------------------------
// Helper: flatten nested object to dot-separated leaf keys
// ---------------------------------------------------------------------------

function flattenKeys(obj: JsonObj, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v))
      return flattenKeys(v as JsonObj, full)
    return [full]
  })
}

// ---------------------------------------------------------------------------
// i18n helpers
// ---------------------------------------------------------------------------

async function ensureReady(): Promise<void> {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve, reject) => {
      i18n.on('initialized', resolve)
      i18n.on('failedLoading', (_: unknown, __: unknown, msg: string) =>
        reject(new Error(msg)),
      )
    })
  }
}

async function useLocale(
  lang: string,
  ns: string,
): Promise<(key: string, opts?: Record<string, unknown>) => string> {
  await i18n.changeLanguage(lang)
  return (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, { ns, ...opts })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await ensureReady()
})

afterAll(async () => {
  await i18n.changeLanguage('ru')
})

// ---------------------------------------------------------------------------
// 1. Global key-parity tests — one describe per namespace
// ---------------------------------------------------------------------------

const namespaces = Object.keys(ruByNs).sort()

for (const ns of namespaces) {
  describe(`locale sync — ${ns}`, () => {
    const ruKeys = flattenKeys(ruByNs[ns] ?? {})
    const enKeys = new Set(flattenKeys(enByNs[ns] ?? {}))
    const hyKeys = new Set(flattenKeys(hyByNs[ns] ?? {}))
    const ruKeySet = new Set(ruKeys)

    test('en contains all ru leaf keys (no missing)', () => {
      const missing = ruKeys.filter(k => !enKeys.has(k))
      expect(missing, `en/${ns}.json is missing keys`).toEqual([])
    })

    test('en has no extra leaf keys vs ru (no spurious)', () => {
      const spurious = [...enKeys].filter(k => !ruKeySet.has(k))
      expect(spurious, `en/${ns}.json has spurious keys not in ru`).toEqual([])
    })

    test('hy contains all ru leaf keys (no missing)', () => {
      const missing = ruKeys.filter(k => !hyKeys.has(k))
      expect(missing, `hy/${ns}.json is missing keys`).toEqual([])
    })

    test('hy has no extra leaf keys vs ru (no spurious)', () => {
      const spurious = [...hyKeys].filter(k => !ruKeySet.has(k))
      expect(spurious, `hy/${ns}.json has spurious keys not in ru`).toEqual([])
    })
  })
}

// ---------------------------------------------------------------------------
// 2. Absorbed from parts.i18n.test.ts
//    3. Toast interpolation alignment
//    3b. Placeholder-set guard
//    4. Cross-locale distinctness
// ---------------------------------------------------------------------------

/** Extract {{placeholder}} names from a locale string */
function extractPlaceholders(str: string): string[] {
  return [...str.matchAll(/\{\{(\w+)\}\}/g)]
    .map(m => m[1])
    .filter((v): v is string => v !== undefined)
}

// The EXACT vars the component passes on each toast call (post-fix).
const PARTS_COMPONENT_VARS: Record<string, Record<string, unknown>> = {
  'toast.installed':   { name: 'Kingston 16GB DDR4', assetCode: '450/302042' },
  'toast.uninstalled': { name: 'Kingston 16GB DDR4', assetCode: '450/302042' },
  'toast.received':    { count: 3, qty: 10 },
  'toast.gpuCreated':  { name: 'ASUS GeForce RTX 4060', qty: 2 },
}

// The placeholder names that must appear in each locale string.
const PARTS_EXPECTED_PLACEHOLDERS: Record<string, string[]> = {
  'toast.installed':   ['assetCode', 'name'],
  'toast.uninstalled': ['assetCode', 'name'],
  'toast.received':    ['count', 'qty'],
  'toast.gpuCreated':  ['name', 'qty'],
}

describe('parts namespace — toast interpolation alignment (component call sites)', () => {
  for (const locale of ['ru', 'en', 'hy'] as const) {
    describe(`${locale} locale — toast keys called with component vars`, () => {
      let t: (key: string, opts?: Record<string, unknown>) => string

      beforeAll(async () => {
        t = await useLocale(locale, 'parts')
      })

      for (const toastKey of Object.keys(PARTS_COMPONENT_VARS)) {
        const vars = PARTS_COMPONENT_VARS[toastKey]

        test(`CONFORMANCE: ${toastKey} — no leftover {{ when component vars are supplied`, () => {
          const result = t(toastKey, vars)
          expect(result).not.toContain('{{')
          expect(result.length).toBeGreaterThan(0)
        })

        test(`CONFORMANCE: ${toastKey} — interpolated values appear in the result`, () => {
          const result = t(toastKey, vars)
          for (const value of Object.values(vars ?? {})) {
            expect(result).toContain(String(value as string | number))
          }
        })
      }
    })
  }
})

describe('parts namespace — toast placeholder guard (drift detection)', () => {
  const partsLocales: Record<string, typeof ruParts> = {
    ru: ruParts as typeof ruParts,
    en: enParts as typeof ruParts,
    hy: hyParts as typeof ruParts,
  }

  for (const locale of ['ru', 'en', 'hy'] as const) {
    describe(`${locale} — toast placeholder names match component-supplied vars`, () => {
      const toastBlock = (partsLocales[locale] as Record<string, unknown>)['toast'] as Record<string, string>

      for (const [toastKey, expectedVarNames] of Object.entries(PARTS_EXPECTED_PLACEHOLDERS)) {
        const shortKey = toastKey.replace('toast.', '')

        test(`${toastKey}: placeholders in ${locale} string match { ${expectedVarNames.join(', ')} }`, () => {
          const localeString = toastBlock[shortKey] ?? ''
          const actualPlaceholders = extractPlaceholders(localeString).sort()
          const expectedSorted = [...expectedVarNames].sort()
          expect(actualPlaceholders).toEqual(expectedSorted)
        })
      }
    })
  }
})

describe('parts namespace — cross-locale distinctness', () => {
  const SENTINEL_KEYS = ['title', 'tabs.warehouse', 'installModal.title'] as const

  for (const key of SENTINEL_KEYS) {
    test(`${key} value differs across ru / en / hy`, async () => {
      const tRu = await useLocale('ru', 'parts')
      const ruVal = tRu(key)
      const tEn = await useLocale('en', 'parts')
      const enVal = tEn(key)
      const tHy = await useLocale('hy', 'parts')
      const hyVal = tHy(key)

      expect(ruVal).not.toBe(enVal)
      expect(enVal).not.toBe(hyVal)
      expect(ruVal).not.toBe(hyVal)
    })
  }

  test('title returns "Запчасти" in ru', async () => {
    const t = await useLocale('ru', 'parts')
    expect(t('title')).toBe('Запчасти')
  })

  test('title returns "Parts" in en', async () => {
    const t = await useLocale('en', 'parts')
    expect(t('title')).toBe('Parts')
  })

  test('title matches hy/parts.json title field', async () => {
    const t = await useLocale('hy', 'parts')
    // Read expected value from the JSON file itself to avoid encoding issues
    expect(t('title')).toBe((hyParts as Record<string, unknown>)['title'] as string)
  })

  test('tabs.warehouse returns "Склад" in ru', async () => {
    const t = await useLocale('ru', 'parts')
    expect(t('tabs.warehouse')).toBe('Склад')
  })

  test('stats.onHand returns "На складе" in ru', async () => {
    const t = await useLocale('ru', 'parts')
    expect(t('stats.onHand')).toBe('На складе')
  })
})

// ---------------------------------------------------------------------------
// 3. Absorbed from dashboard-i18n.test.ts
//    Cross-locale distinctness with exact string assertions
// ---------------------------------------------------------------------------

describe('dashboard namespace — cross-locale distinctness', () => {
  const SENTINEL_KEYS = ['title', 'boxes.assets.title', 'kpi.totalAssets'] as const

  for (const key of SENTINEL_KEYS) {
    test(`${key} value differs across ru / en / hy`, async () => {
      const tRu = await useLocale('ru', 'dashboard')
      const ruVal = tRu(key)
      const tEn = await useLocale('en', 'dashboard')
      const enVal = tEn(key)
      const tHy = await useLocale('hy', 'dashboard')
      const hyVal = tHy(key)

      expect(ruVal).not.toBe(enVal)
      expect(enVal).not.toBe(hyVal)
      expect(ruVal).not.toBe(hyVal)
    })
  }

  test('title returns "Панель управления" in ru', async () => {
    const t = await useLocale('ru', 'dashboard')
    expect(t('title')).toBe('Панель управления')
  })

  test('title returns "Dashboard" in en', async () => {
    const t = await useLocale('en', 'dashboard')
    expect(t('title')).toBe('Dashboard')
  })

  test('title matches hy/dashboard.json title field', async () => {
    const t = await useLocale('hy', 'dashboard')
    expect(t('title')).toBe((hyDashboard as Record<string, unknown>)['title'] as string)
  })
})

// ---------------------------------------------------------------------------
// 4. Absorbed from audit-i18n.test.ts
//    pagination.page interpolation + col.time exact values
// ---------------------------------------------------------------------------

describe('audit namespace — pagination interpolation and col.time exact values', () => {
  test('pagination.page interpolates {{page}} in ru (page=3)', async () => {
    const t = await useLocale('ru', 'audit')
    const value = t('pagination.page', { page: 3 })
    expect(value).not.toBe('pagination.page')
    expect(value).toContain('3')
    expect(value).not.toContain('{{page}}')
  })

  test('pagination.page interpolates {{page}} in en (page=7)', async () => {
    const t = await useLocale('en', 'audit')
    const value = t('pagination.page', { page: 7 })
    expect(value).not.toBe('pagination.page')
    expect(value).toContain('7')
    expect(value).not.toContain('{{page}}')
  })

  test('pagination.page interpolates {{page}} in hy (page=2)', async () => {
    const t = await useLocale('hy', 'audit')
    const value = t('pagination.page', { page: 2 })
    expect(value).not.toBe('pagination.page')
    expect(value).toContain('2')
    expect(value).not.toContain('{{page}}')
  })

  test('col.time returns "Время" in ru', async () => {
    const t = await useLocale('ru', 'audit')
    expect(t('col.time')).toBe('Время')
  })

  test('col.time returns "Time" in en', async () => {
    const t = await useLocale('en', 'audit')
    expect(t('col.time')).toBe('Time')
  })

  test('col.time matches hy/audit.json col.time field', async () => {
    const t = await useLocale('hy', 'audit')
    const hyColTime = ((hyAudit as Record<string, unknown>)['col'] as Record<string, string>)['time']
    expect(t('col.time')).toBe(hyColTime)
  })

  test('col.time value differs across all three locales', async () => {
    const tRu = await useLocale('ru', 'audit')
    const ruVal = tRu('col.time')
    const tEn = await useLocale('en', 'audit')
    const enVal = tEn('col.time')
    const tHy = await useLocale('hy', 'audit')
    const hyVal = tHy('col.time')

    expect(ruVal).not.toBe(enVal)
    expect(enVal).not.toBe(hyVal)
    expect(ruVal).not.toBe(hyVal)
    expect(ruVal).toBe('Время')
    expect(enVal).toBe('Time')
    // Verify against JSON rather than hardcoding Unicode
    const hyColTime = ((hyAudit as Record<string, unknown>)['col'] as Record<string, string>)['time']
    expect(hyVal).toBe(hyColTime)
  })

  test('empty.title value differs across all three locales', async () => {
    const tRu = await useLocale('ru', 'audit')
    const ruVal = tRu('empty.title')
    const tEn = await useLocale('en', 'audit')
    const enVal = tEn('empty.title')
    const tHy = await useLocale('hy', 'audit')
    const hyVal = tHy('empty.title')

    expect(ruVal).not.toBe(enVal)
    expect(enVal).not.toBe(hyVal)
    expect(ruVal).not.toBe(hyVal)
    expect(ruVal).toBe('Записей нет')
    expect(enVal).toBe('No entries')
    // Verify against JSON rather than hardcoding Unicode
    const hyEmptyTitle = ((hyAudit as Record<string, unknown>)['empty'] as Record<string, string>)['title']
    expect(hyVal).toBe(hyEmptyTitle)
  })
})
