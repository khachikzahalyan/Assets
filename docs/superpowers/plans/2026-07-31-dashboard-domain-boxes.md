# Dashboard Domain Boxes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-31-dashboard-domain-boxes-design.md` (решения пользователя зафиксированы — следовать точно).

**Goal:** Реструктуризация Dashboard: KPI-ряд (5 StatCard) остаётся, все панели рядов 2–4 заменяются гридом из 6 доменных боксов (Активы, Сотрудники, Запчасти, Подписки, Филиалы, Отделы) с 7-дневным мини-баром, итогом, дельтой и лентой событий.

**Architecture:** Одно 7-дневное окно `audit_logs` + маленькое окно `part_movements` + count-агрегаты. Чистые reducer-функции в `src/domain/dashboard/reducers.ts` раскладывают окно по 6 боксам. Порт `DashboardRepository` получает 3 новых метода и теряет 3 старых. UI: один новый контейнер `DomainBox` (оболочка — существующий `SectionCard`) + крошечный `MiniBarChart`.

**Tech Stack:** React 19 + Vite + TS strict (`exactOptionalPropertyTypes` — conditional-spread для optional props), Firebase v9 modular, vitest + @testing-library/react, i18next (ru/en/hy), Tailwind в rem-токенах (px в компонентах запрещены).

**Жёсткие проектные правила (передаются каждому субагенту):**
1. НИКАКИХ git-операций (add/commit/push) — только по явному запросу пользователя.
2. Reuse-first: перед созданием чего-либо — поиск в `src/components`.
3. Скелетоны: точный footprint родителя, async-only shimmer, parent-level granularity.
4. Все размеры в rem (`--fs-*` токены / rem-классы), px запрещены.
5. Verify: `npm test -- --run` и `npm run build` (tsc -b строже `--noEmit`).

---

## Зафиксированные факты кодовой базы (проверены, НЕ перепроверять с нуля)

- `audit_logs.at` и `part_movements.at` пишутся `serverTimestamp()` → в Firestore это **Timestamp**. Window-запрос обязан сравнивать через `Timestamp.fromDate(new Date(sinceIso))` (см. комментарий и паттерн в `src/infra/repositories/firestoreAuditLogRepository.ts:57-66`). Сравнение с ISO-строкой молча вернёт 0 строк.
- `AuditLog.actorName?: string | null` существует (`src/domain/audit/types.ts:45`) — денормализован, на старых доках отсутствует. Fallback обязателен.
- `AuditEntityType` включает `'subscription'`; `AUDIT_ACTIONS` включает `'subscription_created'`.
- `Branch.name` / `Department.name` — обычные `string`, НЕ multi-lang объекты → `localize()` в ленте НЕ нужен (отступление от §4.4 спека, там он упомянут на всякий случай).
- **`/subscriptions` read в `firestore.rules:211-216` разрешён только `super_admin | tech_admin`** (PII-обоснование). Правку rules НЕ делаем. Следствие: `DomainCounts` поля типизируются `number | null`, `loadDomainCounts` деградирует per-count (asset_admin увидит «—» в итоге бокса Подписки; лента подписок у него работает — она из audit_logs, которые читают все 3 админ-роли).
- `audit_logs` read: `isAnyAdmin()` (все 3 роли) — ок. `part_movements` read: 3 админ-роли — ок. `parts`, `licenses`, `branches`, `departments` — читаемы админам. Rules менять не нужно.
- `PartMovement` (`src/domain/part/types.ts:64`): `{ type, skuId, qty, assetId, assetInvCode, note, at, ... }`; `MovementType = 'receive'|'install'|'uninstall'|'service'`. У part_movements НЕТ `actorName`.
- `SectionCard` (`src/components/ui/section-card.tsx`): props `{ title, icon, iconTone: 'blue'|'green'|'orange'|'violet'|'cyan'|'rose', action, children, bodyClassName }` — action-слот в шапке подходит под мини-бар.
- `canAccess(role, routeId)` — `src/config/access.ts`; RouteId'ы: `assets, employees, parts, licenses, branches, departments`. ВАЖНО: `licenses` разрешён только `super_admin|tech_admin` — ссылка «Все подписки» у asset_admin скроется автоматически.
- `useCachedResource, cacheIdentity` — `src/hooks/useCachedResource.ts` (SWR-кэш, остаётся).
- Хук зовётся из `DashboardPage` через `getSharedDashboardRepository()` (`src/infra/repositories/factories.ts:109`).
- Текущий `relativeTime` — локальная функция в `src/components/features/dashboard/ActivityPanel.tsx:11-22`; ключи `relTime.*` уже есть во всех 3 локалях.

## Карта файлов

