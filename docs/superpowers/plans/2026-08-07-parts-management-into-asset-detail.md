# Консолидация управления комплектующими в детали актива

Дата: 2026-08-07. Статус: согласован с владельцем (Вариант A), ожидает выполнения.
Причина паузы: дневной лимит аккаунта (сброс 8 авг 21:00 Ереван) — не начинаем большой
multi-file change, чтобы не оставить дерево с красными тестами.

## Согласованное решение (владелец выбрал Вариант A)
Всё, что касается конкретного актива, консолидируется в странице деталей актива
(/assets/:id). /parts остаётся только «Складом».

## Ключевая находка (почему это больше, чем «убрать вкладку»)
Вкладка «Устройства» в /parts — единственный вход к действиям **Снять / Заменить / Сервис**
установленной детали (InstalledDetailPanel → UninstallModal / ServiceRecordModal).
Вкладка «Тех. характеристики» в деталях актива сейчас **read-only** + кнопка
«Открыть Запчасти →» (onOpenParts), ведущая в /parts→Устройства.
Значит, при удалении «Устройства» эти действия НУЖНО перенести в детали актива.

Хорошо по квоте: у `part_movements` УЖЕ есть индекс по `assetId`
(firestore.indexes.json) → точечный запрос `where('assetId','==',id)` дешёв.

## Задачи

### A. DetailTabs — вкладки (src/components/features/assets/detail/DetailTabs.tsx + оба вью + AssetDetailSkeleton + тесты)
- Убрать вкладку `docs` (Документы). DocumentsTab компонент НЕ удалять (хранилище не
  настроено — оставить для будущего), убрать только вкладку/рендер/проп showDocs.
- Переименовать `history` → `transfers` (это audit-лог выдач/возвратов — HistoryCard).
  Ключ i18n `detail.tabs.transfers` = «История переводов» в ru/en/hy. Переименовать
  TabId union, все switch, скелетон active-state, тесты.
- Добавить вкладку `parts` (id) = «История запчастей», ключ `detail.tabs.partsHistory`,
  иконка 'cpu' или 'wrench'. Порядок: specs · transfers · parts.

### B. TechSpecsCard — интерактив для комплектующих
- Убрать кнопку «Открыть Запчасти →» (onOpenParts).
- У установленных (НЕ заводских) деталей — действия Снять / Заменить / Сервис.
  ПЕРЕИСПОЛЬЗОВАТЬ InstalledDetailPanel (InstalledBody + onUninstall) + UninstallModal +
  ServiceRecordModal. Не дублировать — вынести/переиспользовать.
- Установка новой детали НЕ добавляется в детали актива (остаётся в /parts→Склад).

### C. Панель «История запчастей»
- Рендер движений этого актива (install/uninstall/service/replace). Переиспользовать
  history-рендер из InstalledDetailPanel или HistoryPanel/HistoryRowMobile.
  Пустое состояние «Записей нет».

### D. Данные (firebase-engineer) — КВОТА
- Метод репозитория `listMovementsForAsset(assetId): Promise<PartMovement[]>` в
  firestorePartRepository.* (+ inMemory паритет + интерфейс PartRepository.ts).
  Точечный `where('assetId','==',id)` — НЕ полный скан коллекции.
- Подключить в src/pages/assets/detail/useAssetDetail.ts. Доп. SKU-имена грузить только
  если движения не содержат достаточных подписей (определить по факту; лишних чтений нет).
- Действия снять/заменить/сервис — через getSharedPartRepository()
  (uninstallPart / recordService / installPart уже есть) + reload деталей после записи.
  Инвалидация ref-кэша уже реализована — не сломать.
- Мапперы не теряют поля (сверить toPartMovement — рецидивная зона).

### E. /parts — убрать «Устройства» (PartsPage.tsx, PartsTabsHeader.tsx)
- Убрать вкладку `devices` из TABS, оставить только `warehouse` (дефолт). Убрать
  devices-ветку мобильного ряда-2 хедера (поиск устройств).
- Убрать рендер DevicesTab + панели устройства + состояние/хендлеры, обслуживавшие ТОЛЬКО
  devices. UninstallModal/ServiceRecordModal/InstalledDetailPanel НЕ удалять — они теперь
  используются в деталях актива. Установка из Склада (InstallModal) остаётся.
- DevicesTab.tsx / DeviceDetailMobileView.tsx — если полностью не используются: оставить
  нерендерящимися ИЛИ удалить, если чисто; синхронно обновить/удалить их тесты.

## Правила
- НИКАКИХ git-операций без явного разрешения.
- TDD RED→GREEN. Переиспользование существующих компонентов. i18n ru/en/hy (идентичные
  наборы ключей). rem-токены, conditional-spread для optional props.
- НЕ трогать файлы дашборда (src/components/features/dashboard/**, src/pages/dashboard/**)
  и сайдбара — там незакоммиченная работа вне этой задачи. .claude/worktrees/** не трогать.
- Финал: полный `npx vitest run` + `npm run build` — оба зелёные.

## Незакоммиченный контекст на момент паузы (не потерять)
Рабочее дерево содержит: редизайн сайдбара (bento nav + единый оранжевый акцент + фон
--color-surface + светлые иконки токеном + light-hover + padding логотипа text-11),
редизайн дашборда (bento-лейаут 5/4/3 + 7/5, StatCard variants, DomainBox variants) и
углубление бокса «Активы» (typed events). ИЗВЕСТНЫЙ БАГ (не пофикшен): в боксе «Активы»
дашборда для событий Выдан/Возвращён в строку попадает СЫРОЙ id документа assignment
(напр. «N80oZkW9YHhRm4Et3Ury») вместо invCode — join по after.assetId не резолвится; надо
дополнительно показывать категорию + бренд/модель (Компьютер · Asus H310). Это отдельная
задача по дашборду, к данному плану не относится.
