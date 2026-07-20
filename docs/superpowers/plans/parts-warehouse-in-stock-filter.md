# Parts / Склад — show only in-stock sizes, empty state when category has no stock

**Date:** 2026-07-07 · **Branch:** refactor/pages-structure · **Requested by user (explicit spec, no open questions).**

## Problem

On the Parts page («Запчасти»), «Склад» tab, when a category has zero stock (e.g. SSD chip shows «SSD 0»),
the UI still enumerates the full size catalog: header «SSD / 9 размеров» plus rows 64 ГБ … 5 ТБ each with a
«0шт» badge. This happens on mobile (WarehouseSizedDetail) and partially on desktop (PartCard subtitle counts
all catalog sizes; WarehouseTab right panel shows 0-stock rows / «0 шт» agg row).

## Required behavior (user's words, clarified)

1. Category has NOTHING in stock → do NOT enumerate sizes with 0шт; show simple empty state «нет на складе».
2. Category HAS stock → show ONLY entries with quantity > 0; hide zero-quantity rows entirely.
3. Header count («N размеров») reflects only in-stock sizes.
4. Applies to BOTH mobile and desktop warehouse stock presentations.

## Definition of "in stock"

- Sized categories (ssd/hdd/nvme/ram) mobile rows: `workingStock(stock) > 0` (existing helper,
  `src/domain/part/partStock.ts`).
- Desktop per-SKU rows (psu/cooler/gpu) and agg summary row: visible when `onHand > 0 || broken > 0`
  (a broken part is physically on the shelf and the row renders the red chip; hiding it would hide data).
- PartCard expanded variant list already filters `onHand > 0` — unchanged; only the subtitle count changes.

## Reuse (GOLDEN RULE — search before creating)

- Empty state: `EmptyState` from `src/components/ui/empty-state.tsx` (icon/title/description props).
- i18n keys (already exist in ru/en/hy `parts.json`, namespace `parts`):
  - `warehouse.noStock` — ru «Нет на складе», en "Out of stock", hy «Պահեստում չկա» → empty-state title.
  - `warehouse.noneAvailableHint` — ru «Используйте «Добавить запчасть»…» → description.
  - GPU-специфика: keep existing `warehouse.emptyGpu` / `emptyGpuHint` + Add button branch.
- NO new locale keys, NO new components unless extraction is needed for the 300-line limit.

## Files & changes

1. `src/components/features/parts/WarehouseSizedDetail.tsx` (mobile sized categories)
   - `visibleSkus`: additionally filter `workingStock(stockMap[s.id] ?? {onHand:0,broken:0}) > 0`.
   - `sizeLabel`: counts the filtered (in-stock) list. When the whole category has zero working stock,
     subtitle shows `t('warehouse.noStock')` instead of «0 размеров».
   - Whole category empty (`totalOnHand === 0`): render `<EmptyState icon="package-open" title={t('warehouse.noStock')} description={t('warehouse.noneAvailableHint')} />` in place of the DDR toggle + rows.
   - Category has stock but selected DDR gen has none (RAM only): keep toggle, show the existing
     small centered message but with `t('warehouse.noStock')`.
   - Remove the `0шт` muted-pill row branch (rows are now always in stock).

2. `src/components/features/parts/PartCard.tsx` (desktop left column)
   - Subtitle count: count only variants whose SKU exists AND `stockOf(sku.id).onHand > 0`
     (consistent with the already-filtered expanded list). Keep existing pluralization strings.
   - Expanded list + `noneAvailable` empty block: unchanged.

3. `src/components/features/parts/WarehouseTab.tsx` (desktop right panel + mobile GPU branch)
   - Per-SKU rows: `visibleSkus = selectedSkus.filter(s => { const st = stockOf(s.id); return st.onHand > 0 || st.broken > 0 })`.
     Update the stale comment («per owner: don't hide out-of-stock parts») — decision reversed by owner 2026-07-07.
   - Zero visible rows: GPU keeps `emptyGpu` branch with Add button; non-GPU shows
     `EmptyState` with `warehouse.noStock` + `warehouse.noneAvailableHint`.
   - AGG summary row: when `totalWorking === 0 && totalBroken === 0` render the same noStock empty state
     instead of the «0 шт» row.
   - File is already 327 lines (>300 budget): extract the empty-state JSX into the shared `EmptyState`
     usage (deletes the bespoke block) and/or extract `renderSkuList` into a sibling module if needed
     to get ≤300 lines.

4. `src/components/features/parts/WarehouseMobileDetail.tsx` (mobile psu/cooler)
   - `installSku`: drop the `?? skus.at(0)` fallback — only a SKU with `workingStock > 0`; at zero stock
     the Install button disappears (currently it opens InstallModal for a 0-stock SKU — adjacent bug).
   - Zero stock: total chip switches to the muted style (`bg-surface-2 border-border text-text-subtle`,
     same pattern as WarehouseSizedDetail header). HistoryPanel stays (history is still meaningful).

## Tests

- New `src/components/features/parts/WarehouseSizedDetail.test.tsx` (mock react-i18next like
  `src/pages/parts/PartsPage.test.tsx`): (a) zero-stock category → noStock empty state, no size rows;
  (b) mixed stock → only in-stock rows rendered, header count matches in-stock count; (c) RAM DDR gen
  with no stock → noStock message, toggle still present.
- Extend nothing else (no existing tests cover WarehouseTab/PartCard rendering paths).

## Out of scope

- `PartsReceiveSizedCatCard` / receive flow — must keep listing ALL sizes (you receive new stock there).
- Localizing the pre-existing hardcoded Russian pluralization («N размеров») — pre-existing debt, unchanged.
- `deriveStock` / `workingStock` semantics — untouched.

## Verification

- `npm test -- --run`
- `npm run build` (tsc -b with exactOptionalPropertyTypes — stricter than tsc --noEmit; use conditional-spread
  idiom for optional props).
- NO git add/commit/push (forbidden without explicit user permission).
