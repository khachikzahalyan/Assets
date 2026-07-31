# Adaptive layout continuation — раскладка адаптируется, текст нет

Продолжение работы «универсальная адаптивная вёрстка» (см. fluid-adaptive-typography.md).
Baseline: сборка зелёная, 2186 тестов проходят. Контрольные точки: 1366×768 и ~1920.

## Уже сделано (НЕ переделывать)
- rem-типографика (--fs-9…--fs-22, text-13/text-13.5), мягкий clamp-корень html.
- --content-max-width: none (решение владельца), layout-токены в rem, модалки на --modal-w-*.

## Задачи (порядок исполнения)

### Batch A — дублированный grid + дашборд
1. `AUDIT_GRID` — одна экспортируемая константа в
   `src/components/features/dashboard/AuditTable.tsx`:
   `'10rem 1fr 11.25rem 4.5rem'` (было 160px/180px/72px), применяется через
   inline style `gridTemplateColumns` (или `grid-cols-[var]` эквивалент) в 4 местах:
   AuditTable.tsx:91,114 и DashboardPage.tsx:149,162 (скелетон импортирует ту же
   константу — принцип exact parent footprint). Комментарии-упоминания обновить.
2. Дашборд: ROW 1 статкарты — на lg+ `repeat(auto-fit, minmax(<~10-11rem>, 1fr))`
   (мобильный grid-cols-2 + featured col-span-2 сохранить); ROW 2/3 панели —
   `repeat(auto-fit, minmax(<rem>, 1fr))` вместо жёстких lg:grid-cols-2/3.
   Скелетон DashboardPage — синхронно, теми же классами/константами.

### Batch B — таблицы списков
3. px→rem в minmax: LicensesPage.tsx:474 (скелетон ключей — сверить с реальной
   таблицей вкладки), PartsReceivePage.tsx:173,340 (160px→10rem),
   CategoriesPage.tsx:212 (80px→5rem), EmployeesTable.tsx GRID_COLS (180px→11.25rem,
   120px→7.5rem, 140px→8.75rem, 110px→6.875rem, 160px→10rem, 80px→5rem, 100px→6.25rem),
   фикстуры TableSkeleton.test.tsx — на rem для единообразия.
   Длинные строки (email, ключи) — truncate/overflow-wrap; тулбары — flex-wrap;
   без горизонтального скролла. DataTable height 44 НЕ трогать (touch 44px).

### Batch C — детальные страницы/формы + остатки px
4. AssetDetail (Desktop/Mobile view, скелетон), AssetCreateForm, Employee detail:
   grid/flex с minmax в rem, поля с max-w в rem/ch, контейнер — полная ширина.
5. Контрольные высоты px → var(--ctl-h-*); px-spacing → rem-утилиты.
   Шиммеры скелетонов и иконные бейджи менять ТОЛЬКО если изменился родитель;
   тесты скелетонов обновлять в той же правке.

### Batch D — модалки + верификация
6. Опционально: константы MODAL_W_SM/MD/LG/XL (`w-full max-w-[var(--modal-w-*)]`)
   в src/components/ui/styles.ts, применить в ~10 диалогах.
7. `npm run build` + `npm test` после каждой пачки. Финал: Playwright-скриншоты
   1366×768 / 1440 / 1920 / 2560 (логин + доступное без auth), проверка
   scrollWidth <= innerWidth. Auth не обходить.

## Жёсткие ограничения
- Никаких git-операций записи. Не трогать: печать этикеток (2in TSC TDP-225),
  iOS font-size:16px !important ≤767px, touch 44px, lucide size={N},
  FLUSH_ROUTES + ListCard mx-[10px], мобильный блок index.css ≤767px.
- Не возвращать: кап контента, vw-корень, vw-надбавки в токенах.
- Переиспользовать src/components/ui/*, styles.ts. Одноразовые скрипты не оставлять.

## Верификация
`npm run build` зелёный; `npm test -- --run` — все 2186+; скриншоты + таблица
«ширина → h-scroll». Отчёт на русском.