| Файл | Действие | Задача |
|---|---|---|
| `src/domain/dashboard/types.ts` | +новые типы; −Assignment*/DashboardAuditRow (в T4) | T1, T4 |
| `src/domain/dashboard/reducers.ts` | +bucketByDay, groupDomainEvents, экстракторы; −mapAssignmentActivity, resolveTargetLabel (в T4) | T1, T4 |
| `src/domain/dashboard/reducers.domain-boxes.test.ts` | создать | T1 |
| `src/locales/{ru,en,hy}/dashboard.json` | +boxes.*; −сироты (T7) | T2, T7 |
| `src/components/features/dashboard/relativeTime.ts` | создать (вынос из ActivityPanel) | T3 |
| `src/components/features/dashboard/MiniBarChart.tsx` | создать | T3 |
| `src/components/features/dashboard/DomainBox.tsx` | создать | T3 |
| `src/components/features/dashboard/DomainBox.test.tsx` | создать | T3 |
| `src/components/features/dashboard/index.ts` | +новые экспорты; −legacy (T6) | T3, T6 |
| `src/domain/dashboard/DashboardRepository.ts` | 3 метода добавить, 3 удалить | T4 |
| `src/infra/repositories/firestoreDashboardRepository.ts` | новые методы, удалить старые | T4 |
| `src/infra/repositories/inMemoryDashboardRepository.ts` | новые методы + seed, удалить старые | T4 |
| `src/infra/repositories/*DashboardRepository.test.ts` | обновить | T4 |
| `src/hooks/useDashboard.ts` + `.test.ts` | переписать | T4 |
| `src/pages/dashboard/DashboardPage.tsx` + `.test.tsx` | T4: убрать ряды 2–4 (минимально, build green); T5: финальный вид | T4, T5 |
| 12 legacy-компонентов dashboard + `dashboard-components.test.tsx` | удалить/почистить после grep | T6 |
| `src/domain/dashboard/dashboard-types.test.ts` | обновить (убрать ссылки на удалённые типы) | T4 |

Точки ревью: **A** после T1–T3 (spec-reviewer → code-quality-reviewer), **B** после T4–T5, **C** после T6–T8 + финальный security-reviewer (read-only фича, rules не тронуты — лёгкий проход обязателен по правилам проекта).

---

### Task 1 — Домен: типы + reducers (+ тесты) · агент: domain-modeler, затем test-engineer

**Files:**
- Modify: `src/domain/dashboard/types.ts` (только ДОБАВЛЕНИЯ — удаления старых типов в T4, чтобы build оставался зелёным)
- Modify: `src/domain/dashboard/reducers.ts` (только добавления)
- Create: `src/domain/dashboard/reducers.domain-boxes.test.ts`

- [x] **Step 1.1: Добавить типы в `types.ts`** (после существующих объявлений; `DashboardData` пока НЕ трогать):

```ts
// ── Domain boxes (dashboard redesign 2026-07-31) ──────────────────────────────

export type DomainBoxKey = 'assets' | 'employees' | 'parts' | 'subscriptions' | 'branches' | 'departments'

export const DOMAIN_BOX_KEYS: readonly DomainBoxKey[] = [
  'assets', 'employees', 'parts', 'subscriptions', 'branches', 'departments',
]

/** Одна строка ленты бокса. */
export interface DomainEventVM {
  id: string                  // auditId | movementId
  primary: string             // label сущности / запчасти (fallback-цепочка, никогда не пустой)
  secondary: string | null    // actorName (у part_movements всегда null)
  at: string                  // ISO
  linkTo?: string             // маршрут; страница убирает при отсутствии canAccess
}

export interface DomainBoxData {
  key: DomainBoxKey
  delta7d: number
  days: number[]              // ровно 7, [0]=6 дней назад … [6]=сегодня
  events: DomainEventVM[]     // ≤ 6, desc
}

/**
 * Поля nullable per-count: /subscriptions read закрыт для asset_admin
 * (firestore.rules PII-обоснование) — счётчик деградирует в null («—» в UI),
 * остальные боксы живут. Отступление от спека §4.5 зафиксировано в плане.
 */
export interface DomainCounts {
  partsUnits: number | null
  branches: number | null
  departments: number | null
  subscriptions: number | null   // subscriptions count + licenses(type=='Subscription') count
}

/** Результат loadDomainCounts: счётчики + карта имён SKU (каталог parts уже прочитан для Σ onHand). */
export interface DomainCountsResult {
  counts: DomainCounts
  partNames: Record<string, string>
}
```

- [x] **Step 1.2: Добавить reducers в `reducers.ts`** (импорты `PartMovement` из `@/domain/part`, новые типы из `./types`):

