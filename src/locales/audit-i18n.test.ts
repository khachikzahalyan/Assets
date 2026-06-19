/**
 * Pure i18n resolution test for the 'audit' namespace.
 *
 * No React rendering. Imports the real i18n instance (with all resources
 * bundled statically) and verifies that each locale resolves audit keys to
 * human-readable strings — NOT the raw key path.
 *
 * Teardown resets the language to 'ru' so no global i18n state leaks into
 * other tests that share the same Vitest worker.
 */

import i18n from '@/lib/i18n'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ensure the i18n instance is fully initialised before each test group runs.
 * i18n/index.ts calls `void i18n.init(...)` (fire-and-forget); the instance
 * may still be settling when we import it in tests. `i18n.init()` is
 * idempotent — if already done it resolves immediately.
 */
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

/**
 * Switch language and return the i18n.t helper bound to the 'audit' namespace.
 * Using a closure keeps each test's assertions tightly scoped.
 */
async function useLocale(lang: string): Promise<(key: string, opts?: Record<string, unknown>) => string> {
  await i18n.changeLanguage(lang)
  return (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, { ns: 'audit', ...opts })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await ensureReady()
})

afterAll(async () => {
  // Reset to the application default ('ru') so no locale leaks into other
  // workers/tests that may share the i18n singleton.
  await i18n.changeLanguage('ru')
})

// ---------------------------------------------------------------------------
// Keys under test — one per required category from the task brief
// ---------------------------------------------------------------------------

const AUDIT_KEYS = {
  colTime: 'col.time',
  entityAsset: 'entity.asset',
  actionCreated: 'action.created',
  roleSuperAdmin: 'role.super_admin',
  filtersReset: 'filters.reset',
  diffBefore: 'diff.before',
  diffAfter: 'diff.after',
  emptyTitle: 'empty.title',
  paginationPage: 'pagination.page',
} as const

// ---------------------------------------------------------------------------
// Russian locale
// ---------------------------------------------------------------------------

describe('audit namespace — ru locale', () => {
  let t: (key: string, opts?: Record<string, unknown>) => string

  beforeAll(async () => {
    t = await useLocale('ru')
  })

  test('col.time resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.colTime)
    expect(value).not.toBe(`audit:${AUDIT_KEYS.colTime}`)
    expect(value).not.toBe(AUDIT_KEYS.colTime)
    expect(value.length).toBeGreaterThan(0)
  })

  test('entity.asset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.entityAsset)
    expect(value).not.toBe(AUDIT_KEYS.entityAsset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('action.created resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.actionCreated)
    expect(value).not.toBe(AUDIT_KEYS.actionCreated)
    expect(value.length).toBeGreaterThan(0)
  })

  test('role.super_admin resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.roleSuperAdmin)
    expect(value).not.toBe(AUDIT_KEYS.roleSuperAdmin)
    expect(value.length).toBeGreaterThan(0)
  })

  test('filters.reset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.filtersReset)
    expect(value).not.toBe(AUDIT_KEYS.filtersReset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.before resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffBefore)
    expect(value).not.toBe(AUDIT_KEYS.diffBefore)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.after resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffAfter)
    expect(value).not.toBe(AUDIT_KEYS.diffAfter)
    expect(value.length).toBeGreaterThan(0)
  })

  test('empty.title resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.emptyTitle)
    expect(value).not.toBe(AUDIT_KEYS.emptyTitle)
    expect(value.length).toBeGreaterThan(0)
  })

  test('pagination.page interpolates the {{page}} variable', () => {
    const value = t(AUDIT_KEYS.paginationPage, { page: 3 })
    expect(value).not.toBe(AUDIT_KEYS.paginationPage)
    // The interpolated number must appear in the result
    expect(value).toContain('3')
    // The raw placeholder must NOT remain
    expect(value).not.toContain('{{page}}')
  })

  test('col.time returns the Russian word "Время"', () => {
    expect(t(AUDIT_KEYS.colTime)).toBe('Время')
  })
})

// ---------------------------------------------------------------------------
// English locale
// ---------------------------------------------------------------------------

