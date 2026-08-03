# Dashboard: доменные боксы — дизайн-док

Дата: 2026-07-31
Статус: решения зафиксированы пользователем, готов к планированию (plan-файл — отдельный артефакт)
Затрагивает: `src/pages/dashboard/DashboardPage.tsx`, `src/components/features/dashboard/**`, `src/domain/dashboard/**`, `src/infra/repositories/*DashboardRepository*`, `src/hooks/useDashboard*`, `src/locales/{ru,en,hy}/dashboard.json`

---

## 1. Цель и рамки

Реструктуризация Dashboard: сверху остаётся ТОЛЬКО существующий KPI-ряд (5 `StatCard`).
Всё остальное — `StatusBars`, `GroupBars`, `BranchBars`, `LicensePanel`, `ActivityPanel`, `AuditTable` — **удаляется** и заменяется на **6 доменных боксов** единого паттерна:

1. **Активы**
2. **Сотрудники**
3. **Запчасти**
4. **Лицензии-подписки**
5. **Филиалы**
6. **Отделы**

Зафиксированные решения пользователя:

| # | Вопрос | Решение |
|---|---|---|
| 1 | Структура | KPI-ряд остаётся; ряды 2–4 удаляются; вместо них 6 боксов |
| 2 | Подписки | строго подписки (`type === 'Subscription'`); Windows-ключи / OEM / Volume / Retail НЕ входят |
| 3 | Лента 7 дней | только добавления/установки: `created` для сущностей, `install` для запчастей. НЕ расширять |
| 4 | Филиалы и отделы | два отдельных бокса |
| 5 | Роли | все 6 боксов и ленты видят все 3 админ-роли (`super_admin`, `asset_admin`, `tech_admin`) |
| 6 | Визуализация | в шапке бокса — 7-дневный мини-бар (7 столбиков по дням) + итог + «+N за 7 дней» |

Не в рамках: изменения KPI-ряда, изменения rules (только верификация читаемости), realtime-подписки (разовая загрузка, как сейчас), пагинация лент.

---

## 2. Макет

### 2.1 Desktop (lg+)