```ts
export const DASHBOARD_WINDOW_DAYS = 7
export const DASHBOARD_EVENTS_PER_BOX = 6
export const DASHBOARD_AUDIT_CAP = 250
export const DASHBOARD_MOVEMENTS_CAP = 200

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Бакетирование по ЛОКАЛЬНОМУ календарному дню: 7 бакетов, [6]=сегодня.
 * Math.round поглощает сдвиг DST (±1ч). Невалидные и вне-оконные даты игнорируются.
 */
export function bucketByDay(ats: readonly string[], now: Date = new Date()): number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0]
  const today = startOfLocalDay(now)
  for (const iso of ats) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    const diff = Math.round((today - startOfLocalDay(d)) / 86_400_000)
    if (diff >= 0 && diff <= 6) buckets[6 - diff]! += 1
  }
  return buckets
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Активы: «{brand} {model}» → invCode → entityId. */
export function assetEventLabel(log: AuditLog): string {
  const a = log.after
  const bm = [str(a?.brand), str(a?.model)].filter(Boolean).join(' ')
  return bm || str(a?.invCode) || log.entityId
}

/** Сотрудники: «{lastName} {firstName}» → email → entityId. */
export function employeeEventLabel(log: AuditLog): string {
  const a = log.after
  const name = [str(a?.lastName), str(a?.firstName)].filter(Boolean).join(' ')
  return name || str(a?.email) || log.entityId
}

/** Подписки/Филиалы/Отделы: after.name → entityId (name — plain string в этой кодовой базе). */
export function namedEntityEventLabel(log: AuditLog): string {
  return str(log.after?.name) || log.entityId
}

/** Запчасти: «{skuName|note|skuId} ×{qty} → {assetInvCode}». */
export function partInstallLabel(m: PartMovement, partNames: Record<string, string>): string {
  const name = partNames[m.skuId] ?? (m.note?.trim() || m.skuId)
  const target = m.assetInvCode ? ` → ${m.assetInvCode}` : ''
  return `${name} ×${m.qty}${target}`
}

/** Подписочное событие: строго Subscription (Windows/OEM/Volume/Retail/Default отсекаются). */
export function isSubscriptionEvent(l: AuditLog): boolean {
  if (l.entityType === 'subscription' && l.action === 'subscription_created') return true
  return l.entityType === 'license' && l.action === 'created' && str(l.after?.type) === 'Subscription'
}

export interface GroupDomainEventsInput {
  auditLogs: readonly AuditLog[]        // 7-дневное окно
  partInstalls: readonly PartMovement[] // 7-дневное окно, type==='install' (в т.ч. serviceReplace)
  partNames: Record<string, string>     // skuId → имя SKU
  now?: Date
}

const LIST_ROUTE: Record<Exclude<DomainBoxKey, 'assets'>, string> = {
  employees: '/employees', parts: '/parts', subscriptions: '/licenses',
  branches: '/branches', departments: '/departments',
}

/**
 * Раскладка 7-дневного окна по 6 боксам (спек §4.3):
 *   assets: entityType==='asset' && action==='created'
 *   employees: 'employee' + 'created' · branches: 'branch' + 'created'
 *   departments: 'department' + 'created' · subscriptions: isSubscriptionEvent
 *   parts: partInstalls (уже отфильтрованы адаптером до type==='install')
 * Дельта = все события окна; лента = первые 6 desc; days = bucketByDay(все).
 */
export function groupDomainEvents(input: GroupDomainEventsInput): Record<DomainBoxKey, DomainBoxData> {
  const now = input.now ?? new Date()

  function fromAudit(
    key: Exclude<DomainBoxKey, 'parts'>,
    match: (l: AuditLog) => boolean,
    label: (l: AuditLog) => string,
  ): DomainBoxData {
    const matched = input.auditLogs.filter(match)
      .sort((a, b) => b.at.localeCompare(a.at))
    const events = matched.slice(0, DASHBOARD_EVENTS_PER_BOX).map(l => ({
      id: l.id,
      primary: label(l),
      secondary: l.actorName?.trim() || null,
      at: l.at,
      linkTo: key === 'assets' ? `/assets/${l.entityId}` : LIST_ROUTE[key],
    }))
    return { key, delta7d: matched.length, days: bucketByDay(matched.map(l => l.at), now), events }
  }

  const installs = [...input.partInstalls].sort((a, b) => b.at.localeCompare(a.at))
  const parts: DomainBoxData = {
    key: 'parts',
    delta7d: installs.length,
    days: bucketByDay(installs.map(m => m.at), now),
    events: installs.slice(0, DASHBOARD_EVENTS_PER_BOX).map(m => ({
      id: m.id,
      primary: partInstallLabel(m, input.partNames),
      secondary: null,
      at: m.at,
      linkTo: LIST_ROUTE.parts,
    })),
  }

  return {
    assets: fromAudit('assets', l => l.entityType === 'asset' && l.action === 'created', assetEventLabel),
    employees: fromAudit('employees', l => l.entityType === 'employee' && l.action === 'created', employeeEventLabel),
    parts,
    subscriptions: fromAudit('subscriptions', isSubscriptionEvent, namedEntityEventLabel),
    branches: fromAudit('branches', l => l.entityType === 'branch' && l.action === 'created', namedEntityEventLabel),
    departments: fromAudit('departments', l => l.entityType === 'department' && l.action === 'created', namedEntityEventLabel),
  }
}
```

