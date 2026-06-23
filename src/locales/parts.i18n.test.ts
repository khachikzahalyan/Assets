/**
 * Pure i18n resolution + interpolation-alignment test for the 'parts' namespace.
 *
 * No React rendering. Imports the real i18n instance (with all resources
 * bundled statically) and verifies:
 *   1. Key parity — ru/en/hy all share the same set of leaf keys
 *      (the hy _todo metadata key is excluded).
 *   2. Representative key resolution — a sample of keys resolves to
 *      human-readable strings in all three locales.
 *   3. Toast interpolation alignment — for every toast.* key, calling
 *      i18n.t with the EXACT vars the component now passes (post-fix) must
 *      produce a string with NO leftover "{{" substrings, and each
 *      interpolated value must appear literally in the result.
 *   3b. Placeholder guard — asserts the {{...}} set in every locale string
 *      matches the vars the component supplies; catches future drift.
 *
 * Teardown resets to 'ru' so no locale leaks into other workers.
 */

import ruParts from '@/locales/ru/parts.json'
import enParts from '@/locales/en/parts.json'
import hyParts from '@/locales/hy/parts.json'
import i18n from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Helpers
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
): Promise<(key: string, opts?: Record<string, unknown>) => string> {
  await i18n.changeLanguage(lang)
  return (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, { ns: 'parts', ...opts })
}

