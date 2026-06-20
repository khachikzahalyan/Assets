import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ruCommon from '@/locales/ru/common.json'
import ruNav from '@/locales/ru/nav.json'
import ruLogin from '@/locales/ru/login.json'
import ruAccessPending from '@/locales/ru/access-pending.json'
import ruAssets from '@/locales/ru/assets.json'
import ruEmployees from '@/locales/ru/employees.json'
import ruPendingUsers from '@/locales/ru/pending-users.json'
import ruBranches from '@/locales/ru/branches.json'
import ruDepartments from '@/locales/ru/departments.json'
import ruCategories from '@/locales/ru/categories.json'
import ruStatuses from '@/locales/ru/statuses.json'
import ruAudit from '@/locales/ru/audit.json'
import ruLicenses from '@/locales/ru/licenses.json'
import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import enLogin from '@/locales/en/login.json'
import enAccessPending from '@/locales/en/access-pending.json'
import enAssets from '@/locales/en/assets.json'
import enEmployees from '@/locales/en/employees.json'
import enPendingUsers from '@/locales/en/pending-users.json'
import enBranches from '@/locales/en/branches.json'
import enDepartments from '@/locales/en/departments.json'
import enCategories from '@/locales/en/categories.json'
import enStatuses from '@/locales/en/statuses.json'
import enAudit from '@/locales/en/audit.json'
import enLicenses from '@/locales/en/licenses.json'
import hyCommon from '@/locales/hy/common.json'
import hyNav from '@/locales/hy/nav.json'
import hyLogin from '@/locales/hy/login.json'
import hyAccessPending from '@/locales/hy/access-pending.json'
import hyAssets from '@/locales/hy/assets.json'
import hyEmployees from '@/locales/hy/employees.json'
import hyPendingUsers from '@/locales/hy/pending-users.json'
import hyBranches from '@/locales/hy/branches.json'
import hyDepartments from '@/locales/hy/departments.json'
import hyCategories from '@/locales/hy/categories.json'
import hyStatuses from '@/locales/hy/statuses.json'
import hyAudit from '@/locales/hy/audit.json'
import hyLicenses from '@/locales/hy/licenses.json'

export const SUPPORTED_LANGS = ['ru', 'en', 'hy'] as const
export type AppLang = (typeof SUPPORTED_LANGS)[number]

export const resources = {
  ru: { common: ruCommon, nav: ruNav, login: ruLogin, 'access-pending': ruAccessPending, assets: ruAssets, employees: ruEmployees, 'pending-users': ruPendingUsers, branches: ruBranches, departments: ruDepartments, categories: ruCategories, statuses: ruStatuses, audit: ruAudit, licenses: ruLicenses },
  en: { common: enCommon, nav: enNav, login: enLogin, 'access-pending': enAccessPending, assets: enAssets, employees: enEmployees, 'pending-users': enPendingUsers, branches: enBranches, departments: enDepartments, categories: enCategories, statuses: enStatuses, audit: enAudit, licenses: enLicenses },
  hy: { common: hyCommon, nav: hyNav, login: hyLogin, 'access-pending': hyAccessPending, assets: hyAssets, employees: hyEmployees, 'pending-users': hyPendingUsers, branches: hyBranches, departments: hyDepartments, categories: hyCategories, statuses: hyStatuses, audit: hyAudit, licenses: hyLicenses },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'nav', 'login', 'access-pending', 'assets', 'employees', 'pending-users', 'branches', 'departments', 'categories', 'statuses', 'audit', 'licenses'],
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
