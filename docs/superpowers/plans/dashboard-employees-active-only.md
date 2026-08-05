# Dashboard: «Сотрудники» считает только активных (+ сверка всех данных дашборда)

Дата: 2026-08-05. Статус: утверждён владельцем (доменное решение задано в баг-репорте).

## Root cause (подтверждён по коду)

Симптом: бокс «Сотрудники» на /dashboard показывает total 2, «+1 за 7 дней» и в фиде
сотрудника, которого нет на /employees.

1. **KPI/total:** `FirestoreDashboardRepository.loadPeopleStats()`
   (`src/infra/repositories/firestoreDashboardRepository.ts:77-80`) делает
   `getDocs(collection('employees')).size` — считает ВСЕ документы, включая уволенных
   in-place (`status: 'terminated'`, увольнение = flip статуса, не удаление — доменное
   правило AMS). Страница /employees по умолчанию фильтрует `status: 'active'`
   (`src/pages/employees/employeesHelpers.ts:9`).
2. **Дельта 7д / мини-график / фид:** `groupDomainEvents`
   (`src/domain/dashboard/reducers.ts:170`) собирает бокс employees из
   `audit_logs` по `entityType==='employee' && action==='created'` без знания текущего
   статуса — созданный 6 дней назад и затем уволенный сотрудник остаётся в дельте,
   бакетах и ленте.

Легаси-нюанс: есть и коллекция `former_employees` (старый механизм переноса) — такие
доки в `employees` отсутствуют и в счётчик не попадают, но их `created`-события тоже
не должны попадать в фид. Поэтому фильтр фида — whitelist активных id, а не blacklist
terminated.

## Доменное решение (от владельца)

KPI-плитка «Сотрудники», total бокса, дельта «+N за 7 дней», мини-график и фид —
ТОЛЬКО активные (не terminated), согласованно с /employees по умолчанию.
Списанные АКТИВЫ в «Всего активов» остаются — не трогать.

## Дизайн фикса

### 1. Domain — `src/domain/dashboard/types.ts`
```ts
export interface PeopleStats {
  employeeCount: number                 // только active
  activeEmployeeIds: readonly string[]  // whitelist для фида бокса
}
```

### 2. Domain — `src/domain/dashboard/reducers.ts`
- Новый общий редьюсер (паритет адаптеров by construction):
```ts
export type EmployeeForStats = { id: string; status: 'active' | 'terminated' }
export function reducePeopleStats(rows: readonly EmployeeForStats[]): PeopleStats
```
  active → в счётчик и в `activeEmployeeIds`.
- `GroupDomainEventsInput` получает опциональное `activeEmployeeIds?: readonly string[]`.
  Матчер бокса employees: при наличии массива — событие включается только если
  `entityId` в set; при `undefined` (loadPeopleStats упал) — без фильтрации
  (graceful degradation, лучше нефильтрованный фид, чем пустой).
  Дельта, бакеты и лента считаются от одного `matched` — фильтр в одном месте.

### 3. Firestore-адаптер — `firestoreDashboardRepository.ts`
`loadPeopleStats`: getDocs → map `{ id: d.id, status: (x.status ?? 'active') }`
→ `reducePeopleStats`. Отсутствующий `status` = active (та же семантика, что у
`toEmployee` в firestoreEmployeeRepository:37). Фильтрация в памяти — коллекция
маленькая и уже грузится целиком (как в listEmployees); составной индекс НЕ нужен,
`firestore.indexes.json` не меняется.

### 4. InMemory-адаптер — `inMemoryDashboardRepository.ts`
Seed: поле `employeeCount: number` ЗАМЕНЯЕТСЯ на `employees: EmployeeForStats[]`;
`loadPeopleStats` = `reducePeopleStats(seed.employees)`. Обновить все места
конструирования seed (inMemoryDashboardRepository.test.ts, DashboardPage.test.tsx).

### 5. Хук — `src/hooks/useDashboard.ts`
Передать whitelist в groupDomainEvents conditional-spread-идиомой
(exactOptionalPropertyTypes!):
```ts
...(people.status === 'fulfilled'
  ? { activeEmployeeIds: people.value.activeEmployeeIds } : {})
```