```
┌──────────────────────────────────────────────────────────────┐
│ ROW 1 — KPI (БЕЗ ИЗМЕНЕНИЙ): 5 × StatCard                     │
│   Всего активов* | Выдано сейчас | На складе | Лицензии | Сотрудники │
├──────────────────────────────────────────────────────────────┤
│ ROW 2 — доменные боксы, grid auto-fit minmax(20rem, 1fr)      │
│   ┌─ Активы ─────┐ ┌─ Сотрудники ─┐ ┌─ Запчасти ───┐          │
│   └──────────────┘ └──────────────┘ └──────────────┘          │
│   ┌─ Подписки ───┐ ┌─ Филиалы ────┐ ┌─ Отделы ─────┐          │
│   └──────────────┘ └──────────────┘ └──────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

- Грид: `display:grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1rem` — тот же приём, что нынешний `PANEL_GRID_2`. На контентной ширине ~66.75rem (1366px) → 3 колонки × 2 ряда; на 1920+ остаётся 3 (auto-fit дозаполняет ширину). Никакого content cap — контент заполняет любой экран (см. memory `project_ams_no_content_cap`).
- Все размеры в rem-токенах (`--fs-*`), px в компонентах запрещены.
- Порядок боксов фиксированный: Активы → Сотрудники → Запчасти → Подписки → Филиалы → Отделы.

### 2.2 Mobile (< lg)

- KPI-ряд: без изменений (2-col, featured col-span-2).
- Боксы: **вертикальный stack в одну колонку** в том же порядке (auto-fit при узкой ширине сам схлопнется в 1 колонку — явный `grid-cols-1` не нужен, но допускается для предсказуемости).
- Ссылка «Все … →» на мобиле — full-width outlined кнопка (паттерн из нынешнего `ActivityPanel`), на desktop — right-aligned текстовая ссылка.

---

## 3. Паттерн бокса — `DomainBox`

Единый переиспользуемый компонент `src/components/features/dashboard/DomainBox.tsx`. Оболочка — существующий **`SectionCard`** (`src/components/ui/section-card.tsx`), НЕ новая карточка.

```
┌────────────────────────────────────────────────┐
│ [icon] АКТИВЫ                    ▂▄▁▆▂▃█  ← header (SectionCard header + action-слот)
├────────────────────────────────────────────────┤
│  1 248        +12 за 7 дней                     │ ← итог (крупно) + дельта-чип
│ ───────────────────────────────────────────    │
│  MacBook Pro 14 — Артур Б.          2ч назад   │ ← лента: до 6 событий за 7 дней
│  Dell XPS 13 — Сурен М.             1д назад   │
│  …                                              │
│ ───────────────────────────────────────────    │
│                                    Все активы → │ ← footer-ссылка (role-gated)
└────────────────────────────────────────────────┘
```

### 3.1 Шапка

- `SectionCard` c `icon`, `iconTone`, `title`; **мини-бар рендерится в `action`-слот** заголовка.
- Мини-бар — новый маленький презентационный компонент `MiniBarChart`: ровно **7 столбиков** (последние 7 календарных дней, сегодня — правый). Высота пропорциональна максимуму в окне; нулевой день — минимальная «точка» `0.125rem` приглушённого цвета. Ширина столбика ~`0.375rem`, высота контейнера ~`1.5rem`, всё в rem. `title`-атрибут на столбике: дата + число событий (доступность). Цвет — акцентный тон бокса с прозрачностью (как `bg-success/15`-паттерны в SectionCard tones).

Иконки/тона по боксам (конвенция `ICON_TONES` из section-card + memory `project_section_icon_colors`):

| Бокс | icon | iconTone |
|---|---|---|
| Активы | `package` | (default muted) или `cyan` |
| Сотрудники | `users` | `blue` |
| Запчасти | `wrench` | `rose` |
| Подписки | `key-round` | `orange` (лицензии = key/orange по конвенции) |
| Филиалы | `map-pin` | `green` |
| Отделы | `building` | `cyan` |

(Точные пары уточняет react-ui-engineer по фактической конвенции `project_section_icon_colors`; правило — не изобретать новые тона.)

### 3.2 Тело

1. **Строка итога**: крупное число (итоговый счётчик сущностей, НЕ событий) + чип-дельта `+N за 7 дней` (N = число событий бокса в 7-дневном окне; при N=0 чип приглушён или скрыт — решение: показывать `+0` приглушённым, чтобы строка не прыгала).
2. **Лента**: последние **5–6 событий** окна, по убыванию `at`. Строка — стиль рядов нынешнего `ActivityPanel` / `HistoryCard` (компактная, две строки текста + относительное время справа):
   - primary: label сущности (см. §4.4);
   - secondary: `actorName` (денормализован в `audit_logs`; fallback — роль/«—» при `undefined|null`);
   - справа: относительное время — **переиспользуем `relativeTime`**, вынести из `ActivityPanel.tsx` в общий модуль `src/components/features/dashboard/relativeTime.ts` (или `src/lib/`), ключи `relTime.*` уже есть в dashboard.json;
   - строка — `Link` на карточку сущности, если маршрут существует и `canAccess` (активы → `/assets/:id`; остальные — на списочную страницу; без ссылки, если доступа нет).
3. **Пустое состояние**: существующий `EmptyState` (icon `history`, текст `boxes.empty`) — итог и мини-бар при этом всё равно показываются.
4. **Footer**: ссылка `viewAll`-паттерна («Все активы →», «Все сотрудники →», …) — рендерится только если `canAccess(role, <routeId>)`. Маршруты: `/assets`, `/employees`, `/parts`, `/licenses` (вкладка «Подписки»), `/branches`, `/departments`.

### 3.3 Props

```ts
interface DomainBoxProps {
  icon: string
  iconTone?: SectionCardProps['iconTone']
  title: string
  total: number | null        // null → итог недоступен (частичная ошибка) — рендер «—»
  delta7d: number
  days: number[]              // ровно 7 значений, [0]=6 дней назад … [6]=сегодня
  events: DomainEventVM[]     // ≤ 6, уже отсортированы desc
  viewAllTo?: string          // undefined → ссылка не рендерится (нет доступа)
  viewAllLabel: string
  emptyLabel: string
  testId?: string
}

