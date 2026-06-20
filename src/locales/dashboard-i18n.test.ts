/**
 * Pure i18n resolution test for the 'dashboard' namespace.
 *
 * No React rendering. Imports the real i18n instance (with all resources
 * bundled statically) and verifies that:
 *   1. Key parity — every key present in the ru locale also exists in en + hy.
 *   2. Representative keys resolve to human-readable strings (not raw key paths)
 *      in all three locales.
 *   3. Cross-locale distinctness — the same key produces three different values.
 *
 * Teardown resets the language to 'ru' so no global i18n state leaks into
 * other tests sharing the same Vitest worker.
 */

import ruDashboard from '@/locales/ru/dashboard.json'
import enDashboard from '@/locales/en/dashboard.json'
import hyDashboard from '@/locales/hy/dashboard.json'
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

async function useLocale(lang: string): Promise<(key: string, opts?: Record<string, unknown>) => string> {
  await i18n.changeLanguage(lang)
  return (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, { ns: 'dashboard', ...opts })
}

/** Flatten a nested object into dot-separated keys, e.g. { a: { b: 'v' } } → ['a.b'] */
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
  await i18n.changeLanguage('ru')
})

// ---------------------------------------------------------------------------
// 1. Key parity — en and hy must contain every key from ru
// ---------------------------------------------------------------------------

describe('dashboard namespace — key parity', () => {
  const ruKeys = flattenKeys(ruDashboard as Record<string, unknown>)
  const enKeys = new Set(flattenKeys(enDashboard as Record<string, unknown>))
  const hyKeys = new Set(flattenKeys(hyDashboard as Record<string, unknown>))

  test('en locale contains all keys present in ru', () => {
    const missing = ruKeys.filter(k => !enKeys.has(k))
    expect(missing).toEqual([])
  })

  test('hy locale contains all keys present in ru', () => {
    const missing = ruKeys.filter(k => !hyKeys.has(k))
    expect(missing).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 2. Representative key resolution — each locale returns a non-key string
// ---------------------------------------------------------------------------

const REPRESENTATIVE_KEYS = [
  'title',
  'recentActivity',
  'recentAudit',
  'noActivity',
  'noAudit',
  'viewAll',
  'kpi.totalAssets',
  'kpi.currentlyOut',
  'kpi.licenses',
  'status.st_warehouse',
  'status.st_assigned',
  'groups.devices',
  'groups.network',
  'license.title',
  'license.total',
  'license.free',
  'license.inUse',
  'license.retired',
  'people.employees',
  'people.pending',
  'branches.title',
  'branches.empty',
  'auditAction.created',
  'auditAction.updated',
  'auditAction.transferred',
  'auditAction.terminated',
  'auditAction.key_revealed',
] as const

for (const locale of ['ru', 'en', 'hy'] as const) {
  describe(`dashboard namespace — ${locale} locale resolves representative keys`, () => {
    let t: (key: string, opts?: Record<string, unknown>) => string

    beforeAll(async () => {
      t = await useLocale(locale)
    })

    for (const key of REPRESENTATIVE_KEYS) {
      test(`${key} resolves to a non-key string`, () => {
        const value = t(key)
        expect(value).not.toBe(key)
        expect(value).not.toBe(`dashboard:${key}`)
        expect(value.length).toBeGreaterThan(0)
      })
    }
  })
}

// ---------------------------------------------------------------------------
// 3. Cross-locale distinctness — title, recentActivity, auditAction.created
//    must differ across all three locales (proves 3 separate bundles loaded)
// ---------------------------------------------------------------------------

describe('dashboard namespace — cross-locale distinctness', () => {
  const SENTINEL_KEYS = ['title', 'recentActivity', 'auditAction.created'] as const

  for (const key of SENTINEL_KEYS) {
    test(`${key} value differs across ru / en / hy`, async () => {
      const tRu = await useLocale('ru')
      const ruVal = tRu(key)

      const tEn = await useLocale('en')
      const enVal = tEn(key)

      const tHy = await useLocale('hy')
      const hyVal = tHy(key)

      expect(ruVal).not.toBe(enVal)
      expect(enVal).not.toBe(hyVal)
      expect(ruVal).not.toBe(hyVal)
    })
  }

  test('title returns "Панель управления" in ru', async () => {
    const t = await useLocale('ru')
    expect(t('title')).toBe('Панель управления')
  })

  test('title returns "Dashboard" in en', async () => {
    const t = await useLocale('en')
    expect(t('title')).toBe('Dashboard')
  })

  test('title returns "Կառավարման վահանակ" in hy', async () => {
    const t = await useLocale('hy')
    expect(t('title')).toBe('Կառավարման վահանակ')
  })
})