### 6. Без изменений
UI-компоненты (DashboardPage читает те же поля), i18n, firestore.rules,
storage.rules, indexes. Барел `domain/dashboard/index.ts` — star-export, не трогать.

## TDD (падающие тесты ДО фикса)

1. `reducers`: `reducePeopleStats([active, terminated])` → `employeeCount 1`,
   `activeEmployeeIds` только активный id.
2. `reducers`: `groupDomainEvents` c `activeEmployeeIds` исключает событие
   terminated-сотрудника из delta7d/days/events; без параметра — не фильтрует.
3. `inMemoryDashboardRepository`: seed 1 active + 1 terminated → `{ employeeCount: 1, ... }`.
4. `firestoreDashboardRepository`: мок-доки active + terminated + без status →
   count 2 (missing = active), terminated исключён.
5. `useDashboard`: whitelist прокинут в boxes; при падении loadPeopleStats фид не пустеет.
6. Обновить существующие тесты под новые формы (useDashboard.test.ts,
   DashboardPage.test.tsx, firestoreDashboardRepository.test.ts:406).

## Файлы (абсолютные)

- C:/Users/DELL/Desktop/assets-crm/src/domain/dashboard/types.ts
- C:/Users/DELL/Desktop/assets-crm/src/domain/dashboard/reducers.ts
- C:/Users/DELL/Desktop/assets-crm/src/domain/dashboard/reducers.domain-boxes.test.ts
- C:/Users/DELL/Desktop/assets-crm/src/domain/dashboard/dashboard-types.test.ts (при необходимости)
- C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/firestoreDashboardRepository.ts (+ .test.ts)
- C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/inMemoryDashboardRepository.ts (+ .test.ts)
- C:/Users/DELL/Desktop/assets-crm/src/hooks/useDashboard.ts (+ .test.ts)
- C:/Users/DELL/Desktop/assets-crm/src/pages/dashboard/DashboardPage.test.tsx (только seed-формы)

## Сверка остальных данных дашборда (результат аудита, править только employees)

| Элемент | Источник | Вердикт |
|---|---|---|
| KPI Всего активов | assets: все доки, все статусы | OK — /assets default `statusId:'all'`, списанные видны и там |
| KPI Выдано | byStatus.st_assigned | OK; примечание: st_pending («Ожидание») не входит ни в Выдано, ни в На складе — спорное, не чинить |
| KPI На складе | byStatus.st_warehouse | OK |
| KPI Списанные | byStatus.st_disposed | OK |
| KPI Лицензии | licenses total (вкл. retired) | Согласовано: /licenses показывает retired строки с чипом статуса — спорное, не чинить |
| KPI Сотрудники | ВСЕ доки employees | БАГ → фикс (этот план) |
| Бокс активы | audit asset+created | OK (soft-delete only, детали существуют) |
| Бокс сотрудники | audit employee+created без статуса | БАГ → фикс (этот план) |
| Бокс запчасти | Σ onHand + install-движения | OK (типов «отмена» не существует: receive/install/uninstall/service) |
| Бокс подписки | subscriptions + licenses(type=Subscription), фид subscription_created/license created | Спорное: (а) на /licenses вкладка подписок показывает только коллекцию subscriptions, без Subscription-лицензий; (б) retired Subscription-лицензии входят в счётчик. Задокументированное решение редизайна — не чинить, рекомендация в отчёте |
| Бокс филиалы | count всех branches | OK — задокументированный паритет с listBranches (без фильтра статуса) |
| Бокс отделы | count departments | OK — статуса у отделов нет |

## Верификация

- `npx vitest run` — весь прогон зелёный.
- `npm run build` — зелёный (tsc -b строже --noEmit).
- БЕЗ git-операций. Worktrees `.claude/worktrees/**` не трогать.

## Откат

Изменение аддитивно (новое поле PeopleStats + опциональный параметр редьюсера);
откат = revert файлов из списка. Данные Firestore не мигрируются.