interface DomainEventVM {
  id: string                  // auditId | movementId
  primary: string             // label сущности / запчасти
  secondary: string | null    // actorName
  at: string                  // ISO
  linkTo?: string
}
```

---

## 4. Модель данных и запросы

### 4.1 Принцип

**Одно окно `audit_logs` за 7 дней** + один маленький запрос `part_movements` + лёгкие счётчики. Клиентская раскладка окна по `entityType + action` в 6 лент, подсчёт дельт и мини-баров — чистые функции в `src/domain/dashboard/reducers.ts` (unit-тестируемые, без Firebase).

### 4.2 Запросы (адаптер `firestoreDashboardRepository`)

| Запрос | Firestore | Ограничения | Индексы |
|---|---|---|---|
| `loadRecentEvents(sinceIso, cap≈250)` | `audit_logs`: `where('at','>=',since)`, `orderBy('at','desc')`, `limit(cap)` | cap 200–300, окно 7 дней | одиночный индекс `at` (авто) — новых индексов НЕ нужно |
| `loadRecentPartInstalls(sinceIso, cap≈200)` | `part_movements`: `where('at','>=',since)`, `orderBy('at','desc')`, `limit(cap)`; фильтр `type === 'install'` — **на клиенте** | коллекция журнальная, окно маленькое | клиентский фильтр по type сознательно: избегаем нового композитного индекса `(type, at)`. Если объём вырастет — Phase 2 переключается на композит |
| `loadDomainCounts()` | 4 аггрегатных `getCountFromServer`: `branches` (status=='active' — как принято на странице филиалов), `departments`, `subscriptions`, `licenses where type=='Subscription'`; плюс чтение `parts` (малый каталог SKU) для `Σ onHand` | count-агрегаты — дёшево, 1 RU каждый | не нужны |

Существующие методы, которые **остаются** (для KPI-ряда): `loadAssetStats`, `loadWorkstationLicenseStats`, `loadPeopleStats`.

Методы, которые **удаляются** из порта `DashboardRepository` + обоих адаптеров (`firestore*`, `inMemory*`) + хука: `loadAssignmentActivity`, `loadRecentAuditRows`, `loadServerLicenseCount` (их единственные потребители — удаляемые панели). Из `DashboardData` уходят `assignments`, `recentAudit`, `serverLicenseCount`.

### 4.3 Раскладка окна по боксам (reducer `groupDomainEvents`)

| Бокс | Источник событий | Условие |
|---|---|---|
| Активы | audit | `entityType==='asset' && action==='created'` |
| Сотрудники | audit | `entityType==='employee' && action==='created'` |
| Запчасти | **part_movements** | `type==='install'` (в т.ч. `serviceReplace` — это тоже установка; `factory`-флаг у текущих репозиториев не пишется) |
| Подписки | audit | `entityType==='subscription' && action==='subscription_created'` **ИЛИ** `entityType==='license' && action==='created' && after?.type==='Subscription'` (защитный фильтр: workstation-лицензия с типом Subscription — тоже подписка; Windows-ключи/OEM/Volume/Retail отсекаются) |
| Филиалы | audit | `entityType==='branch' && action==='created'` |
| Отделы | audit | `entityType==='department' && action==='created'` |

Дельта бокса = число событий бокса в окне. Мини-бар = `bucketByDay(events, now, 7)` — чистая функция: бакетирование по **локальному** календарному дню, 7 бакетов, старший слева. Лента = первые 6 событий.

Cap-честность: если окно упёрлось в `limit(cap)`, дельты «не менее N» — для MVP принимаем как есть (окно 7 дней при текущих объёмах в cap помещается); reducer никак не помечает усечение.

### 4.4 Label сущности в ленте (best-effort из денормализованных данных, без дочитываний)

| Бокс | primary | Откуда |
|---|---|---|
| Активы | `{brand} {model}` → `invCode` → `entityId` | `after` snapshot audit-записи |
| Сотрудники | `{lastName} {firstName}` → email → `entityId` | `after` |
| Запчасти | `{note/skuId} ×{qty} → {assetInvCode}` | `PartMovement` (поля `skuId`, `qty`, `assetInvCode` уже денормализованы); имя SKU резолвится из уже прочитанного каталога `parts` (он загружен для Σ onHand) |
| Подписки | `name` | `after` |
| Филиалы | `name` (мультиязычное Tier-2 → `localize()`) | `after` |
| Отделы | `name` (Tier-2 → `localize()`) | `after` |

`secondary` = `actorName ?? null` (для part_movements поля `actorName` нет — резолв НЕ делаем, показываем только время; допустимое упрощение MVP, лента запчастей — двухэлементная строка).

Извлечение label — чистые функции в reducers.ts, обязательные fallback-цепочки (никаких `undefined` в UI).

### 4.5 Типы (`src/domain/dashboard/types.ts`)

```ts
export type DomainBoxKey = 'assets' | 'employees' | 'parts' | 'subscriptions' | 'branches' | 'departments'

