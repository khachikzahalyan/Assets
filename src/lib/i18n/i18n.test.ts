import { describe, it, expect, beforeAll } from 'vitest'
import i18n from './index'

describe('i18n', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })
  it('resolves a ru nav key', () => { expect(i18n.t('items.dashboard', { ns: 'nav' })).toBe('Дашборд') })
  it('switches to en', async () => { await i18n.changeLanguage('en'); expect(i18n.t('items.dashboard', { ns: 'nav' })).toBe('Dashboard') })
  it('switches to hy without throwing and returns a string', async () => { await i18n.changeLanguage('hy'); expect(typeof i18n.t('items.dashboard', { ns: 'nav' })).toBe('string') })
  it('falls back to ru for an unknown lng', async () => { await i18n.changeLanguage('zz'); expect(i18n.t('app.name')).toBe('AMS') })
})

describe('employees namespace', () => {
  it.each(['ru', 'en', 'hy'] as const)('resolves employees.title in %s', async (lng) => {
    await i18n.changeLanguage(lng)
    expect(i18n.t('title', { ns: 'employees' })).toBeTruthy()
    expect(i18n.t('title', { ns: 'employees' })).not.toBe('title')
  })
})

describe('licenses namespace', () => {
  it.each(['ru', 'en', 'hy'] as const)('resolves licenses.title in %s to a non-key string', async (lng) => {
    await i18n.changeLanguage(lng)
    const value = i18n.t('title', { ns: 'licenses' })
    expect(value).toBeTruthy()
    expect(value).not.toBe('title')
    expect(value).not.toBe('licenses.title')
  })
})
