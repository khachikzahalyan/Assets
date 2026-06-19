# App Shell + UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Sequential dispatch, each implementer gated by test-engineer (PASS required to advance), then spec-reviewer → code-quality-reviewer → security-reviewer. Steps use checkbox (`- [ ]`) tracking.

**Goal:** Port the validated prototype shell library (`_shared/shell.js` + `shell.css`) into the production `assets-crm` codebase as a strict-TS, dark/orange-themed component set (primitives + shell parts + AuthContext + i18n + router stubs), navigable end-to-end.

**Architecture:** CVA-typed primitives emitting the prototype's exact Tailwind tokens; `lucide-react` registry replaces the CDN icon hack; react-router SPA replaces `window.location` cross-page nav; `AuthContext` (mock + dev role switcher) replaces the module-level user switcher; i18next (ru/en/hy) for Tier-1 chrome. Every non-Dashboard route renders a "Скоро" `StubPage`.

**Tech Stack:** React 19, TypeScript strict, Tailwind (CSS-var tokens already in place), `class-variance-authority`, `lucide-react`, `react-router-dom@7`, `i18next` + `react-i18next` + `i18next-browser-languagedetector`, Vitest + Testing Library.

**Source of truth for visuals:** `C:/Users/DELL/Desktop/Warehouse/prototypes/_shared/shell.js` (component bodies + class strings) and `shell.css` (sidebar/card/input classes). Port class strings VERBATIM unless a divergence below applies.

**Working dir:** `C:/Users/DELL/Desktop/assets-crm`. All paths absolute, forward slashes.

## Locked divergences (apply in every task)
1. **Icon** = `lucide-react` registry, NOT CDN/innerHTML/`useLayoutEffect`. Keep `<Icon name="kebab-case" size={n} className=.../>` API identical.
2. **Routing** = react-router. NO `ROUTE_URL`/`navigateToRoute`/`window.location.href`/`optimisticRoute`.
3. **Auth/role** = `AuthContext`. NO module-level `MOCK_USERS` switcher in components.
4. **Primitives** = CVA, exact prototype classes. Radix only for SearchPalette portal + (optionally) menus. Keep existing `src/components/ui/button.tsx`; `Btn` is canonical.
5. **i18n** = wire now. Tier-1 chrome via `t()`. ru = prototype Russian; en = real English; hy = English placeholder + `TODO` marker.
6. Role-filtered nav is **UX only** — annotate in code; not a security control.

## Dispatch order (sequential — orchestrator executes)
i18n-engineer (T1) → domain-modeler (T2) → react-ui-engineer (T3 primitives) → react-ui-engineer (T4 shell parts) → react-ui-engineer (T5 AppShell+router+pages) → firebase-engineer-or-react-ui (T6 AuthContext). Each task: implementer → test-engineer PASS → next. Reviews after all tasks.

> NOTE: T6 (AuthContext) is listed last for review-flow clarity, but T3–T5 depend on it. Build order resolves this: T2 defines the `Role`/`User` types and `AuthContext` *interface* (no provider yet); T6 supplies the provider + dev switcher + tests. T3–T5 consume the context hook `useAuth()` which exists from T2. If the implementer prefers, fold T6's provider into T2's task — acceptable as long as security-reviewer sees the final provider.

---

### Task 1: i18n init + locale resources

**Owner:** i18n-engineer.
**Files:**
- Create: `src/lib/i18n/index.ts` (replace the stub `export {}`)
- Create: `src/locales/ru/common.json`, `src/locales/ru/nav.json`
- Create: `src/locales/en/common.json`, `src/locales/en/nav.json`
- Create: `src/locales/hy/common.json`, `src/locales/hy/nav.json`
- Test: `src/lib/i18n/i18n.test.ts`

- [ ] **Step 1: Write `src/lib/i18n/index.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ruCommon from '@/locales/ru/common.json'
import ruNav from '@/locales/ru/nav.json'
import enCommon from '@/locales/en/common.json'
import enNav from '@/locales/en/nav.json'
import hyCommon from '@/locales/hy/common.json'
import hyNav from '@/locales/hy/nav.json'

export const SUPPORTED_LANGS = ['ru', 'en', 'hy'] as const
export type AppLang = (typeof SUPPORTED_LANGS)[number]

export const resources = {
  ru: { common: ruCommon, nav: ruNav },
  en: { common: enCommon, nav: enNav },
  hy: { common: hyCommon, nav: hyNav },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: ['common', 'nav'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ams.lang',
      caches: ['localStorage'],
    },
  })

// Keep <html lang> in sync for a11y + correct font shaping.
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
})

export default i18n
```