describe('audit namespace — en locale', () => {
  let t: (key: string, opts?: Record<string, unknown>) => string

  beforeAll(async () => {
    t = await useLocale('en')
  })

  test('col.time resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.colTime)
    expect(value).not.toBe(AUDIT_KEYS.colTime)
    expect(value.length).toBeGreaterThan(0)
  })

  test('entity.asset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.entityAsset)
    expect(value).not.toBe(AUDIT_KEYS.entityAsset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('action.created resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.actionCreated)
    expect(value).not.toBe(AUDIT_KEYS.actionCreated)
    expect(value.length).toBeGreaterThan(0)
  })

  test('role.super_admin resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.roleSuperAdmin)
    expect(value).not.toBe(AUDIT_KEYS.roleSuperAdmin)
    expect(value.length).toBeGreaterThan(0)
  })

  test('filters.reset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.filtersReset)
    expect(value).not.toBe(AUDIT_KEYS.filtersReset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.before resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffBefore)
    expect(value).not.toBe(AUDIT_KEYS.diffBefore)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.after resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffAfter)
    expect(value).not.toBe(AUDIT_KEYS.diffAfter)
    expect(value.length).toBeGreaterThan(0)
  })

  test('empty.title resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.emptyTitle)
    expect(value).not.toBe(AUDIT_KEYS.emptyTitle)
    expect(value.length).toBeGreaterThan(0)
  })

  test('pagination.page interpolates the {{page}} variable', () => {
    const value = t(AUDIT_KEYS.paginationPage, { page: 7 })
    expect(value).not.toBe(AUDIT_KEYS.paginationPage)
    expect(value).toContain('7')
    expect(value).not.toContain('{{page}}')
  })

  test('col.time returns the English word "Time"', () => {
    expect(t(AUDIT_KEYS.colTime)).toBe('Time')
  })
})

// ---------------------------------------------------------------------------
// Armenian locale
// ---------------------------------------------------------------------------

describe('audit namespace — hy locale', () => {
  let t: (key: string, opts?: Record<string, unknown>) => string

  beforeAll(async () => {
    t = await useLocale('hy')
  })

  test('col.time resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.colTime)
    expect(value).not.toBe(AUDIT_KEYS.colTime)
    expect(value.length).toBeGreaterThan(0)
  })

  test('entity.asset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.entityAsset)
    expect(value).not.toBe(AUDIT_KEYS.entityAsset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('action.created resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.actionCreated)
    expect(value).not.toBe(AUDIT_KEYS.actionCreated)
    expect(value.length).toBeGreaterThan(0)
  })

  test('role.super_admin resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.roleSuperAdmin)
    expect(value).not.toBe(AUDIT_KEYS.roleSuperAdmin)
    expect(value.length).toBeGreaterThan(0)
  })

  test('filters.reset resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.filtersReset)
    expect(value).not.toBe(AUDIT_KEYS.filtersReset)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.before resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffBefore)
    expect(value).not.toBe(AUDIT_KEYS.diffBefore)
    expect(value.length).toBeGreaterThan(0)
  })

  test('diff.after resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.diffAfter)
    expect(value).not.toBe(AUDIT_KEYS.diffAfter)
    expect(value.length).toBeGreaterThan(0)
  })

  test('empty.title resolves to a non-key string', () => {
    const value = t(AUDIT_KEYS.emptyTitle)
    expect(value).not.toBe(AUDIT_KEYS.emptyTitle)
    expect(value.length).toBeGreaterThan(0)
  })

  test('pagination.page interpolates the {{page}} variable', () => {
    const value = t(AUDIT_KEYS.paginationPage, { page: 2 })
    expect(value).not.toBe(AUDIT_KEYS.paginationPage)
    expect(value).toContain('2')
    expect(value).not.toContain('{{page}}')
  })

  test('col.time returns the Armenian word "Ժամ"', () => {
    expect(t(AUDIT_KEYS.colTime)).toBe('Ժամ')
  })
})

// ---------------------------------------------------------------------------
// Cross-locale distinctness
// Proves three different bundles were actually loaded — not all the same text.
// col.time: "Время" (ru) / "Time" (en) / "Ժամ" (hy) — all distinct.
// ---------------------------------------------------------------------------

describe('audit namespace — cross-locale distinctness', () => {
  test('col.time value differs across all three locales', async () => {
    // Arrange
    const tRu = await useLocale('ru')
    const ruVal = tRu(AUDIT_KEYS.colTime)

    const tEn = await useLocale('en')
    const enVal = tEn(AUDIT_KEYS.colTime)

    const tHy = await useLocale('hy')
    const hyVal = tHy(AUDIT_KEYS.colTime)

    // Assert — all three must be distinct
    expect(ruVal).not.toBe(enVal)
    expect(enVal).not.toBe(hyVal)
    expect(ruVal).not.toBe(hyVal)

    // Spot-check known translations
    expect(ruVal).toBe('Время')
    expect(enVal).toBe('Time')
    expect(hyVal).toBe('Ժամ')
  })

  test('empty.title value differs across all three locales', async () => {
    // Arrange
    const tRu = await useLocale('ru')
    const ruVal = tRu(AUDIT_KEYS.emptyTitle)

    const tEn = await useLocale('en')
    const enVal = tEn(AUDIT_KEYS.emptyTitle)

    const tHy = await useLocale('hy')
    const hyVal = tHy(AUDIT_KEYS.emptyTitle)

    // Assert — all three must be distinct
    expect(ruVal).not.toBe(enVal)
    expect(enVal).not.toBe(hyVal)
    expect(ruVal).not.toBe(hyVal)

    expect(ruVal).toBe('Записей нет')
    expect(enVal).toBe('No entries')
    expect(hyVal).toBe('Գրառումներ չկան')
  })
})