export interface DomainBoxData {
  key: DomainBoxKey
  delta7d: number
  days: number[]              // length 7
  events: DomainEventVM[]     // ≤ 6
}

export interface DomainCounts {
  partsUnits: number          // Σ onHand по каталогу SKU
  branches: number
  departments: number
  subscriptions: number       // subscriptions count + licenses(type=='Subscription') count
}

export interface DashboardData {
  assets: AssetStats | null
  workstationLicenses: WorkstationLicenseStats | null
  people: PeopleStats | null
  counts: DomainCounts | null
  boxes: Record<DomainBoxKey, DomainBoxData> | null
}
```

Итоги боксов: Активы — `assets.total`; Сотрудники — `people.employeeCount`; Запчасти — `counts.partsUnits`; Подписки — `counts.subscriptions`; Филиалы — `counts.branches`; Отделы — `counts.departments`.

### 4.6 Хук `useDashboard`

- Параллельная загрузка: `loadAssetStats`, `loadWorkstationLicenseStats`, `loadPeopleStats`, `loadRecentEvents`, `loadRecentPartInstalls`, `loadDomainCounts` — `Promise.allSettled`, частичные ошибки не валят страницу (null-поля, как сейчас).
- Ролевой гейтинг вызовов упрощается: **все 6 методов зовутся для всех 3 админ-ролей** (решение №5). SA-only ветки (`loadServerLicenseCount`, `loadRecentAuditRows`) удаляются.
- Reducer-этап (`groupDomainEvents` + `bucketByDay`) — в хуке после загрузки, мемоизированно.

---

## 5. Роли и безопасность

- Все 6 боксов + ленты: `super_admin`, `asset_admin`, `tech_admin`. Роль `employee` на dashboard не попадает (существующий route-гейт).
- **Верификация rules (обязательный шаг плана, firebase-engineer):** `firestore.rules` — `audit_logs` read разрешён всем 3 админ-ролям; `part_movements` read — всем 3 (страница `/parts` уже доступна всем 3 — см. `src/config/parts-roles.test.ts`); `subscriptions`, `branches`, `departments`, `parts`, `licenses` — читаемы админам. Если какой-то read закрыт уже (не ожидается) — правка rules отдельным ревью security-reviewer.
- Ссылки «Все → …» гейтятся `canAccess(role, routeId)` (`src/config/access.ts`) — бокс виден, ссылка скрывается при отсутствии доступа к целевой странице.
- Никаких новых write-путей; фича read-only. Ключи лицензий нигде не читаются и не отображаются.

---

## 6. Состояния

### 6.1 Loading — скелетон (три принципа из memory `feedback_skeleton_principles`)

1. **Точный footprint родительских блоков**: скелетон повторяет финальную сетку — KPI-ряд (существующий шиммер без изменений) + грид `auto-fit minmax(20rem,1fr)` с 6 карточками.
2. **Async-only shimmer**: локальный chrome рендерится по-настоящему — шапка бокса (иконка + заголовок из i18n), приглушённая ссылка `viewAll` (паттерн текущего ROW-4-скелетона). Шиммерится только асинхронное: мини-бар (один блок), строка итога (один блок), лента.
3. **Parent-level granularity («не мелочиться»)**: лента = 5 одинаковых строк-шиммеров (одна полоса на строку, без микродеталей), итог+дельта = один блок, мини-бар = один блок.

### 6.2 Empty

- Событий за 7 дней нет → `EmptyState` внутри тела бокса (`boxes.empty`), итог + мини-бар (плоский, 7 «точек») остаются.
- Итог = 0 и событий нет — тот же рендер, ничего специального.

### 6.3 Error

- Страничный `ErrorState` c retry поверх контента при любой ошибке (существующий паттерн `data-testid="dashboard-error"`).
- Частичная деградация: упал только `loadDomainCounts` → боксы рендерятся с `total=null` («—»); упал `loadRecentEvents` → `boxes=null`, боксы не рендерятся, KPI живёт. Полная симметрия текущему null-based контракту `DashboardData`.

---

## 7. Адаптив / мобайл

- No content cap: сетка тянется на всю ширину; масштаб через `root font-size ∝ 100vw/90` (memory `project_ams_no_content_cap`) — все размеры мини-бара, чипов, отступов строго в rem.
- `< lg`: одна колонка, боксы в фиксированном порядке; шапка не переносится (title truncate, мини-бар не сжимается ниже 7×0.375rem); footer-ссылка — full-width outlined кнопка.
- Тач-цели строк ленты ≥ 2.75rem высоты.
- Dashboard — не списочная страница: `ListCard`/FLUSH_ROUTES-паттерн (memory `project_ams_mobile_list_page_pattern`) здесь НЕ применяется, остаёмся в обычном page-padding.

---

## 8. i18n (ru / en / hy — `src/locales/*/dashboard.json`)

Новые ключи (Tier 1, добавляются во все 3 локали одновременно):

```jsonc
"boxes": {
  "assets":        { "title": "Активы",     "viewAll": "Все активы" },
  "employees":     { "title": "Сотрудники", "viewAll": "Все сотрудники" },
  "parts":         { "title": "Запчасти",   "viewAll": "Все запчасти" },
  "subscriptions": { "title": "Подписки",   "viewAll": "Все подписки" },
  "branches":      { "title": "Филиалы",    "viewAll": "Все филиалы" },
  "departments":   { "title": "Отделы",     "viewAll": "Все отделы" },
  "delta7d": "+{{n}} за 7 дней",
  "empty": "Нет событий за 7 дней",
  "partsUnits": "единиц на складе",          // caption под итогом бокса Запчасти
  "installEvent": "×{{qty}}"                  // формат кол-ва в строке установки (если нужен отдельный ключ)
}
```

Переиспользуются без изменений: `relTime.*`, `title`, `viewAll` (общий — если решим не делать per-box, per-box предпочтительнее для точности форм в hy). Удаляются вместе с панелями ставшие сиротами ключи: `status.title|totalCaption`, `groups.*`, `branches.empty|title` (старые), `license.*` (панель), `recentActivity`, `recentAudit`, `noActivity`, `noAudit`, `audit.col.*`, `activity.*` — i18n-engineer сверяет фактические остаточные использования перед удалением (`auditAction.*` используется страницей аудита? — в dashboard.json это локальная копия, страница аудита имеет свой `audit.json`; удалять только после grep).
Tier-2 поля (названия филиалов/отделов) в ленте — через существующий `localize()`.

---

## 9. Переиспользование vs новое (golden rule: reuse-first)

### Переиспользуем как есть
- `SectionCard` (`src/components/ui/section-card.tsx`) — оболочка бокса, header + action-слот под мини-бар.
- `StatCard` — KPI-ряд без изменений.
- `EmptyState`, `ErrorState`, `Icon`, `cn` — как сейчас.
- `canAccess` (`src/config/access.ts`) — гейт ссылок.
- `localize()` — Tier-2 label'ы филиалов/отделов.
- Стиль строк ленты и viewAll-паттерн (desktop link / mobile outlined button) — переносится из `ActivityPanel` в `DomainBox` при удалении первого.

### Выносим в shared (рефактор, не новое)
- `relativeTime()` — из `ActivityPanel.tsx` в общий модуль (используется каждой лентой).

### Новое (минимум)
- `DomainBox.tsx` — единственный новый контейнерный компонент (6 инстансов).
- `MiniBarChart.tsx` — крошечный presentational (7 div-столбиков, ~30 строк).
- `src/domain/dashboard/reducers.ts` — `groupDomainEvents`, `bucketByDay`, label-экстракторы (чистые функции + тесты).
- Методы репозитория: `loadRecentEvents`, `loadRecentPartInstalls`, `loadDomainCounts` (порт + firestore-адаптер + inMemory-адаптер).

### Удаляем
- Компоненты: `StatusBars`, `GroupBars`, `BranchBars`, `LicensePanel`, `ActivityPanel`, `AuditTable`, а также legacy `StatusBreakdown`, `GroupBreakdown`, `BranchBreakdown`, `KpiTile`, `RecentActivityList`, `LicenseStatTile` — каждый только после grep-проверки, что нет внешних импортов; чистка `index.ts` барреля и `dashboard-components.test.tsx`.
- Порт/адаптеры/хук: `loadAssignmentActivity`, `loadRecentAuditRows`, `loadServerLicenseCount`; типы `AssignmentActivity*`, `DashboardAuditRow` (после grep).
- Экспорт `AUDIT_GRID` из dashboard (использовался скелетоном ROW 4; у страницы аудита свой `features/audit/AuditTable`).

---

## 10. Тестирование

- **Домен (vitest, чистые функции):** `bucketByDay` (границы дней, TZ-локальность, пустое окно, ровно 7 бакетов); `groupDomainEvents` (маппинг всех 6 боксов, subscription-фильтр `after.type==='Subscription'`, отсечение OEM/Volume/Retail/Default, cap ленты 6, сортировка desc, fallback-label'ы).
- **inMemoryDashboardRepository:** новые методы; удаление старых отражено в тестах.
- **firestoreDashboardRepository:** мок-тесты окна (`where at>=`, `orderBy desc`, `limit`), клиентский фильтр `type==='install'`, count-агрегаты.
- **Компоненты:** `DomainBox` — рендер итога/дельты/мини-бара, empty state, скрытие viewAll без доступа, ссылки строк; `DashboardPage` — скелетон повторяет финальный грид, error+retry, частичная деградация (`counts=null` → «—»).
- **i18n:** ключи резолвятся в ru/en/hy (существующий паттерн render-тестов).
- Верификация: `npm test -- --run` и `npm run build` (tsc -b, `exactOptionalPropertyTypes` — conditional-spread для опциональных props, см. memory `project_ams_verify_with_build`).

---

## 11. Риски и заметки

- **Cap окна**: 250 записей за 7 дней достаточно при текущих объёмах; при усечении дельты занижаются молча — принято для MVP.
- **`actorName` на старых записях** отсутствует (денормализация введена позже) — fallback «без имени» обязателен; в окне 7 дней старых записей практически не будет.
- **Композитный индекс для part_movements не нужен** (клиентский фильтр по `type`); пересмотреть при росте журнала.
- **`auditAction`/старые ключи локали** — удалять только по факту grep, часть может использоваться повторно.
- **Никаких изменений rules не ожидается** — только верификация; любое фактическое изменение → полный цикл security-review.