- [ ] **Step 2: Write `src/locales/ru/common.json`** (prototype Russian)

```json
{
  "app": { "name": "AMS", "brandSub": "v0.1 · Prototype", "title": "Asset Management System" },
  "actions": { "retry": "Повторить", "signOut": "Выйти", "profile": "Профиль", "settings": "Настройки", "openMenu": "Открыть меню", "close": "Закрыть" },
  "search": { "placeholder": "Поиск активов, сотрудников, филиалов…", "empty": "Ничего не найдено", "hint": "Введите запрос для поиска", "navigate": "навигация", "select": "выбрать", "kindAsset": "Актив", "kindEmployee": "Сотрудник", "kindBranch": "Филиал" },
  "lang": { "title": "Язык интерфейса", "ru": "Русский", "en": "English", "hy": "Հայերեն" },
  "states": { "emptyTitle": "Здесь пока пусто", "errorTitle": "Что-то пошло не так", "errorDesc": "Попробуйте обновить страницу или повторите действие через несколько секунд." },
  "stub": { "soon": "Скоро", "title": "Раздел в разработке", "desc": "Этот раздел появится в одном из следующих обновлений." },
  "breadcrumb": { "root": "AMS", "personal": "Личный кабинет" },
  "roleSwitcher": { "label": "Просмотр как…", "dev": "DEV" }
}
```

- [ ] **Step 3: Write `src/locales/ru/nav.json`** (group + item + route labels, role labels)

```json
{
  "groups": { "main": "Главное", "ops": "Активы и операции", "org": "Организация", "catalogs": "Справочники", "system": "Система" },
  "items": {
    "dashboard": "Дашборд", "assets": "Активы", "assignments": "Выдачи", "repairs": "Ремонты",
    "licenses": "Лицензии", "parts": "Запчасти", "employees": "Сотрудники", "branches": "Филиалы",
    "departments": "Отделы", "categories": "Категории", "statuses": "Статусы", "roles": "Роли и доступ",
    "audit": "Журнал аудита", "settings": "Настройки",
    "my-assets": "Мои активы", "my-acts": "Мои акты", "profile": "Профиль"
  },
  "roles": { "super_admin": "Супер Админ", "asset_admin": "Админ активов", "tech_admin": "Тех. Админ", "employee": "Сотрудник" }
}
```

- [ ] **Step 4: Write `src/locales/en/common.json` + `en/nav.json`** (real English: app.title "Asset Management System"; actions retry "Retry", signOut "Sign out", profile "Profile", settings "Settings", openMenu "Open menu", close "Close"; search placeholder "Search assets, employees, branches…", empty "Nothing found", hint "Type to search", navigate "navigate", select "select", kindAsset "Asset", kindEmployee "Employee", kindBranch "Branch"; lang.title "Interface language", ru "Русский", en "English", hy "Հայերեն"; states emptyTitle "Nothing here yet", errorTitle "Something went wrong", errorDesc "Try refreshing the page or repeat the action in a few seconds."; stub soon "Soon", title "Section under construction", desc "This section will arrive in an upcoming update."; breadcrumb root "AMS", personal "My workspace"; roleSwitcher label "View as…", dev "DEV". nav groups main "Main", ops "Assets & operations", org "Organization", catalogs "Catalogs", system "System"; items dashboard "Dashboard", assets "Assets", assignments "Assignments", repairs "Repairs", licenses "Licenses", parts "Parts", employees "Employees", branches "Branches", departments "Departments", categories "Categories", statuses "Statuses", roles "Roles & access", audit "Audit log", settings "Settings", my-assets "My assets", my-acts "My acts", profile "Profile"; roles super_admin "Super Admin", asset_admin "Asset Admin", tech_admin "Tech Admin", employee "Employee".)**

- [ ] **Step 5: Write `src/locales/hy/common.json` + `hy/nav.json`** — copy the English values verbatim as placeholders, and add at the TOP of each file a JSON-safe marker key `"_todo": "hy translations are English placeholders — schedule native Armenian review"`. (hy.lang.ru/en/hy keep the native names same as en.)

