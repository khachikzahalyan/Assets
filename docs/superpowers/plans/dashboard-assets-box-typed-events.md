# Дашборд: бокс «АКТИВЫ» — typed events + exception-first

Дата: 2026-08-06. Владелец: warehouse-orchestrator. Статус: утверждён к исполнению.

## Цель

Углубить бокс «АКТИВЫ» (/dashboard, Row 3, DomainBox variant='standard', headerLink):
1. Фид показывает не только `created`, а 5 типов событий с цветными буллетами и меткой типа.
2. Первая строка обогащается: `{invCode} · {brand model}` через join с уже загруженной коллекцией assets.
3. Над фидом — exception-строка: чипы «Ожидают подтверждения: N» (st_pending) и «В ремонте: N» (st_repair) из уже посчитанного `byStatus`.

## ЖЁСТКОЕ ОГРАНИЧЕНИЕ: ноль новых чтений Firestore

Никаких новых запросов/коллекций. Источники — уже загружаемое дашбордом:
- `loadRecentEvents` (audit_logs, окно 7д, cap 250);
- `loadAssetStats` (полная коллекция assets — уже читается getDocs).

## Классификация источников (по фактическим audit-записям)

Инвентаризация writer-ов (проверено по коду репозиториев):

| Физическое событие | Кто пишет | entityType / action | after |
|---|---|---|---|
| Создание актива | firestoreAssetRepository.create (:348) | `asset` / `created` | `{ invCode, statusId }` (бренда/модели НЕТ) |
| Смена статуса (выдача через transfer-флоу, bulkAssign, ремонт, списание, возврат) | firestoreAssetRepository.changeStatus (:571) | `asset` / `status_changed` | `{ statusId, assignment? }` |
| Выдача через AssignmentRepository.assign (:69) | firestoreAssignmentRepository | `assignment` / `assigned` | `{ assetId, mode, ... }`; asset-статус флипается в ТОЙ ЖЕ txn БЕЗ отдельного status_changed |
| Возврат через AssignmentRepository.returnAsset (:134) | firestoreAssignmentRepository | `assignment` / `returned` | `{ assetId, endedAt }`; аналогично без status_changed |
| Подтверждение получения (magic-link) | api/confirm-receipt.ts (:182) | `asset` / `receipt_confirmed` | — |

### Правила классификации (DomainEventKind)

```
classifyAssetEvent(l: AuditLog): DomainEventKind | null
  asset/created                                  → 'created'
  asset/status_changed, after.statusId:
      st_assigned | st_pending                   → 'issued'    (выдан)
      st_warehouse                               → 'returned'  (возвращён)
      st_disposed                                → 'disposed'  (списан)
      st_repair                                  → 'repair'    (ремонт)
  assignment/assigned                            → 'issued'
  assignment/returned                            → 'returned'
  всё остальное (updated, receipt_confirmed, …)  → null (не в фиде)
```

### Отсутствие дублей одного физического события — обоснование

- `assign()`/`returnAsset()` пишут ОДИН audit-док (`assigned`/`returned`) и меняют статус актива в той же транзакции БЕЗ `status_changed` → пути `assignment/*` и `asset/status_changed` дизъюнктны по коду.
- Выдача сотруднику через transfer-флоу: `status_changed → st_pending` (одно событие «выдан»). Последующий клик по magic-link пишет `receipt_confirmed` (НЕ status_changed) → исключён классификатором → второй «выдан» не возникает.
- Возврат из ремонта сотруднику (`st_repair → st_assigned`) — отдельное физическое событие, легитимно отображается как «выдан».

### Семантика delta7d

Чип «+N за 7 дней» в шапке бокса СОХРАНЯЕТ смысл прироста: `delta7d` и `days` для assets продолжают считаться ТОЛЬКО по `created` (иначе «+» врал бы, суммируя списания). Фид — все типы.

## Join первой строки

- `reduceAssetStats` дополнительно строит `labelById: Record<string, string>`:
  `"{invCode} · {brand model}"` (без пустых сегментов; только invCode, если brand/model нет). Строится только по элементам, у которых есть `invCode`.
- `AssetForStats` = прежний Pick + `Partial<Pick<Asset, 'invCode' | 'brand' | 'model'>>` — полный `Asset` (inMemory) удовлетворяет автоматически.
- **Firestore-адаптер: +3 поля в существующий map** (`invCode`, `brand`, `model`) внутри уже выполняемого `getDocs(collection('assets'))` — НОЛЬ новых чтений. Это единственное отступление от «репозитории не трогать»; без него join в проде невозможен (проекция отбрасывала поля). Задокументировано в отчёте.
- `groupDomainEvents` получает опциональный `assetLabels?: Record<string, string>` (exactOptionalPropertyTypes: conditional spread в useDashboard).
- Join-ключ: для `assignment`-событий — `after.assetId` (fallback `before.assetId`), иначе `entityId`.
- Fallback-цепочка primary: `assetLabels[joinId]` → `assetEventLabel(l)` (invCode из audit after для created) → `joinId`.
- `linkTo`: `/assets/{joinId}`; для assignment-событий без assetId — `/assets`.