/**
 * Flatten a nested JSON object into dot-separated leaf keys.
 * e.g. { toast: { installed: "..." } } → ["toast.installed"]
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const full = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return flattenKeys(v as Record<string, unknown>, full)
    }
    return [full]
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await ensureReady()
})

afterAll(async () => {
  // Reset to application default so no locale leaks into other test workers.
  await i18n.changeLanguage('ru')
})

// ---------------------------------------------------------------------------
// 1. Key parity
//    The hy bundle carries a top-level "_todo" metadata key that ru/en do not.
//    We exclude it from the parity check (it is not a translatable string).
// ---------------------------------------------------------------------------

describe('parts namespace — key parity', () => {
  // Exclude the _todo metadata key that the hy bundle carries
  const EXCLUDED_KEYS = new Set(['_todo'])

  const ruKeys = flattenKeys(ruParts as Record<string, unknown>).filter(
    k => !EXCLUDED_KEYS.has(k),
  )
  const enKeys = new Set(
    flattenKeys(enParts as Record<string, unknown>).filter(k => !EXCLUDED_KEYS.has(k)),
  )
  const hyKeys = new Set(
    flattenKeys(hyParts as Record<string, unknown>).filter(k => !EXCLUDED_KEYS.has(k)),
  )

  test('en locale contains all leaf keys present in ru (excluding _todo)', () => {
    // Arrange + Act
    const missing = ruKeys.filter(k => !enKeys.has(k))
    // Assert
    expect(missing).toEqual([])
  })

  test('hy locale contains all leaf keys present in ru (excluding _todo)', () => {
    // Arrange + Act
    const missing = ruKeys.filter(k => !hyKeys.has(k))
    // Assert
    expect(missing).toEqual([])
  })

  test('ru locale contains all leaf keys present in en', () => {
    const enKeysArr = flattenKeys(enParts as Record<string, unknown>).filter(
      k => !EXCLUDED_KEYS.has(k),
    )
    const ruKeySet = new Set(ruKeys)
    const missing = enKeysArr.filter(k => !ruKeySet.has(k))
    expect(missing).toEqual([])
  })

  test('no locale has a leaf key that another locale is missing (symmetric parity)', () => {
    // All three sets must be equal in size once _todo is excluded
    expect(ruKeys.length).toBe(enKeys.size)
    expect(ruKeys.length).toBe(hyKeys.size)
  })
})

// ---------------------------------------------------------------------------
// 2. Representative key resolution
//    A sample of keys drawn from every major section of the namespace.
// ---------------------------------------------------------------------------

const REPRESENTATIVE_KEYS = [
  'title',
  'tabs.warehouse',
  'tabs.devices',
  'stats.onHand',
  'stats.installed',
  'stats.broken',
  'stats.devices',
  'installModal.title',
  'installModal.confirm',
  'installModal.cancel',
  'uninstallModal.title',
  'addModal.title',
  'gpuModal.title',
  'serviceModal.title',
  'actions.install',
  'actions.receive',
  'actions.uninstall',
  'journal.title',
  'journal.installed',
  'journal.received',
  'journal.uninstalled',
  'devices.emptyTitle',
  'warehouse.emptyTitle',
  'category.ram',
  'category.gpu',
  'card.inStock',
  'card.broken',
] as const

for (const locale of ['ru', 'en', 'hy'] as const) {
  describe(`parts namespace — ${locale} locale resolves representative keys`, () => {
    let t: (key: string, opts?: Record<string, unknown>) => string

    beforeAll(async () => {
      t = await useLocale(locale)
    })

    for (const key of REPRESENTATIVE_KEYS) {
      test(`${key} resolves to a non-key string`, () => {
        // Act
        const value = t(key)
        // Assert
        expect(value).not.toBe(key)
        expect(value).not.toBe(`parts:${key}`)
        expect(value.length).toBeGreaterThan(0)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// 3. Toast interpolation alignment (CONFORMANCE — post-fix)
//
//    PartsPage.tsx now passes the CORRECT interpolation vars on every toast:
//
//      toast.installed   line 128 → t('toast.installed',   { name, assetCode })
//      toast.uninstalled line 145 → t('toast.uninstalled', { name, assetCode })
//      toast.received    line 152 → t('toast.received',    { count, qty })
//      toast.gpuCreated  line 158 → t('toast.gpuCreated',  { name, qty })
//
//    The locale strings (ru as canonical):
//      toast.installed  : "Установлено: {{name}} → {{assetCode}}"
//      toast.uninstalled: "Снято: {{name}} ← {{assetCode}}"
//      toast.received   : "Принято: {{count}} поз. · +{{qty}} шт"
//      toast.gpuCreated : "Видеокарта добавлена: {{name}} · +{{qty}} шт"
//
//    For each key × locale we assert:
//      (a) No leftover "{{" when the component-supplied vars are passed.
//      (b) Each interpolated value appears literally in the result.
//
//    Guard test: verifies the placeholder set in each locale matches exactly
//    what the component supplies — future locale drift trips the guard.
// ---------------------------------------------------------------------------

// The EXACT vars the component passes on each toast call (post-fix).
const COMPONENT_VARS: Record<string, Record<string, unknown>> = {
  'toast.installed':   { name: 'Kingston 16GB DDR4', assetCode: '450/302042' },
  'toast.uninstalled': { name: 'Kingston 16GB DDR4', assetCode: '450/302042' },
  'toast.received':    { count: 3, qty: 10 },
  'toast.gpuCreated':  { name: 'ASUS GeForce RTX 4060', qty: 2 },
}

// The placeholder names that must appear in each locale string (derived from {{...}}).
const EXPECTED_PLACEHOLDERS: Record<string, string[]> = {
  'toast.installed':   ['name', 'assetCode'],
  'toast.uninstalled': ['name', 'assetCode'],
  'toast.received':    ['count', 'qty'],
  'toast.gpuCreated':  ['name', 'qty'],
}

/** Extract {{placeholder}} names from a locale string. */
function extractPlaceholders(str: string): string[] {
  return [...str.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).filter((v): v is string => v !== undefined)
}