- [ ] **Step 6: Write `src/lib/i18n/i18n.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import i18n from './index'

describe('i18n', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })
  it('resolves a ru nav key', () => { expect(i18n.t('items.dashboard', { ns: 'nav' })).toBe('Дашборд') })
  it('switches to en', async () => { await i18n.changeLanguage('en'); expect(i18n.t('items.dashboard', { ns: 'nav' })).toBe('Dashboard') })
  it('switches to hy without throwing and returns a string', async () => { await i18n.changeLanguage('hy'); expect(typeof i18n.t('items.dashboard', { ns: 'nav' })).toBe('string') })
  it('falls back to ru for an unknown lng', async () => { await i18n.changeLanguage('zz'); expect(i18n.t('app.name')).toBe('AMS') })
})
```

- [ ] **Step 7: Run** `npx vitest run src/lib/i18n` — expect PASS. Then `npx tsc --noEmit` — clean.

- [ ] **Step 8: Commit** `git add -A && git commit -m "feat(i18n): init i18next ru/en/hy + locale resources"` (only if owner authorized commits; otherwise leave staged).

---

### Task 2: Domain types — Role, User, nav config, AuthContext interface

**Owner:** domain-modeler.
**Files:**
- Create: `src/config/roles.ts`
- Create: `src/config/nav.ts`
- Modify: `src/config/index.ts` (barrel export)
- Create: `src/contexts/AuthContext.tsx` (context + `useAuth` hook + types; provider stub that throws if no provider — real provider lands in T6, or fold T6 here)
- Modify: `src/contexts/index.ts` (barrel)
- Test: `src/config/nav.test.ts`

- [ ] **Step 1: `src/config/roles.ts`**

```ts
/** The four AMS roles. Order is display order. ru/en/hy labels live in nav.json under `roles`. */
export const ROLE_IDS = ['super_admin', 'asset_admin', 'tech_admin', 'employee'] as const
export type Role = (typeof ROLE_IDS)[number]

export interface RoleMeta { id: Role; short: string; accent: 'indigo' | 'emerald' | 'sky' | 'slate' }
export const ROLES: readonly RoleMeta[] = [
  { id: 'super_admin', short: 'СА', accent: 'indigo' },
  { id: 'asset_admin', short: 'АА', accent: 'emerald' },
  { id: 'tech_admin',  short: 'ТА', accent: 'sky' },
  { id: 'employee',    short: 'СО', accent: 'slate' },
]
```

- [ ] **Step 2: `src/config/nav.ts`** — port `ADMIN_NAV`/`EMPLOYEE_NAV`/`navForRole`/`defaultRouteForRole` from `shell.js` lines 82–148, typed. Labels become i18n KEYS (`labelKey`), not literals. Asset badge value comes from a prop later (NOT `window.AMS_MOCK`) — store `badgeKey?: 'assetsCount'` and let Sidebar resolve it, OR omit badges in this port (simpler — omit; document). Choose: **omit badges in v1** (no mock count source in production). Phase flags: mark Phase-2/3 routes with `phase: 2 | 3`.