## VM / UI

- `DomainEventVM` + `kind?: DomainEventKind` (`'created' | 'issued' | 'returned' | 'disposed' | 'repair'`).
- `DomainBox`: карта `kind → dot class`:
  created → нет override (тон бокса, bg-accent/70) · issued → `bg-emerald-400/70` · returned → `bg-sky-400/70` · disposed → `bg-rose-400/70` · repair → `bg-amber-400/70`.
  `BulletDot` получает override с fallback на `barClass` (другие боксы без kind — без изменений).
- Вторая строка при наличии kind: `{t('boxes.events.'+kind)} · {actorName}` (actorName опускается, если null). Двухстрочная структура строки не меняется.
- Exception-строка: новый опциональный prop `alerts?: { id, label, chipClass, to? }[]` в DomainBox (standard variant). Рендер между шапкой и фидом, flex-shrink-0, компактные чипы (геометрия delta-чипа: rounded-full, 0.75rem, py 0.1875rem px 0.5625rem). При `alerts.length > 0` фид режется до 3 строк (иначе 4) — бокс не раздувается, грид-стретч ряда 3 не ломается.
- Чипы (существующие семантические токены, как в StatCard): pending → `text-warning bg-warning/15`, repair → `text-info bg-info/15` (иконки/лейблы различают; в фиде точка «ремонт» остаётся amber). Клик → `/assets`.
- DashboardPage: alerts собираются ТОЛЬКО для assets-бокса из `data.assets.byStatus.st_pending` / `.st_repair`; оба нуля → prop не передаётся.
- useDashboard: прокинуть `assetLabels` из `assets.value.labelById` в groupDomainEvents (conditional spread).

## i18n (ru/en/hy dashboard.json)

```
boxes.events: created=Создан/Created/Ստեղծվել է · issued=Выдан/Issued/Տրվել է ·
returned=Возвращён/Returned/Վերադարձվել է · disposed=Списан/Disposed/Դուրս գրվել է ·
repair=Ремонт/Repair/Վերանորոգում
boxes.alerts: pending=«Ожидают подтверждения: {{n}}»/“Awaiting confirmation: {{n}}”/«Հաստատման սպասում՝ {{n}}» ·
repair=«В ремонте: {{n}}»/“In repair: {{n}}”/«Վերանորոգման մեջ՝ {{n}}»
```

## Файлы

- `src/domain/dashboard/types.ts` — DomainEventKind, DomainEventVM.kind, AssetStats.labelById, GroupDomainEventsInput.assetLabels.
- `src/domain/dashboard/reducers.ts` — classifyAssetEvent, join, labelById, delta по created.
- `src/domain/dashboard/reducers.domain-boxes.test.ts`, `reducers.asset-stats.test.ts` — тесты.
- `src/infra/repositories/firestoreDashboardRepository.ts` — +3 поля в map (ноль чтений) + тест.
- `src/hooks/useDashboard.ts` — прокидка assetLabels.
- `src/components/features/dashboard/DomainBox.tsx` (+test) — kind-точки, метка типа, alerts.
- `src/pages/dashboard/DashboardPage.tsx` (+test) — сборка alerts для assets.
- `src/locales/{ru,en,hy}/dashboard.json` — ключи.

## Порядок задач (последовательно, gate = test-engineer)

1. domain-modeler: типы + редьюсеры + unit-тесты (TDD).
2. firebase-engineer: маппер (+ тест адаптера).
3. i18n-engineer: ключи ru/en/hy (до UI, чтобы компонентные тесты резолвили метки).
4. react-ui-engineer: hook + DomainBox + DashboardPage + компонентные тесты.
5. Верификация: `npx vitest run` + `npm run build`.

## Тесты (минимум)

- Классификация: каждый из 5 типов; `receipt_confirmed`/`updated` исключены; delta7d assets = только created; дубли выдачи отсутствуют (pending-выдача + confirm = ровно один 'issued').
- Join: labelById-попадание → «INV · Brand Model»; промах → invCode из after (created) → entityId; assignment-событие join по after.assetId, linkTo /assets/{assetId}.
- reduceAssetStats: labelById строится из опциональных полей, без полей — пропуск записи.
- DomainBox: kind-точка получает override-класс; без kind — barClass; вторая строка «Выдан · Имя»; alerts → 3 строки фида, без alerts → 4.
- DashboardPage: чипы видны при N>0, скрыты при 0; ссылки на /assets.

## Rollback

Чисто аддитивные опциональные поля/props; откат = revert файлов. Firestore-схема/rules не затронуты.

## Незакоммиченная работа

В дереве есть незакоммиченные правки (SpecsPanel и др.) — работать поверх, git-операций не выполнять.
