# Dashboard: шестая KPI-плитка «Списанные активы»

Дата: 2026-08-05. Статус: план утверждён владельцем (задача полностью специфицирована в запросе).

## Контекст / выводы разведки

- Счётчик уже существует на уровне домена: `reduceAssetStats` (src/domain/dashboard/reducers.ts)
  считает `byStatus` по всем `ASSET_STATUS_IDS`, включая `st_disposed`. Доменных изменений НЕ нужно.
- Канонический статус «Списано»: id `st_disposed`, доступ через константу `ASSET_STATUS.disposed`
  из `@/domain/asset` (src/domain/asset/types.ts). В UI строку не хардкодим — тот же паттерн, что
  у плиток «Выдано сейчас» (`ASSET_STATUS.assigned`) и «На складе» (`ASSET_STATUS.warehouse`).
- Репозитории: `FirestoreDashboardRepository.loadAssetStats` читает ВСЮ коллекцию `assets`
  без фильтра по статусу; `InMemoryDashboardRepository` гоняет тот же `reduceAssetStats`.
  Списанные активы уже попадают в выборку. Паритет есть, репозитории НЕ трогаем.
- Семантика: списанные ВХОДЯТ в «Всего активов» (`total = assets.length`). Существующие плитки
  не меняем — только добавляем новую.
- Сетка ROW 1: `grid grid-cols-2 gap-2 lg:gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]`
  — на lg+ auto-fit сам вместит 6-ю плитку; на мобиле (2 колонки, featured span-2) шестая плитка
  займёт первую ячейку последнего ряда — нормальное поведение грида, класс сетки НЕ меняем.
- Скелетон загрузки рендерит `Array.from({ length: 5 })` — обновить до 6 (и комментарии «5 KPI» → «6 KPI»).
- Иконка: `archive-x` уже зарегистрирована в src/components/ui/icon.tsx (строка ~270). Тон — rose.
- StatCard (src/components/features/dashboard/StatCard.tsx): аксенты
  `'orange' | 'green' | 'blue' | 'violet' | 'amber'`. `violet` — образец «сырого» Tailwind-тона
  с `light:`-вариантами; `rose` добавляем зеркально.
- Недавний фикс фикс-высот боксов в DashboardPage.tsx (ROW 2 skeleton: `h-[13.75rem]`, `min-h-11`,
  reserved caption line) — НЕ трогать.

## Задачи (последовательно)

### T1 — react-ui-engineer
1. `src/components/features/dashboard/StatCard.tsx`:
   - `StatCardAccent` += `'rose'`.
   - `ACCENT.rose` по образцу `violet`:
     iconBox `bg-rose-500/15 text-rose-300 light:text-rose-700`;
     number/label `text-rose-300 light:text-rose-700`;
     hoverBorder `hover:border-rose-500/50`; cardBg `from-rose-500/15 to-rose-500/[0.06]`;
     cardBorder `border-rose-500/30`; glow `bg-rose-500/20`.
2. `src/pages/dashboard/DashboardPage.tsx`:
   - После плитки «Сотрудники» добавить:
     `{assets && <StatCard icon="archive-x" label={t('kpi.writtenOff')} value={assets.byStatus[ASSET_STATUS.disposed]} to="/assets" accent="rose" testId="section-written-off" />}`
   - Скелетон ROW 1: `length: 5` → `length: 6`; комментарии «5 KPI» → «6 KPI».
   - Больше НИЧЕГО не менять (фикс-высоты ROW 2 — свежая работа).

### T2 — i18n-engineer
- `src/locales/ru/dashboard.json`: `kpi.writtenOff = "Списанные активы"` (алфавитный порядок ключей соблюдается? — в файле ключи отсортированы: вставить между `totalAssets`… фактически порядок: вставить с сохранением текущего стиля сортировки).
- `src/locales/en/dashboard.json`: `kpi.writtenOff = "Written-off assets"`.
- `src/locales/hy/dashboard.json`: `kpi.writtenOff = "Դուրս գրված ակտիվներ"`.

### T3 — test-engineer (гейт)
1. Юнит-тест счётчика: у `reduceAssetStats` нет прямого теста на byStatus — добавить
   `src/domain/dashboard/reducers.asset-stats.test.ts`:
   - счёт `st_disposed` (2 списанных из 5 активов → `byStatus.st_disposed === 2`, `total === 5`);
   - «списали актив → счётчик вырос»: пересчёт после смены statusId одного актива на
     `ASSET_STATUS.disposed` даёт +1 к `byStatus.st_disposed` (и total неизменен).
2. Рендер-тест плитки в `src/pages/dashboard/DashboardPage.test.tsx`:
   - seed уже содержит 1 актив `st_disposed` → `within(getByTestId('section-written-off')).getByText('1')`;
   - подпись из i18n (ru): «Списанные активы»;
   - seed с доп. списанным активом → значение «2» (счётчик реагирует).
3. Прогон: `npx vitest run` — полный, зелёный.

### T4 — верификация
- `npx vitest run` (полный) + `npm run build` — оба зелёные. Билд через tsc -b строже
  (`exactOptionalPropertyTypes`) — для опциональных пропсов использовать conditional-spread идиому.

## Ограничения
- Никаких git-операций, никаких stash.
- Не менять существующие 5 плиток, ROW 2, semantics `total`.
- rem-токены, никаких px в компонентах (в этой задаче новые размеры не вводятся).