```ts
import type { Role } from './roles'

export type RouteId =
  | 'dashboard' | 'assets' | 'assignments' | 'repairs' | 'licenses' | 'parts'
  | 'employees' | 'branches' | 'departments' | 'categories' | 'statuses' | 'roles'
  | 'audit' | 'settings' | 'my-assets' | 'my-acts' | 'profile'

export interface NavItem { id: RouteId; labelKey: string; icon: string; allow: Role[]; phase?: 2 | 3 }
export interface NavGroup { id: string; labelKey: string | null; items: NavItem[] }

export const ADMIN_NAV: NavGroup[] = [
  { id: 'main', labelKey: 'groups.main', items: [
    { id: 'dashboard', labelKey: 'items.dashboard', icon: 'layout-dashboard', allow: ['super_admin','asset_admin','tech_admin'] },
  ]},
  { id: 'ops', labelKey: 'groups.ops', items: [
    { id: 'assets',      labelKey: 'items.assets',      icon: 'package',          allow: ['super_admin','asset_admin','tech_admin'] },
    { id: 'assignments', labelKey: 'items.assignments', icon: 'arrow-right-left', allow: ['super_admin','asset_admin'], phase: 3 },
    { id: 'repairs',     labelKey: 'items.repairs',     icon: 'wrench',           allow: ['super_admin','tech_admin'],  phase: 2 },
    { id: 'licenses',    labelKey: 'items.licenses',    icon: 'key-round',        allow: ['super_admin','tech_admin'] },
    { id: 'parts',       labelKey: 'items.parts',       icon: 'package',          allow: ['super_admin','asset_admin','tech_admin'], phase: 2 },
  ]},
  { id: 'org', labelKey: 'groups.org', items: [
    { id: 'employees',   labelKey: 'items.employees',   icon: 'users',   allow: ['super_admin','asset_admin'] },
    { id: 'branches',    labelKey: 'items.branches',    icon: 'building',allow: ['super_admin','asset_admin'] },
    { id: 'departments', labelKey: 'items.departments', icon: 'network', allow: ['super_admin','asset_admin'] },
  ]},
  { id: 'catalogs', labelKey: 'groups.catalogs', items: [
    { id: 'categories', labelKey: 'items.categories', icon: 'tags',         allow: ['super_admin'] },
    { id: 'statuses',   labelKey: 'items.statuses',   icon: 'circle-dot',   allow: ['super_admin'] },
    { id: 'roles',      labelKey: 'items.roles',      icon: 'shield-check', allow: ['super_admin'] },
  ]},
  { id: 'system', labelKey: 'groups.system', items: [
    { id: 'audit',    labelKey: 'items.audit',    icon: 'history',  allow: ['super_admin'] },
    { id: 'settings', labelKey: 'items.settings', icon: 'settings', allow: ['super_admin'] },
  ]},
]

export const EMPLOYEE_NAV: NavGroup[] = [
  { id: 'employee', labelKey: null, items: [
    { id: 'my-assets', labelKey: 'items.my-assets', icon: 'package',     allow: ['employee'] },
    { id: 'my-acts',   labelKey: 'items.my-acts',   icon: 'file-text',   allow: ['employee'] },
    { id: 'profile',   labelKey: 'items.profile',   icon: 'user-circle', allow: ['employee'] },
  ]},
]

export function navForRole(role: Role): NavGroup[] {
  if (role === 'employee') return EMPLOYEE_NAV
  return ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter((it) => it.allow.includes(role)) }))
    .filter((g) => g.items.length > 0)
}

export function defaultRouteForRole(role: Role): RouteId {
  return role === 'employee' ? 'my-assets' : 'dashboard'
}

/** Routes deferred to Phase 2/3 — render a StubPage. Single source of truth. */
export const PHASE_STUB_ROUTES: RouteId[] = [
  'assignments','repairs','parts','branches','departments',
  'categories','statuses','roles','audit','settings','my-acts',
  // Feature pages not built yet (Phase 1 but later plans):
  'assets','licenses','employees','my-assets','profile',
]
```

- [ ] **Step 3: `src/contexts/AuthContext.tsx`** — context shape + `useAuth`. (Provider may be a stub here; T6 fills it. If folding T6 in, implement the full provider now per T6 Step 1.)

```ts
import { createContext, useContext } from 'react'
import type { Role } from '@/config/roles'

export interface AuthUser {
  id: string; name: string; email: string; role: Role
  initials: string; avatarColor: string
}
export interface AuthContextValue {
  user: AuthUser; role: Role; setRole: (r: Role) => void; signOut: () => void
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
```

- [ ] **Step 4: barrels** — `src/config/index.ts` re-exports roles + nav; `src/contexts/index.ts` re-exports AuthContext/useAuth/types.

- [ ] **Step 5: `src/config/nav.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { navForRole, defaultRouteForRole } from './nav'

describe('navForRole', () => {
  it('super_admin sees all 5 admin groups', () => { expect(navForRole('super_admin')).toHaveLength(5) })
  it('tech_admin does NOT see employees/branches', () => {
    const ids = navForRole('tech_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).not.toContain('employees'); expect(ids).toContain('repairs')
  })
  it('asset_admin sees employees but not repairs', () => {
    const ids = navForRole('asset_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).toContain('employees'); expect(ids).not.toContain('repairs')
  })
  it('employee gets flat IA with 3 items', () => {
    const nav = navForRole('employee')
    expect(nav).toHaveLength(1); expect(nav[0]!.items).toHaveLength(3)
  })
  it('filters out empty groups', () => {
    expect(navForRole('tech_admin').every((g) => g.items.length > 0)).toBe(true)
  })
  it('default route per role', () => {
    expect(defaultRouteForRole('employee')).toBe('my-assets')
    expect(defaultRouteForRole('super_admin')).toBe('dashboard')
  })
})
```

- [ ] **Step 6: Run** `npx vitest run src/config` + `npx tsc --noEmit` — both green. **Commit** (if authorized).

---

### Task 3: UI primitives (CVA, exact prototype tokens)