Примечание для агента: `DomainEventVM.linkTo` — optional; при `exactOptionalPropertyTypes` объект-литерал с явным `linkTo: string` валиден (всегда строка в reducer'е). НЕ присваивать `undefined`.

- [x] **Step 1.3 (test-engineer): `reducers.domain-boxes.test.ts`** — минимум:
  - `bucketByDay`: пустой массив → `[0×7]`; событие «сегодня» → `[...,1]`; «6 дней назад» → `[1,...]`; «8 дней назад» и невалидный ISO игнорируются; фиксированный `now` в каждом тесте (никаких real-time зависимостей); граница локального дня (23:59 вчера → бакет [5]).
  - `groupDomainEvents`: маппинг всех 6 боксов; subscription-фильтр — `license+created+after.type='Subscription'` попадает, `'OEM'|'Retail'|'Volume'|'Default'` НЕ попадают; `subscription_created` попадает; cap ленты = 6 при 8 событиях (delta7d=8); сортировка desc; fallback-цепочки label'ов (brand+model → invCode → entityId; lastName+firstName → email → entityId; partNames → note → skuId); `secondary` = actorName / null при отсутствии; `linkTo` = `/assets/{id}` для активов, списочные для остальных.
- [x] **Step 1.4: Запустить** `npm test -- --run src/domain/dashboard` → PASS; `npm run build` → зелёный.

### Task 2 — i18n: добавить boxes.* (ru/en/hy) · агент: i18n-engineer

**Files:** Modify `src/locales/ru/dashboard.json`, `src/locales/en/dashboard.json`, `src/locales/hy/dashboard.json` (ТОЛЬКО добавления; чистка сирот — Task 7).

- [x] **Step 2.1: Добавить блок `boxes` во все 3 локали** (ru как в спеке §8):

```jsonc
// ru
"boxes": {
  "assets":        { "title": "Активы",     "viewAll": "Все активы" },
  "employees":     { "title": "Сотрудники", "viewAll": "Все сотрудники" },
  "parts":         { "title": "Запчасти",   "viewAll": "Все запчасти" },
  "subscriptions": { "title": "Подписки",   "viewAll": "Все подписки" },
  "branches":      { "title": "Филиалы",    "viewAll": "Все филиалы" },
  "departments":   { "title": "Отделы",     "viewAll": "Все отделы" },
  "delta7d": "+{{n}} за 7 дней",
  "empty": "Нет событий за 7 дней",
  "partsUnits": "единиц на складе"
}
// en
"boxes": {
  "assets":        { "title": "Assets",        "viewAll": "All assets" },
  "employees":     { "title": "Employees",     "viewAll": "All employees" },
  "parts":         { "title": "Parts",         "viewAll": "All parts" },
  "subscriptions": { "title": "Subscriptions", "viewAll": "All subscriptions" },
  "branches":      { "title": "Branches",      "viewAll": "All branches" },
  "departments":   { "title": "Departments",   "viewAll": "All departments" },
  "delta7d": "+{{n}} in 7 days",
  "empty": "No events in the last 7 days",
  "partsUnits": "units in stock"
}
// hy
"boxes": {
  "assets":        { "title": "Ակտիվներ",              "viewAll": "Բոլոր ակտիվները" },
  "employees":     { "title": "Աշխատակիցներ",          "viewAll": "Բոլոր աշխատակիցները" },
  "parts":         { "title": "Պահեստամասեր",          "viewAll": "Բոլոր պահեստամասերը" },
  "subscriptions": { "title": "Բաժանորդագրություններ", "viewAll": "Բոլոր բաժանորդագրությունները" },
  "branches":      { "title": "Մասնաճյուղեր",          "viewAll": "Բոլոր մասնաճյուղերը" },
  "departments":   { "title": "Բաժիններ",              "viewAll": "Բոլոր բաժինները" },
  "delta7d": "+{{n}} 7 օրում",
  "empty": "Վերջին 7 օրում իրադարձություններ չկան",
  "partsUnits": "միավոր պահեստում"
}
```

Ключ `installEvent` из спека НЕ добавлять — `×{qty}` собирается в label-экстракторе (YAGNI). Алфавитный порядок ключей внутри файла соблюдать, если он там принят (сверить с фактическим файлом).

- [x] **Step 2.2:** `npm test -- --run` (i18n-parity тесты, если есть) → PASS.

### Task 3 — UI: relativeTime + MiniBarChart + DomainBox (+ тесты) · агент: react-ui-engineer, затем test-engineer

**Files:**
- Create: `src/components/features/dashboard/relativeTime.ts`
- Create: `src/components/features/dashboard/MiniBarChart.tsx`
- Create: `src/components/features/dashboard/DomainBox.tsx`
- Create: `src/components/features/dashboard/DomainBox.test.tsx`
- Modify: `src/components/features/dashboard/index.ts` (добавить экспорты; legacy пока НЕ трогать)

- [x] **Step 3.1: `relativeTime.ts`** — дословный вынос из `ActivityPanel.tsx:10-22` (сигнатура `relativeTime(iso: string, t: TFunction, now = new Date()): string`, ключи `relTime.*`). `ActivityPanel` НЕ переписывать (умрёт в T6).

- [x] **Step 3.2: `MiniBarChart.tsx`** — presentational, ~30 строк:

```tsx
export interface MiniBarChartProps {
  /** Ровно 7 значений; [0]=6 дней назад … [6]=сегодня. */
  days: number[]
  /** Tailwind bg-класс столбика (акцент бокса), напр. 'bg-sky-400/70'. */
  barClass: string
  /** title-атрибут на столбик: «дата · N» (готовит вызывающий). */
  titles?: string[]
  testId?: string
}
```
Рендер: `flex items-end gap-[0.1875rem] h-6` (1.5rem); столбик `w-1.5 rounded-sm` (0.375rem); нулевой день — «точка» `h-0.5` (0.125rem) цветом `bg-border`; ненулевой — `barClass`, высота `style={{ height: `${Math.max(15, (v / max) * 100)}%` }}` где `max = Math.max(1, ...days)`. `title` через conditional-spread: `{...(titles?.[i] !== undefined ? { title: titles[i] } : {})}` (exactOptionalPropertyTypes). Никаких px.

- [x] **Step 3.3: `DomainBox.tsx`** — props строго по спеку §3.3 + `totalCaption`:

```tsx
export interface DomainBoxProps {
  icon: string
  iconTone?: SectionCardProps['iconTone']
  title: string
  total: number | null        // null → «—»
  delta7d: number
  days: number[]
  events: DomainEventVM[]
  barClass: string            // цвет мини-бара (передаёт страница, в паре с iconTone)
  viewAllTo?: string          // undefined → ссылка не рендерится
  viewAllLabel: string
  emptyLabel: string
  totalCaption?: string       // подпись под итогом (бокс Запчасти: boxes.partsUnits)
  testId?: string
}
```
Структура (reuse-first):
- Оболочка — `SectionCard` с `icon`, `iconTone`, `title`, `action={<MiniBarChart days={days} barClass={barClass} titles={…}/>}`. `iconTone` прокидывать conditional-spread'ом.
- `titles` мини-бара: локальная дата `new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })` для дня `i` (от `now - (6-i)д`) + ` · ${days[i]}`.
- Тело: строка итога — крупное число (те же классы значения, что у `StatCard` — свериться и переиспользовать масштаб, всё в rem) + чип `t('boxes.delta7d', { n: delta7d })`; при `delta7d === 0` чип приглушён (`text-text-subtle`), НЕ скрыт (строка не прыгает). `total === null` → `—`. `totalCaption` — `text-11 text-text-subtle` под/рядом с числом.
- Лента: ≤6 строк, каждая `min-h-11` (2.75rem тач-цель): primary `text-12.5 text-text-primary truncate`, secondary `text-11 text-text-subtle truncate` (рендер только если не null), справа `relativeTime(ev.at, t)` `text-10.5 text-text-subtle tabular-nums flex-shrink-0`. Строка с `linkTo` — `<Link>` с hover/focus-visible паттерном из `ActivityPanel.tsx:86`; без — `<div>`.
- Пусто: `events.length === 0` → `EmptyState icon="history" title={emptyLabel}` (итог и мини-бар всё равно видны).
- Footer при `viewAllTo`: мобайл — full-width outlined `<Link>` (класс-паттерн `ActivityPanel.tsx:98-103`, `lg:hidden`); десктоп — right-aligned текстовая ссылка (`ActivityPanel.tsx:106-113`, `hidden lg:block`). Метка — `viewAllLabel`.
- `useTranslation('dashboard')` внутри — только для `boxes.delta7d` и `relTime.*`; всё остальное через props.

- [x] **Step 3.4:** Экспортировать `DomainBox`, `DomainBoxProps`, `MiniBarChart`, `MiniBarChartProps`, `relativeTime` из `index.ts` (секция «New redesigned components»).

- [x] **Step 3.5 (test-engineer): `DomainBox.test.tsx`** — рендер итога/дельты; `total=null` → «—»; empty state при `events=[]` с видимым мини-баром; `viewAllTo` отсутствует → ссылки «Все …» нет; строка с `linkTo` — ссылка, без — нет; `MiniBarChart`: 7 элементов, нулевой день — точка. i18n-render тест: `boxes.delta7d` резолвится в ru/en/hy (существующий паттерн).
- [x] **Step 3.6:** `npm test -- --run src/components/features/dashboard` → PASS; `npm run build` → зелёный.

**ТОЧКА РЕВЬЮ A:** spec-reviewer → code-quality-reviewer по T1–T3. FAIL → возврат соответствующему агенту.

### Task 4 — Данные: порт + 2 адаптера + хук + строгие удаления + rules-верификация · агент: firebase-engineer, затем test-engineer

**Files:**
- Modify: `src/domain/dashboard/DashboardRepository.ts`
- Modify: `src/domain/dashboard/types.ts` (теперь удаления + новый `DashboardData`)
- Modify: `src/domain/dashboard/reducers.ts` (удалить `mapAssignmentActivity`, `resolveTargetLabel`, `AssetActivityInfo`, `EmployeeActivityInfo` — перед удалением grep по `src/` на внешние импорты)
- Modify: `src/infra/repositories/firestoreDashboardRepository.ts`, `inMemoryDashboardRepository.ts` + их тесты
- Modify: `src/hooks/useDashboard.ts` + `useDashboard.test.ts`
- Modify: `src/pages/dashboard/DashboardPage.tsx` + `DashboardPage.test.tsx` (МИНИМАЛЬНО: выпилить ряды 2–4, их импорты и `statuses`-массив; страница временно = error + KPI-ряд; скелетон рядов 2–4 удалить; финальный вид — T5)
- Modify: `src/domain/dashboard/dashboard-types.test.ts` (убрать ссылки на удалённые типы)

- [ ] **Step 4.1: Порт `DashboardRepository`** (финальный вид):

```ts
import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part'
import type { AssetStats, WorkstationLicenseStats, PeopleStats, DomainCountsResult } from './types'

export interface DashboardRepository {
  loadAssetStats(topBranches?: number): Promise<AssetStats>
  loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats>
  loadPeopleStats(): Promise<PeopleStats>
  /** Окно audit_logs: at >= since (Timestamp!), desc, limit cap (умолч. DASHBOARD_AUDIT_CAP). */
  loadRecentEvents(sinceIso: string, cap?: number): Promise<AuditLog[]>
  /** Окно part_movements: at >= since, desc, limit cap; клиентский фильтр type==='install' (композитный индекс сознательно не заводим). */
  loadRecentPartInstalls(sinceIso: string, cap?: number): Promise<PartMovement[]>
  /** Count-агрегаты + карта имён SKU. Per-count деградация в null (subscriptions у asset_admin). */
  loadDomainCounts(): Promise<DomainCountsResult>
}
```
Удалить: `loadAssignmentActivity`, `loadServerLicenseCount`, `loadRecentAuditRows`.

- [ ] **Step 4.2: `types.ts` — удаления + новый контракт.** Удалить `AssignmentActivityRow`, `AssignmentActivity`, `DashboardAuditRow` (grep перед удалением). `DashboardData` →

```ts
export interface DashboardData {
  assets: AssetStats | null
  workstationLicenses: WorkstationLicenseStats | null
  people: PeopleStats | null
  counts: DomainCounts | null
  boxes: Record<DomainBoxKey, DomainBoxData> | null
}
```

- [ ] **Step 4.3: Firestore-адаптер.** Импортировать `Timestamp, getCountFromServer` из `firebase/firestore`. Удалить `loadAssignmentActivity`, `loadServerLicenseCount`, `loadRecentAuditRows` и их вспомогательный код (asset/employee/user дочитывания). `toAuditLog` ДОПОЛНИТЬ маппингом `actorName`: `actorName: (x.actorName as string | null | undefined) ?? null`. Новые методы:

```ts
async loadRecentEvents(sinceIso: string, cap = DASHBOARD_AUDIT_CAP): Promise<AuditLog[]> {
  const snap = await getDocs(fsQuery(
    collection(this.db, 'audit_logs'),
    where('at', '>=', Timestamp.fromDate(new Date(sinceIso))),
    orderBy('at', 'desc'),
    fsLimit(cap),
  ))
  return snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
}

async loadRecentPartInstalls(sinceIso: string, cap = DASHBOARD_MOVEMENTS_CAP): Promise<PartMovement[]> {
  const snap = await getDocs(fsQuery(
    collection(this.db, 'part_movements'),
    where('at', '>=', Timestamp.fromDate(new Date(sinceIso))),
    orderBy('at', 'desc'),
    fsLimit(cap),
  ))
  return snap.docs
    .map(d => this.toMovement(d.id, d.data() as Record<string, unknown>))
    .filter(m => m.type === 'install')
}

async loadDomainCounts(): Promise<DomainCountsResult> {
  const [branches, departments, subs, subLics, partsSnap] = await Promise.allSettled([
    getCountFromServer(fsQuery(collection(this.db, 'branches'), /* фильтр active — сверить с BranchesPage, см. прим. */)),
    getCountFromServer(collection(this.db, 'departments')),
    getCountFromServer(collection(this.db, 'subscriptions')),
    getCountFromServer(fsQuery(collection(this.db, 'licenses'), where('type', '==', 'Subscription'))),
    getDocs(collection(this.db, 'parts')),
  ])

  let partsUnits: number | null = null
  const partNames: Record<string, string> = {}
  if (partsSnap.status === 'fulfilled') {
    partsUnits = 0
    for (const d of partsSnap.value.docs) {
      const x = d.data() as Record<string, unknown>
      partsUnits += Number(x.onHand ?? 0)
      partNames[d.id] = String(x.name ?? '').trim() || d.id
    }
  }

  const count = (r: PromiseSettledResult<AggregateQuerySnapshot<{ count: AggregateField<number> }>>) =>
    r.status === 'fulfilled' ? r.value.data().count : null

  const subsCount = count(subs)
  const subLicCount = count(subLics)

  return {
    counts: {
      partsUnits,
      branches: count(branches),
      departments: count(departments),
      subscriptions: subsCount !== null && subLicCount !== null ? subsCount + subLicCount : null,
    },
    partNames,
  }
}
```
`toMovement(id, x)`: маппинг док→`PartMovement` — СНАЧАЛА проверить `src/infra/repositories/firestorePartsRepository.ts`: если там есть переиспользуемый/экспортируемый маппер — использовать его; иначе локальный приватный метод по образцу (поля из `src/domain/part/types.ts:64-87`, `at: toIso(x.at)`). Фильтр «активных» филиалов: открыть страницу/репозиторий филиалов и повторить ТО ЖЕ условие, что использует список филиалов (спек: «status=='active' — как принято на странице филиалов»); если страница не фильтрует по статусу — считать все и зафиксировать в комментарии.

- [ ] **Step 4.4: inMemory-адаптер.** Seed →

```ts
export interface InMemoryDashboardSeed {
  assets: Asset[]
  ref: AssetReferenceData
  workstationLicenses: WorkstationLicense[]
  employeeCount: number
  auditLogs: AuditLog[]
  parts?: Part[]                    // каталог SKU: onHand + имена
  partMovements?: PartMovement[]
  subscriptionCount?: number
}
```
(удалить `serverLicenseCount`, `users`). Методы: `loadRecentEvents` — фильтр `at >= sinceIso` (строковое сравнение ISO допустимо в памяти), sort desc, slice(cap); `loadRecentPartInstalls` — то же + `type==='install'`; `loadDomainCounts` — `partsUnits = Σ parts.onHand`, `partNames` из `parts`, `branches = ref.branches.length`, `departments = ref.departments.length`, `subscriptions = (subscriptionCount ?? 0) + workstationLicenses.filter(l => l.type === 'Subscription').length`. Все значения number (не null) — inMemory не деградирует.

- [ ] **Step 4.5: Хук `useDashboard`** — полная замена тела загрузчика (кэш-обвязка `useCachedResource` остаётся):

```ts
const EMPTY: DashboardData = {
  assets: null, workstationLicenses: null, people: null, counts: null, boxes: null,
}
// Ролевой гейтинг вызовов удалён: все 6 методов зовутся для всех 3 админ-ролей (решение №5).
// role остаётся в сигнатуре и cache key (кэш на смену роли).
const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 86_400_000).toISOString()
const [assets, lic, people, events, installs, countsRes] = await Promise.allSettled([
  repo.loadAssetStats(5),
  repo.loadWorkstationLicenseStats(),
  repo.loadPeopleStats(),
  repo.loadRecentEvents(since),
  repo.loadRecentPartInstalls(since),
  repo.loadDomainCounts(),
])
// fulfilled → присвоить; rejected → anyError = true (кроме countsRes: его rejected тоже anyError, counts остаётся null)
// boxes считаются ТОЛЬКО если events fulfilled (спек §6.3: упал loadRecentEvents → boxes=null):
if (events.status === 'fulfilled') {
  next.boxes = groupDomainEvents({
    auditLogs: events.value,
    partInstalls: installs.status === 'fulfilled' ? installs.value : [],
    partNames: countsRes.status === 'fulfilled' ? countsRes.value.partNames : {},
  })
}
if (countsRes.status === 'fulfilled') next.counts = countsRes.value.counts
```
`permissions()` удалить целиком. Derive `currentlyOut` удалить (поле ушло вместе с `assignments`).

- [ ] **Step 4.6: Минимальный патч `DashboardPage.tsx`:** удалить импорты/JSX `StatusBars, GroupBars, BranchBars, LicensePanel, ActivityPanel, AuditTable, AUDIT_GRID`, массив `statuses`, ряды 2–4 и их скелетоны (скелетон = только KPI-ряд временно). KPI-ряд и error-блок не трогать. `DashboardPage.test.tsx` — убрать/адаптировать тесты удалённых рядов.
- [ ] **Step 4.7: Rules-верификация (read-only, спек §5):** прочитать `firestore.rules` и подтвердить в отчёте: `audit_logs` read — 3 админ-роли; `part_movements` — 3; `parts`, `licenses`, `branches`, `departments` — читаемы 3 админ-ролям; `subscriptions` — только SA+tech (задокументированная деградация). НИКАКИХ правок rules.
- [ ] **Step 4.8 (test-engineer):** обновить `firestoreDashboardRepository.test.ts` (мок-тесты окна: `where('at','>=',Timestamp)`, `orderBy desc`, `limit`; клиентский фильтр install; count-агрегаты + per-count деградация), `inMemoryDashboardRepository.test.ts` (новые методы, удалённые — убраны), `useDashboard.test.ts` (все 6 методов зовутся для каждой из 3 админ-ролей; boxes=null при падении loadRecentEvents; counts=null при падении loadDomainCounts; anyError-флаги), `dashboard-types.test.ts`.
- [ ] **Step 4.9:** `npm test -- --run` → PASS; `npm run build` → зелёный.

### Task 5 — DashboardPage: финальный вид (грид 6 боксов + скелетон) · агент: react-ui-engineer, затем test-engineer

**Files:** Modify `src/pages/dashboard/DashboardPage.tsx`, `src/pages/dashboard/DashboardPage.test.tsx`.

- [ ] **Step 5.1: Конфиг боксов** (в модуле страницы):

```ts
const BOX_GRID = 'repeat(auto-fit, minmax(20rem, 1fr))'

const BOX_META: Record<DomainBoxKey, {
  icon: string
  iconTone?: SectionCardProps['iconTone']
  barClass: string
  routeId: RouteId
  path: string
}> = {
  assets:        { icon: 'package',   barClass: 'bg-text-tertiary/50', routeId: 'assets',      path: '/assets' },      // default muted tone
  employees:     { icon: 'users',     iconTone: 'blue',   barClass: 'bg-sky-400/70',     routeId: 'employees',   path: '/employees' },
  parts:         { icon: 'wrench',    iconTone: 'rose',   barClass: 'bg-rose-400/70',    routeId: 'parts',       path: '/parts' },
  subscriptions: { icon: 'key-round', iconTone: 'orange', barClass: 'bg-amber-400/70',   routeId: 'licenses',    path: '/licenses' },
  branches:      { icon: 'map-pin',   iconTone: 'green',  barClass: 'bg-emerald-400/70', routeId: 'branches',    path: '/branches' },
  departments:   { icon: 'building',  iconTone: 'cyan',   barClass: 'bg-cyan-400/70',    routeId: 'departments', path: '/departments' },
}
```
(Тона — конвенция `ICON_TONES` section-card; сверить на light-теме. `iconTone` прокидывать conditional-spread'ом.)

- [ ] **Step 5.2: Итоги боксов:** `assets → data.assets?.total ?? null`; `employees → data.people?.employeeCount ?? null`; `parts → data.counts?.partsUnits ?? null`; `subscriptions → data.counts?.subscriptions ?? null`; `branches/departments → data.counts?.… ?? null`. Бокс Запчасти дополнительно `totalCaption={t('boxes.partsUnits')}`.

- [ ] **Step 5.3: Рендер ROW 2** — только при `data.boxes !== null` (упал loadRecentEvents → боксы не рендерятся, KPI живёт):

```tsx
{data.boxes && (
  <div className="grid gap-4" style={{ gridTemplateColumns: BOX_GRID }}>
    {DOMAIN_BOX_KEYS.map(key => {
      const meta = BOX_META[key]
      const box = data.boxes![key]
      const rowsLinked = canAccess(role, meta.routeId)
      const events = rowsLinked ? box.events : box.events.map(({ linkTo: _linkTo, ...rest }) => rest)
      return (
        <DomainBox
          key={key}
          icon={meta.icon}
          {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
          title={t(`boxes.${key}.title`)}
          total={totals[key]}
          delta7d={box.delta7d}
          days={box.days}
          events={events}
          barClass={meta.barClass}
          {...(canAccess(role, meta.routeId) ? { viewAllTo: meta.path } : {})}
          viewAllLabel={t(`boxes.${key}.viewAll`)}
          emptyLabel={t('boxes.empty')}
          {...(key === 'parts' ? { totalCaption: t('boxes.partsUnits') } : {})}
          testId={`domain-box-${key}`}
        />
      )
    })}
  </div>
)}
```
Порядок фиксированный — `DOMAIN_BOX_KEYS`. Явный `grid-cols-1` на мобиле не нужен (auto-fit схлопнется сам).

- [ ] **Step 5.4: Скелетон** (3 принципа): KPI-шиммер БЕЗ изменений; ROW 2 — тот же `BOX_GRID` с 6 карточками: настоящая шапка (иконка+тон из `BOX_META`, заголовок `t('boxes.${key}.title')`), приглушённая метка viewAll (`opacity-50 pointer-events-none`, паттерн старого ROW-4-скелетона); шиммер: один блок под мини-бар (в позиции action), один блок под итог+дельту, 5 одинаковых полос ленты (одна полоса на строку, без микродеталей).
- [ ] **Step 5.5 (test-engineer): `DashboardPage.test.tsx`:** скелетон повторяет финальный грид (6 заголовков боксов видны при loading); error + retry (`dashboard-error`); частичная деградация: `counts=null` → в боксах parts/subscriptions/branches/departments «—», но боксы отрендерены; `boxes=null` → грид отсутствует, KPI жив; viewAll «Подписки» скрыт для `asset_admin` (canAccess licenses = SA|tech); порядок боксов.
- [ ] **Step 5.6:** `npm test -- --run` → PASS; `npm run build` → зелёный.

**ТОЧКА РЕВЬЮ B:** spec-reviewer → code-quality-reviewer по T4–T5.

### Task 6 — Удаление legacy-компонентов · агент: react-ui-engineer

**Files:**
- Delete (каждый — ТОЛЬКО после `grep` по `src/` на отсутствие внешних импортов): `StatusBars.tsx`, `GroupBars.tsx`, `BranchBars.tsx`, `LicensePanel.tsx`, `ActivityPanel.tsx`, `AuditTable.tsx`, `StatusBreakdown.tsx`, `GroupBreakdown.tsx`, `BranchBreakdown.tsx`, `KpiTile.tsx`, `RecentActivityList.tsx`, `LicenseStatTile.tsx` — все в `src/components/features/dashboard/`
- Modify: `src/components/features/dashboard/index.ts` — остаются `StatCard`, `DomainBox`, `MiniBarChart`, `relativeTime` (+ types)
- Modify: `src/components/features/dashboard/dashboard-components.test.tsx` — удалить тесты снесённых компонентов (тесты `StatCard` сохранить; если файл тестирует только legacy — удалить файл целиком, а StatCard-тесты, если есть, перенести/сохранить)

- [ ] **Step 6.1:** `grep -r "StatusBars\|GroupBars\|BranchBars\|LicensePanel\|ActivityPanel\|AuditTable\|StatusBreakdown\|GroupBreakdown\|BranchBreakdown\|KpiTile\|RecentActivityList\|LicenseStatTile\|AUDIT_GRID" src/` — единственные вхождения должны остаться в самих удаляемых файлах, барреле и их тестах. ВНИМАНИЕ: у страницы аудита свой `features/audit/AuditTable` — не задеть.
- [ ] **Step 6.2:** Удалить файлы, почистить баррель и тесты.
- [ ] **Step 6.3:** `npm test -- --run` → PASS; `npm run build` → зелёный.

### Task 7 — i18n: чистка сирот · агент: i18n-engineer

**Files:** Modify `src/locales/{ru,en,hy}/dashboard.json`.

- [ ] **Step 7.1:** Для КАЖДОГО ключа-кандидата — grep по `src/` перед удалением (`t('status.`, `t('groups.`, `'license.`, `recentActivity`, `recentAudit`, `noActivity`, `noAudit`, `audit.col.`, `activity.`, `auditAction.`, `people.`, `viewAll`): кандидаты на удаление из dashboard.json — `status.*` (включая `st_*` — использовались только массивом `statuses` в старой странице; проверить!), `groups.*`, `branches.*` (старые), `license.*`, `recentActivity`, `recentAudit`, `noActivity`, `noAudit`, `audit.*`, `activity.*`, `auditAction.*` (у страницы аудита свой `audit.json` — проверить!), `people.*`, generic `viewAll` (если нигде не остался). ОСТАЮТСЯ: `title`, `kpi.*`, `relTime.*`, `boxes.*`.
- [ ] **Step 7.2:** Синхронно удалить в ru/en/hy (parity). `npm test -- --run` → PASS.

### Task 8 — Финальная верификация

- [ ] **Step 8.1:** `npm test -- --run` — полный прогон, PASS, вставить последние строки вывода в отчёт.
- [ ] **Step 8.2:** `npm run build` — зелёный, вставить последние строки.
- [ ] **Step 8.3:** security-reviewer — лёгкий проход: rules не тронуты, фича read-only, ключи лицензий нигде не читаются/не отображаются, ролевые гейты ссылок = canAccess, subscriptions-деградация задокументирована.

**ТОЧКА РЕВЬЮ C:** spec-reviewer → code-quality-reviewer по T6–T8 + security-reviewer.

---

## Отступления от спека (зафиксированы, применены senior-дефолты)

1. **`DomainCounts` поля `number | null`** (спек §4.5 — number): `/subscriptions` read закрыт для asset_admin действующими rules (PII-обоснование, `firestore.rules:203-216`). Вместо правки rules — per-count деградация: у asset_admin бокс Подписки показывает «—» в итоге, лента и дельта работают (аудит-окно доступно). Ссылка «Все подписки» у него и так скрыта canAccess'ом.
2. **`localize()` в ленте не нужен** — `Branch.name`/`Department.name` в кодовой базе plain string, не Tier-2 объект.
3. **`boxes.installEvent`** i18n-ключ не заводится — `×{qty}` собирает label-экстрактор (YAGNI).
4. **Window-запросы через `Timestamp.fromDate`**, не ISO-строку — `at` хранится как Firestore Timestamp.
