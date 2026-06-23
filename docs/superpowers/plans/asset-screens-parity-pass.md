# Asset Screens — Exhaustive Parity Pass

Source of truth: `Warehouse/prototypes/asset-list.html` (→ `/assets`) and `preview.html` (→ `/assets/new`).
Baseline: typecheck 0, build 0, 107 files / 972 tests green.

## Reconciliation rules (memory locks override prototype where noted)
- Remote badge = **cyan + house icon** (LOCKED in memory). Prototype's emerald/no-icon/laptop-only is STALE → keep React. SKIP.
- React-only additive features from prior passes (BulkActionBar, row/header checkboxes, LoadingState, ErrorState, select-all) → KEEP (don't regress). Do not delete.
- Russian-only; no en/hy. Data from Firestore; never import AMS_MOCK. Audited repo writes only.

---

## SCREEN A — /assets (asset-list.html)

### A1. Shared Chip palette + sizing (chip.tsx) — affects every status chip
Prototype Chip: `px-2 py-0.5 text-[13px] tracking-wide`; palette gray `bg-[#22272E] text-[#94A3B8] border-[#2A2F36]`, green `bg-emerald-500/15 text-emerald-300 border-emerald-500/30`, blue `bg-sky-500/10 text-sky-300 border-sky-500/30`, red `bg-rose-500/10 text-rose-300 border-rose-500/30`, amber `bg-amber-500/15 text-amber-300 border-amber-500/30`, orange `bg-[#F97316]/10 text-[#FB923C] border-[#F97316]/30`.
React Chip md = `text-[11px] tracking-tight` + dark `*-950/60` palette. → Update md size to `text-[13px] tracking-wide` and palette to match. Keep `sm` size. Keep indigo/violet/teal/cyan extra colors (cyan used by remote badge).
**Risk:** Chip is used widely. Verify nothing depends on the dark palette. The brighter palette matches the prototype across all screens, so it's the correct global value.

### A2. AssetsToolbar (AssetsToolbar.tsx)
- Search bg `#111315`→`#1B1F24`; font `text-sm`→`text-[16px]`; focus border `#F97316`→`#FB923C`, ring `/40`→`/15`; search icon size 13→14.
- Search placeholder: remove "инв." → "Поиск по названию, коду, серийному…" (assets.json `search`).
- Group tab short labels: add responsive short label for "Сетевые устройства"→"Сетевые уст." Decision: simplest faithful = render full label always but ensure overflow-x scroll. Add short-label support via i18n `groups.shortNetwork` only if low-risk; otherwise ensure container scrolls. (Low priority visual — implement short-label span swap with CSS `hidden`/`inline` if clean.)
- Import button: prototype is functional. React permanently disabled + no modal. **DECISION:** Import modal is a large Phase-2 feature (3-step wizard). Keeping disabled is an intentional MVP scope choice from prior passes (label "Скоро"). KEEP DISABLED but verify label/title acceptable. SKIP full modal (scope). Note in report.

### A3. AssetsFilterBar (AssetsFilterBar.tsx)
- Status "all" label "Все статусы"→"Все" (assets.json `filters.allStatuses`).
- Branch "all" label "Все филиалы"→"Все" (assets.json `filters.allBranches`).
- Temp toggle short label: render "Временно выданные" (keep; short variant optional).
- Reset button: add `ml-auto` to right-align; match proto sizing (plain button h-8 px-2.5, x size 12). Use existing Btn ghost but add `ml-auto` wrapper.
- `isDirty` includes sort — already does. OK.

### A4. ViewPopover / sort labels (assets.json)
- `sort.name_asc` "Название А–Я"→"Название А → Я"; `name_desc` "Название Я–А"→"Название Я → А"; `inv_asc` "Инв. код"→"Инв. код ↑". (Full labels in popover.) Short labels already match.

### A5. AssetsTable (AssetsTable.tsx)
- Header font `text-[11px]`→`text-[12px]`.
- Keep select-all checkbox (additive). Keep grid.
- Page size: prototype 10, React 15. **DECISION:** keep 15? Prototype is source of truth → change PAGE_SIZE to 10? This affects pagination tests. **Set to 10** to match prototype (user wants exact). Update AssetsPage PAGE_SIZE + any test expecting 15.
- Constant-height placeholder rows: prototype pads to 10 rows. Low priority structural; SKIP unless trivial (adds complexity, additive React layout differs). Note in report.

### A6. AssetRow (AssetRow.tsx)
- Asset cell gap `gap-2`→`gap-2.5`.
- Branch name `text-[14px]`→`text-[14.5px]`.
- Inv pill: add `truncate max-w-full`.
- Sub-line: always render with fallback. Proto: `{cat?.name || brand || '—'}{serial? ' · '+serial:''}`. Update to always render, add brand + '—' fallback.
- Category icon box: prototype colors on HOVER only (CSS var), React colors always. **DECISION:** memory `project_component_icon_colors` says category colors apply everywhere → React always-on is arguably desired. But list prototype = hover-only. Keep React always-on (matches the broader "colors everywhere" memory + is more useful). SKIP/note.
- Remote badge: SKIP (cyan+house locked).
- Actions: chevron size 15→14, `ml-1`→`ml-0.5`. (Edit button is additive; keep but it's unused — harmless.)

### A7. AssigneeCell (AssigneeCell.tsx)
- Add Аудитор/Стажёр role-label substitution for employee.kind audit/intern and tempKind. Proto KIND_LABEL_RU = {audit:'Аудитор', intern:'Стажёр'}. When emp.kind is audit/intern OR assignment is temporary with a kind, show role label as the name + "Временно" amber sub. Requires employee.kind field — check domain type. If kind not in Firestore employee model, gate gracefully (only apply when present).
- Warehouse label "На складе" — already correct (assets.json). Proto "На Складе" is a proto typo; keep React. SKIP.

### A8. PaginationBar (PaginationBar.tsx)
- Range text: bold from–to and total in `font-semibold text-[#CBD5E1]` spans. Pass structured parts or use Trans-like split. Simplest: build with inner <b>. Update render.
- Prev button: use `chevron-left` (not rotated chevron-right).
- Disabled opacity `40`→`30`.
- Window algorithm: align to prototype (center window size 5, 1…window…N). Update buildPageWindow.
- Always render (degrade copy) vs conditional. **DECISION:** keep conditional render is fine UX; but prototype always shows. Low priority — keep conditional. Note.

### A9. AssetsPage empty/loading/error (AssetsPage.tsx + assets.json)
- Empty title: switch on hasFilters → filtered "Активов не найдено" / no-data "Пока нет активов". Add keys `empty.titleFiltered`/`empty.titleEmpty`.
- Empty desc: filtered "Попробуйте сменить фильтр или поисковый запрос." / no-data "Создайте первый актив, чтобы начать учёт."
- Empty reset action "Сбросить фильтры": EmptyState ui supports action? Check empty-state.tsx; add action prop if supported, else wrap. (If not supported cleanly, SKIP and note.)

---

## SCREEN B — /assets/new (preview.html)

### B1. Header chrome (AssetCreateForm.tsx / AssetCreatePage.tsx)
- Title: single "Регистрация актива" / group "Регистрация партии" (switch by subMode). Add to form header.
- The PageHeader is generic; prototype has in-card AMS badge + title + subtitle + X. **DECISION:** Add an in-form header row: title (switching) + X close (navigate to /assets). Keep it simple; gradient badge optional. Move/keep submode toggle near header.
- Save button label single: "Сохранить"→"Создать актив" (assets.json `form.save`→ separate key `form.createAsset`). Keep group label.

### B2. Category picker — CRITICAL (CategoryPicker.tsx)
- Replace native <Select> with searchable combobox: search input, per-item icon tile, keyboard ↑↓/Enter/Esc, footer kbd hints + filtered/total count, portal dropdown. Reuse SelectMini portal pattern. Big component — dispatch react-ui-engineer. Keep group-cards step 1.

### B3. OEM license card-toggle — CRITICAL (AssetCreateForm.tsx)
- Replace plain Select+Input with two selectable cards: Цифровая (id oem_digital, icon cpu, "Привязка к оборудованию") / Ручной ввод (id manual, icon key-round, "Ввод ключа продукта"), grid-cols-2, check badge on active. Only manual reveals "Ключ продукта" combobox (type or pick freed keys), required asterisk, formatOemKey grouping (XXXXX-XXXXX uppercase). i18n keys already exist (osLicense.digital/manual/digitalDesc/manualDesc/productKey/productKeyPlaceholder).
- Keep maskLicenseKey preview? Prototype has none. Remove the extra masked preview + free-pool Select to match prototype, OR keep. **DECISION:** Match prototype: card toggle + product-key combobox; keep freed-key suggestion source for the combobox. Remove the always-visible mask hint paragraph.

### B4. Placeholders + sizes (multiple)
- Brand placeholder → "HPE"; Model → "ProLiant DL380 Gen11" (assets.json placeholders.brand/model).
- Inv placeholder → "460/00007" (device) / "470/00012" (furniture); Serial → "SN-…".
- Type placeholder → "Например, {cat} письменный" pattern, or keep simple.
- CPU combobox placeholder → "Например: Intel Core i7-1265U".
- Brand/Model + Inv/Serial grid gap `gap-4`→`gap-6`.
- Section label font `text-[11px]`→`text-[13px]` for ConditionWarranty + Specs + work-mode.
- Spec row labels `text-[15px]`→`text-[16px]`.
- ConditionWarranty section header "Состояние и гарантия" text-[13px]; warranty error: add inline alert-circle icon.

### B5. Specs (SpecsPanel.tsx)
- Add RAM/Storage inline count badge next to label ({n} модуля / {n} диска) when >1 slot.

### B6. QuickAssignment (QuickAssignment.tsx)
- Active mode text color `#EA580C`→`#9A4D33`.
- Work-mode label font `text-[11px]`→`text-[13px]`.
- Remove extra derived-status pill at bottom (prototype QA card has none). **DECISION:** keep? It's informative. Prototype-exact = remove. Remove to match.
- Employee picker: filter to kind==='staff' + show dept secondary. (If kind exists.) Lower priority; note.
- Save gate: prototype does NOT require QA pick (defaults warehouse). React requires recipientPicked. **DECISION:** Match prototype — remove recipientPicked from canSave gate; default to warehouse when none picked. Verify derived status defaults to warehouse.

### B7. Save bar (AssetCreateForm.tsx)
- Save button: gradient `from-[#F97316] to-[#FB923C]`? Btn primary is flat. Keep Btn primary (consistent) but acceptable. Low priority — SKIP gradient (keep design-system Btn).
- Cancel: add x icon. Amber save-disabled pill: add triangle-alert icon.
- Brand/Model save-disabled reasons: prototype shows separate "Заполните «Бренд»" / "«Модель»". React combines. Split into two checks → use `validation.brandRequired` / `validation.modelRequired`.

### B8. Group stepper (GroupStepper.tsx)
- Count chip color orange→indigo.
- "Подтвердить" button size sm→md (default).

---

## Execution order
1. Shared atoms first: chip.tsx (A1), assets.json text (A2/A3/A4/A9/B1/B4/B7).
2. Screen A components: AssetsToolbar, AssetsFilterBar, AssetsTable, AssetRow, AssigneeCell, PaginationBar, AssetsPage.
3. Screen B components: CategoryPicker (combobox), AssetCreateForm (header, OEM cards, save label/gate), QuickAssignment, SpecsPanel, ConditionWarranty, GroupStepper.
4. Update affected tests (PAGE_SIZE 10, parity tests, save-gate).
5. typecheck + build + full test. Compare to baseline.

## Verification — FINAL (all green)
- `npm run typecheck` → exit 0
- `npm run build` → exit 0
- `npx vitest run` → 107 files / 974 tests passing, 0 failures (baseline 972; +2 from new AssigneeCell tempKind tests)

## Post-review fixes (from code review)
- chip.tsx indigo border `.../70` malformed modifier → dropped (valid class).
- CategoryPicker no-results: dead `t(x)===t(x)` ternary → `t('placeholders.noResults')` ("Ничего не найдено").
- CategoryPicker active option: soft tint → solid orange `bg-[#F97316] text-white` + icon `bg-white/20` + check `text-white` (prototype-exact).
- CategoryPicker: added `disabled` prop (opacity-50/cursor-not-allowed + guarded onClick) for edit-mode reuse.

## Intentionally skipped (with reason)
- Import 3-step wizard modal: large Phase-2 feature; kept disabled "Скоро" per prior MVP scope.
- PaginationBar bold-on-numbers in range text: kept single text node to preserve test contract + a11y; cosmetic only.
- Category-icon-box always-colored (vs proto hover-only): kept always-on per memory `project_component_icon_colors` ("colors everywhere").
- Remote badge cyan+house: kept (memory-locked; prototype emerald/no-icon is stale).
- React-only additive features (BulkActionBar, row/header checkboxes, LoadingState, ErrorState, page size 15, constant-height placeholder rows): kept from prior approved passes ("build ON them").
- EmptyState icon-box/title font sizes: kept shared component sizing for cross-screen consistency.