**Owner:** react-ui-engineer.
**Files (create each):**
- `src/components/ui/icon.tsx` · `chip.tsx` · `btn.tsx` · `icon-btn.tsx` · `section-card.tsx`
- `src/components/ui/field.tsx` · `input.tsx` · `select.tsx` · `badge.tsx` · `avatar.tsx`
- `src/components/ui/page-header.tsx` · `empty-state.tsx` · `loading-state.tsx` · `error-state.tsx`
- Modify: `src/components/ui/index.ts` (barrel — add all + keep existing button export)
- Test: `src/components/ui/primitives.test.tsx`

**Porting rules:** Use the EXACT class strings from `shell.js` (Chip 217–245, Btn 247–265, IconBtn 267–281, SectionCard 283–300, Field 302–312, Input 314–324, Select 326–335, Badge 337–350, Avatar 355–366, PageHeader 679–697, EmptyState 702–711, LoadingState 716–729, ErrorState 734–748). Convert each to a typed function component. Replace prototype hardcoded copy in ErrorState/EmptyState with `t()` from `react-i18next` (`useTranslation('common')`). All `[#hex]` arbitrary classes stay as-is (they match the locked dark/orange tokens).

- [ ] **Step 1: `icon.tsx`** — `lucide-react` registry. Build a name→component map covering every icon used by the shell (enumerate from shell.js + nav): `layout-dashboard, package, arrow-right-left, wrench, key-round, users, building, network, tags, circle-dot, shield-check, history, settings, file-text, user-circle, search, globe, chevron-down, chevron-right, check, log-out, menu, x, inbox, triangle-alert, refresh-cw, laptop, monitor, user`. Use `kebab → PascalCase` import. Provide a fallback (e.g. `HelpCircle`) for unknown names and warn in DEV.

```tsx
import {
  LayoutDashboard, Package, ArrowRightLeft, Wrench, KeyRound, Users, Building, Network,
  Tags, CircleDot, ShieldCheck, History, Settings, FileText, UserCircle, Search, Globe,
  ChevronDown, ChevronRight, Check, LogOut, Menu, X, Inbox, TriangleAlert, RefreshCw,
  Laptop, Monitor, User, HelpCircle, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const REGISTRY: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard, package: Package, 'arrow-right-left': ArrowRightLeft,
  wrench: Wrench, 'key-round': KeyRound, users: Users, building: Building, network: Network,
  tags: Tags, 'circle-dot': CircleDot, 'shield-check': ShieldCheck, history: History,
  settings: Settings, 'file-text': FileText, 'user-circle': UserCircle, search: Search,
  globe: Globe, 'chevron-down': ChevronDown, 'chevron-right': ChevronRight, check: Check,
  'log-out': LogOut, menu: Menu, x: X, inbox: Inbox, 'triangle-alert': TriangleAlert,
  'refresh-cw': RefreshCw, laptop: Laptop, monitor: Monitor, user: User,
}

export interface IconProps { name: string; size?: number; className?: string }
export function Icon({ name, size = 16, className }: IconProps) {
  const Cmp = REGISTRY[name] ?? HelpCircle
  if (!REGISTRY[name] && import.meta.env.DEV) console.warn(`[Icon] unknown name "${name}"`)
  return <Cmp size={size} className={cn('inline-block shrink-0 align-[-2px]', className)} strokeWidth={1.75} aria-hidden />
}
```

- [ ] **Step 2–13:** Port each remaining primitive verbatim (typed). Example `btn.tsx` keeps the prototype `variants`/`sizes` maps. `Chip` keeps the full color palette object. `Avatar` takes `{ user: { initials, avatarColor }, size }`. `Select` takes `options: { value: string; label: string }[]`. ErrorState/EmptyState use `useTranslation('common')` with defaults from `states.*`.

- [ ] **Step 14: barrel** — `src/components/ui/index.ts`:

```ts
export * from './icon'
export * from './chip'
export * from './btn'
export * from './icon-btn'
export * from './section-card'
export * from './field'
export * from './input'
export * from './select'
export * from './badge'
export * from './avatar'
export * from './page-header'
export * from './empty-state'
export * from './loading-state'
export * from './error-state'
export { Button, buttonVariants } from './button'
```

