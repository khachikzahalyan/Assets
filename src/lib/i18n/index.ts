import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ruCommon from '@/locales/ru/common.json'
import ruNav from '@/locales/ru/nav.json'
import ruLogin from '@/locales/ru/login.json'
import ruAccessPending from '@/locales/ru/access-pending.json'
import ruAssets from '@/locales/ru/assets.json'
import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import enLogin from '@/locales/en/login.json'
import enAccessPending from '@/locales/en/access-pending.json'
import enAssets from '@/locales/en/assets.json'
import hyCommon from '@/locales/hy/common.json'
import hyNav from '@/locales/hy/nav.json'
import hyLogin from '@/locales/hy/login.json'
import hyAccessPending from '@/locales/hy/access-pending.json'
import hyAssets from '@/locales/hy/assets.json'

export const SUPPORTED_LANGS = ['ru', 'en', 'hy'] as const
export type AppLang = (typeof SUPPORTED_LANGS)[number]

export const resources = {
  ru: { common: ruCommon, nav: ruNav, login: ruLogin, 'access-pending': ruAccessPending, assets: ruAssets },
  en: { common: enCommon, nav: enNav, login: enLogin, 'access-pending': enAccessPending, assets: enAssets },
  hy: { common: hyCommon, nav: hyNav, login: hyLogin, 'access-pending': hyAccessPending, assets: hyAssets },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'nav', 'login', 'access-pending', 'assets'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ams.lang',
      caches: ['localStorage'],
    },
  })

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
})

export default i18n