describe('parts namespace — toast interpolation alignment (component call sites)', () => {
  for (const locale of ['ru', 'en', 'hy'] as const) {
    describe(`${locale} locale — toast keys called with component vars`, () => {
      let t: (key: string, opts?: Record<string, unknown>) => string

      beforeAll(async () => {
        t = await useLocale(locale)
      })

      for (const toastKey of Object.keys(COMPONENT_VARS)) {
        const vars = COMPONENT_VARS[toastKey]

        test(`CONFORMANCE: ${toastKey} — no leftover {{ when component vars are supplied`, () => {
          // Act — simulate exactly what the fixed component does
          const result = t(toastKey, vars)

          // Assert (a): all placeholders resolved, no leftover {{
          expect(result).not.toContain('{{')
          expect(result.length).toBeGreaterThan(0)
        })

        test(`CONFORMANCE: ${toastKey} — interpolated values appear in the result`, () => {
          // Arrange
          const result = t(toastKey, vars)

          // Assert (b): each value the component passes is visible in the output
          for (const value of Object.values(vars ?? {})) {
            expect(result).toContain(String(value as string | number))
          }
        })
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 3b. Placeholder-set guard
//     Reads the actual {{...}} placeholders from each locale's toast strings
//     and asserts they are EXACTLY the vars the component supplies.
//     A future locale edit that adds/renames a placeholder trips this guard
//     before it reaches production.
// ---------------------------------------------------------------------------

describe('parts namespace — toast placeholder guard (drift detection)', () => {
  const localeResources: Record<string, typeof ruParts> = {
    ru: ruParts as typeof ruParts,
    en: enParts as typeof ruParts,
    hy: hyParts as typeof ruParts,
  }

  for (const locale of ['ru', 'en', 'hy'] as const) {
    describe(`${locale} — toast placeholder names match component-supplied vars`, () => {
      const toastBlock = (localeResources[locale] as Record<string, unknown>)['toast'] as Record<string, string>

      for (const [toastKey, expectedVarNames] of Object.entries(EXPECTED_PLACEHOLDERS)) {
        const shortKey = toastKey.replace('toast.', '') // e.g. "installed"

        test(`${toastKey}: placeholders in ${locale} string match { ${expectedVarNames.join(', ')} }`, () => {
          // Arrange
          const localeString = toastBlock[shortKey] ?? ''

          // Act
          const actualPlaceholders = extractPlaceholders(localeString).sort()
          const expectedSorted = [...expectedVarNames].sort()

          // Assert — exact set match; any addition/rename/removal fails this test
          expect(actualPlaceholders).toEqual(expectedSorted)
        })
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 4. Cross-locale distinctness
//    Proves three separate bundles were loaded, not one file served for all.
// ---------------------------------------------------------------------------

describe('parts namespace — cross-locale distinctness', () => {
  const SENTINEL_KEYS = ['title', 'tabs.warehouse', 'installModal.title'] as const

  for (const key of SENTINEL_KEYS) {
    test(`${key} value differs across ru / en / hy`, async () => {
      // Arrange
      const tRu = await useLocale('ru')
      const ruVal = tRu(key)

      const tEn = await useLocale('en')
      const enVal = tEn(key)

      const tHy = await useLocale('hy')
      const hyVal = tHy(key)

      // Assert — all three must be distinct
      expect(ruVal).not.toBe(enVal)
      expect(enVal).not.toBe(hyVal)
      expect(ruVal).not.toBe(hyVal)
    })
  }

  test('title returns "Запчасти" in ru', async () => {
    const t = await useLocale('ru')
    expect(t('title')).toBe('Запчасти')
  })

  test('title returns "Parts" in en', async () => {
    const t = await useLocale('en')
    expect(t('title')).toBe('Parts')
  })

  test('title returns "Պահեստամասեր" in hy', async () => {
    const t = await useLocale('hy')
    expect(t('title')).toBe('Պահեստամասեր')
  })

  test('tabs.warehouse returns "Склад" in ru', async () => {
    const t = await useLocale('ru')
    expect(t('tabs.warehouse')).toBe('Склад')
  })

  test('stats.onHand returns "На складе" in ru', async () => {
    const t = await useLocale('ru')
    expect(t('stats.onHand')).toBe('На складе')
  })
})