- [ ] **Step 15: `primitives.test.tsx`** — wrap renders in `<I18nextProvider i18n={i18n}>`. Assertions:
  - `Btn` renders children; `variant="primary"` includes `bg-[#F97316]`.
  - `Chip color="green"` includes emerald class; `dot` renders the dot span.
  - `Badge` renders count text.
  - `Avatar` renders initials text from `user.initials`.
  - `Input onChange` fires with the typed value (fireEvent.change).
  - `Select` renders one `<option>` per option + placeholder.
  - `SectionCard` shows title when not `noHeader`; hides header when `noHeader`.
  - `Icon name="package"` renders an `<svg>`; `name="zzz"` still renders an svg (fallback).
  - `EmptyState`/`ErrorState`/`LoadingState` render their root + (Error) retry button calls `onRetry`.

- [ ] **Step 16: Run** `npx vitest run src/components/ui` + `npx tsc --noEmit` — green. **Commit** (if authorized).

---

### Task 4: Shell parts — Sidebar, TopBar, Breadcrumbs, LanguageToggle, ProfileMenu, SearchPalette, TopbarSlotContext

**Owner:** react-ui-engineer.
**Files (create):**
- `src/components/common/TopbarSlotContext.tsx`
- `src/components/common/Sidebar.tsx`
- `src/components/common/Breadcrumbs.tsx`
- `src/components/common/LanguageToggle.tsx`
- `src/components/common/ProfileMenu.tsx`
- `src/components/common/SearchPalette.tsx`
- `src/components/common/TopBar.tsx`
- Modify: `src/components/common/index.ts` (barrel)
- Modify: `src/index.css` — append sidebar/card/input classes from `shell.css` (see Step 0)
- Test: `src/components/common/shell-parts.test.tsx`

- [ ] **Step 0: Append to `src/index.css`** the classes present in `shell.css` but MISSING from `index.css`: `.sidebar-overlay`, `.sidebar-drawer`, `.sidebar-section-label`, `.sidebar-item` (+`:hover`,`.is-active`), `.sidebar-item-badge` (+`.is-active` variant), `.card`, `.search-input`, `.input` (+states). Copy verbatim from `shell.css` lines 286–411 (they already reference our CSS vars). Do NOT touch existing `.app-shell-*` rules.

- [ ] **Step 1: `TopbarSlotContext.tsx`** — `createContext<{ setNode: (n: ReactNode) => void }>({ setNode: () => {} })` + a `useTopbarSlot()` helper that sets a node on mount and clears on unmount.

- [ ] **Step 2: `Sidebar.tsx`** — port shell.js 371–420. Props `{ currentRoute: RouteId; onNavigate: (r: RouteId) => void; mobile?: boolean; onClose?: () => void }`. Read `role` + brand from `useAuth()` and `useTranslation(['nav','common'])`. Resolve `group.labelKey`/`item.labelKey` via `t(key, { ns: 'nav' })`. Active = `currentRoute === item.id`. Add a small "Скоро" `Chip` (size sm) on items whose `phase` is set. Brand sub-line from `common:app.brandSub`. Annotate with a comment: "Role-filtered nav is UX only, not a security control."

- [ ] **Step 3: `Breadcrumbs.tsx`** — port 638–650. `{ items: string[] }`.

- [ ] **Step 4: `LanguageToggle.tsx`** — port 505–564. Use `useTranslation`; on change call `i18n.changeLanguage(id)`. Keep the click-outside/Esc effect. Labels from `common:lang.*`.

- [ ] **Step 5: `ProfileMenu.tsx`** — port 569–633. Read user from `useAuth()`. Include the **dev-only role switcher**: when `import.meta.env.DEV`, render a "Просмотр как…" (`common:roleSwitcher.label`) section listing the 4 roles; clicking calls `setRole(r)`. Sign-out item calls `signOut()`. Role label via `t(\`roles.\${role}\`, { ns: 'nav' })`.

- [ ] **Step 6: `SearchPalette.tsx`** — port 425–500 using `createPortal` (keep) OR Radix Dialog. Keep `SEARCH_MOCK` (move it into this file or `src/config/search.ts`). Copy via `common:search.*`. `onPick` navigates to the result's route (pass an `onPick` prop).

- [ ] **Step 7: `TopBar.tsx`** — port 655–674. Props `{ breadcrumbs: string[]; customContent?: ReactNode; onOpenSidebar: () => void }`. Renders hamburger (mobile), slot-or-breadcrumbs, **LanguageToggle + ProfileMenu** (prototype TopBar omitted LanguageToggle in the render — ADD it per owner brief, placed left of ProfileMenu). Read user from `useAuth()`.

- [ ] **Step 8: barrel** `src/components/common/index.ts` exports all of the above + (after T5) AppShell.

