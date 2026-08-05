# Parts / Склад (mobile): SKU-picker перед InstallModal при нескольких позициях

## Проблема
Мобильная вкладка Склад, категория с несколькими SKU с остатком (пример владельца:
«Видеокарта» — GeForce RTX 3010 и RTX 5040). Кнопка «Установить» сразу открывает
InstallModal для ПЕРВОГО SKU с остатком — выбор запчасти пропущен.

Два одинаковых бага (`skus.find(s => workingStock(...) > 0)`):
1. `src/components/features/parts/WarehouseMobileDetail.tsx:35` — single-pos ветка (PSU/Cooler,
   а также любые live-категории, попадающие в этот branch с >1 SKU).
2. `src/components/features/parts/WarehouseTab.tsx:190` — ветка `isModelsCat` (GPU / модели);
   судя по «GeForce RTX» на скриншоте, реальный путь бага — именно этот.

## Эталон (уже в проекте)
`WarehouseSizedDetail.tsx` (SSD/HDD/M.2/ОЗУ) решает ту же задачу правильно:
- 0 in-stock → кнопки нет; 1 → сразу `onInstall(sku)`; >1 → `MobileSheet`-пикер
  (строки: label + stock-chip «N шт» + chevron), выбор → закрыть sheet + `onInstall`.

## Решение
1. **Извлечь общий пикер** `WarehouseInstallSkuSheet` (новый файл в
   `src/components/features/parts/`): обёртка над `MobileSheet` со списком строк
   `{ sku, onHand, label, sublabel? }`, `onPick(sku)`. Стили строк — 1:1 из
   WarehouseSizedDetail (rem/токены, Chip green dot, chevron-right, border-b border-border/60).
2. **WarehouseSizedDetail** — перевести на общий пикер (поведение и тесты не меняются,
   title остаётся `warehouse.pickSizeTitle`).
3. **WarehouseMobileDetail** — вместо «первый SKU»: список in-stock; 1 → прямой install,
   >1 → пикер с title `warehouse.pickSkuTitle`. Label строки = `sku.name`
   (+ `variantLabel`/`ddr` как muted-suffix при наличии).
4. **WarehouseTab, ветка isModelsCat** — убрать дубль бага: добавить в
   `WarehouseMobileDetail` опциональный `extraHeaderAction?: ReactNode` (зелёный чип
   «Добавить видеокарту») и маршрутизировать models-ветку через WarehouseMobileDetail;
   либо, если это ломает разметку, применить ту же picker-логику в ветке напрямую
   через общий пикер. Первый вариант предпочтителен (устраняет дубликат кода).

## i18n
Новый ключ `warehouse.pickSkuTitle` в `src/locales/{ru,en,hy}/parts.json`:
ru «Выберите запчасть», en "Choose part", hy «Ընտրեք պահեստամասը».

## Тесты (TDD — сначала RED)
Новый `WarehouseMobileDetail.test.tsx` (мок react-i18next как в WarehouseSizedDetail.test.tsx):
- (a) 0 in-stock → кнопки «Установить» нет;
- (b) ровно 1 in-stock → тап → `onInstall` сразу, sheet не появляется;
- (c) 2 in-stock → тап → sheet со списком обоих SKU (имена + «N шт»), `onInstall` НЕ вызван;
- (d) тап по второму SKU → `onInstall` с ним, sheet закрыт;
- (e) `extraHeaderAction` рендерится в header (если prop добавлен).
Плюс покрытие models-пути (через WarehouseMobileDetail, если ветка смаршрутизирована туда).
Существующие тесты (InstallModal.test, WarehouseSizedDetail.test, HistoryPanel.test) — зелёные.

## Правила
- Никаких git-операций. Не трогать несвязанные изменённые файлы
  (SpecsPanel.tsx, specSuggestions.ts — чужие незакоммиченные правки).
- rem-токены, без px; реиспользовать Chip/Icon/MobileSheet/MobileListRow.
- Скелетоны не нужны.

## Верификация
`npx vitest run` полностью зелёный + `npm run build` (tsc -b) зелёный.