- [ ] **Step 9: `shell-parts.test.tsx`** — wrap in `<I18nextProvider>` + a mock `<AuthContext.Provider value={...}>` + `<MemoryRouter>` where needed:
  - `Sidebar` for `super_admin` shows "Дашборд" and a "Скоро" chip on a phase route; for `employee` shows "Мои активы" and NOT "Дашборд".
  - `LanguageToggle` opens on click, lists 3 languages, clicking EN calls `i18n.changeLanguage`.
  - `ProfileMenu` opens, shows the user name; in DEV shows the role switcher; clicking a role calls `setRole`.
  - `SearchPalette open` renders the input + mock results; typing filters; Esc/`onClose`.
  - `Breadcrumbs` renders the last item bold.

- [ ] **Step 10: Run** `npx vitest run src/components/common` + `npx tsc --noEmit` — green. **Commit** (if authorized).

---

### Task 5: AppShell + router + pages (StubPage, DashboardPage) + App wiring

**Owner:** react-ui-engineer.
**Files:**
- Create: `src/components/common/AppShell.tsx`
- Create: `src/pages/StubPage.tsx`
- Create: `src/pages/DashboardPage.tsx`
- Create: `src/config/routes.tsx`
- Modify: `src/config/index.ts` (export routes)
- Modify: `src/App.tsx` (providers + router + shell)
- Delete: `src/pages/ShellStub.tsx` AND update `src/App.test.tsx` (the old smoke test asserts "AMS — каркас готов" which no longer renders)
- Test: `src/components/common/app-shell.test.tsx`

- [ ] **Step 1: `AppShell.tsx`** — port shell.js 754–837 to react-router. NO `optimisticRoute`, NO `navigateToRoute`. `currentRoute` derived from `useLocation()` (`/assets` → `assets`, `/` → `defaultRouteForRole(role)`). `onNavigate(route)` = `useNavigate()` to `/${route}`. Keep: mobile drawer + overlay, Cmd+K effect opening SearchPalette, `TopbarSlotContext.Provider`, sidebar-close-on-route-change. Content area renders `children` (the routed `<Outlet/>`). Breadcrumbs = `[t(role==='employee' ? 'breadcrumb.personal' : 'breadcrumb.root', {ns:'common'}), t(\`items.\${currentRoute}\`, {ns:'nav'})]`. SearchPalette `onPick` navigates to the picked route.

- [ ] **Step 2: `StubPage.tsx`** — `PageHeader` (icon from route, title from `nav:items.<route>`, `count` omitted) + a centered `EmptyState` (icon `inbox`, title `common:stub.title`, desc `common:stub.desc`) + a "Скоро" `Chip`. Takes `routeId` from a route param or prop.

- [ ] **Step 3: `DashboardPage.tsx`** — minimal real content: `PageHeader` (icon `layout-dashboard`, title `nav:items.dashboard`) + a 3–4 `SectionCard` grid with placeholder KPI tiles (e.g. counts shown as "—"), so the default route is not a stub. Keep it lightweight (MVP dashboards are explicitly lightweight per spec).

- [ ] **Step 4: `routes.tsx`** — a flat route table consumed by `App`. `/` redirects to `defaultRouteForRole(role)`. `dashboard` → `DashboardPage`. Every id in `PHASE_STUB_ROUTES` → `<StubPage routeId=.../>`. Wildcard → redirect to default.

- [ ] **Step 5: `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import '@/lib/i18n'
import { AuthProvider } from '@/contexts'
import { AppShell } from '@/components/common'
import { DashboardPage, StubPage } from '@/pages'
import { PHASE_STUB_ROUTES } from '@/config'

function ShellLayout() {
  return <AppShell><Outlet /></AppShell>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {PHASE_STUB_ROUTES.map((id) => (
              <Route key={id} path={`/${id}`} element={<StubPage routeId={id} />} />
            ))}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```
(`AppShell` reads role to compute the real default redirect target; the `/` → `/dashboard` redirect is fine since employee role can be redirected inside AppShell or via a role-aware index — keep simple: AppShell's `currentRoute` derivation handles employee landing. If employee must land on my-assets, add a role-aware index redirect inside ShellLayout.)

- [ ] **Step 6: Update `src/App.test.tsx`** — replace the "каркас готов" assertions with: app mounts under providers; the sidebar brand "AMS" renders; the Dashboard heading renders; the `firebase exports` test stays. Keep the `vi.mock('@/lib/firebase')` and the react-router pass-through mock.

- [ ] **Step 7: Delete `src/pages/ShellStub.tsx`**; add `src/pages/index.ts` barrel exporting `DashboardPage`, `StubPage`.

- [ ] **Step 8: `app-shell.test.tsx`** — render `<App/>` (or AppShell with a provider): default route shows Dashboard; clicking a sidebar item navigates (assert the StubPage "Скоро"/title appears); switching role via ProfileMenu (DEV) changes the visible nav set; Cmd+K opens the SearchPalette.

- [ ] **Step 9: Run** `npx vitest run` (FULL suite) + `npx tsc --noEmit` + `npm run build` — all green. **Commit** (if authorized).

---

### Task 6: AuthProvider (mock user + dev role switcher) + tests

**Owner:** firebase-engineer (auth-adjacent) — or fold into Task 2. Security-reviewer gates this.
**Files:**
- Modify: `src/contexts/AuthContext.tsx` — add `AuthProvider`
- Test: `src/contexts/auth-context.test.tsx`

- [ ] **Step 1: Add `AuthProvider`** to `AuthContext.tsx`:

```tsx
import { useState, useMemo, useCallback, type ReactNode } from 'react'

/** MOCK identity — stands in until real Firebase onAuthStateChanged lands.
 *  NOT a security boundary. Role-filtered UI is UX only. */
const MOCK_USERS: Record<Role, AuthUser> = {
  super_admin: { id: 'u_001', name: 'Иван Петров',    email: 'i.petrov@example.com',   role: 'super_admin', initials: 'ИП', avatarColor: 'bg-[#F97316]' },
  asset_admin: { id: 'u_002', name: 'Анна Сидорова',  email: 'a.sidorova@example.com', role: 'asset_admin', initials: 'АС', avatarColor: 'bg-emerald-500' },
  tech_admin:  { id: 'u_003', name: 'Дмитрий Козлов', email: 'd.kozlov@example.com',   role: 'tech_admin',  initials: 'ДК', avatarColor: 'bg-sky-500' },
  employee:    { id: 'u_004', name: 'Сергей Иванов',  email: 's.ivanov@example.com',   role: 'employee',    initials: 'СИ', avatarColor: 'bg-slate-600' },
}

export function AuthProvider({ children, initialRole = 'super_admin' }: { children: ReactNode; initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole)
  const signOut = useCallback(() => { if (import.meta.env.DEV) console.info('[auth] signOut (mock)') }, [])
  const value = useMemo<AuthContextValue>(() => ({ user: { ...MOCK_USERS[role], role }, role, setRole, signOut }), [role, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

- [ ] **Step 2: `auth-context.test.tsx`** — render a probe consumer inside `<AuthProvider>`: shows `super_admin` user by default; calling `setRole('employee')` updates user name to "Сергей Иванов"; `useAuth` outside a provider throws.

- [ ] **Step 3: Run** `npx vitest run src/contexts` + full suite + typecheck — green. **Commit** (if authorized).

---

## Reviews (after all tasks pass test-engineer)
- **spec-reviewer**: matches this plan + the design spec; no scope creep; divergences applied; role matrix correct; Phase-2/3 stubs present; no feature pages built.
- **code-quality-reviewer**: CVA usage, no `firebase/*` imports in components, `lucide-react` (no CDN hack), i18n via `t()`, exact token classes, a11y on menus/dialog, no `any`.
- **security-reviewer**: ALWAYS for AMS. Verify role-filtered nav is annotated as UX-only; dev role switcher gated by `import.meta.env.DEV`; mock user not a prod auth bypass; no secrets/PII-real; `<html lang>` + lang id validation.

## Verification (Phase 6 gate — paste evidence)
- `npx vitest run` — all tests pass (existing 7 + new).
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.

## Self-review notes
- Spec coverage: primitives (T3), shell parts (T4), AppShell+router+stubs (T5), AuthContext (T2 iface + T6 provider), i18n+LanguageToggle (T1+T4), role matrix (T2). All design sections mapped.
- Decisions: badges OMITTED in v1 (no prod count source) — documented in T2. LanguageToggle ADDED to TopBar render (prototype omitted it) per owner brief — T4 Step 7. ShellStub deleted + App.test updated — T5 Step 6/7.
- Type consistency: `RouteId`, `Role`, `NavItem.labelKey`, `AuthUser`, `useAuth()` consistent across T2/T3/T4/T5/T6.
