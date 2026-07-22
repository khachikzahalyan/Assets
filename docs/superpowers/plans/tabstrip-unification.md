# TabStrip unification — one shared underline-tab component

Owner order (2026-07-22): the app has FOUR visually divergent implementations of the same
tab scheme («icon + label + counter, active = orange text + orange underline»). Create ONE
shared component `src/components/ui/TabStrip.tsx` and migrate every site to it.

Constraints (owner, non-negotiable):
- NO git operations, NO deploys.
- NO file editing via PowerShell (corrupts UTF-8) — Read/Write/Edit tools only.
- Visual etalon = asset-detail tabs (`DetailTabs.tsx`) + count badge from licenses
  screenshots (active orange badge, inactive gray) + existing `tabIndicatorIn` animation.
- No per-page render variations; only an optional `size` prop.
- Right-side slots (buttons) are NOT part of the component — pages place them in a flex row.
- Behavior preserved 1:1 (counters, handlers, page/filter resets); tests updated without weakening.

## Inventory (audited 2026-07-22)

Underline-scheme sites (ALL migrate):
1. `src/components/features/assets/detail/DetailTabs.tsx` — ETALON. Icon+label, no counts.
   Active `text-accent-light`, underline `h-0.5 bg-accent-light rounded-full` (no animation),
   inactive `text-text-subtle hover:text-text-tertiary`, icon `max-md:hidden`.
   Has feature chrome: card container classes, visibleTabs filter (showSpecs/showDocs),
   right-side «Добавлено {date}» span, `aria-controls={'panel-'+id}`, `id={'tab-'+id}`.
2. `src/components/features/parts/PartsTabsHeader.tsx` — icon+label+count (devices only,
   badge HIDDEN when 0), underline via `after:` pseudo, divergent text sizes/colors.
   Right side: `Btn` + `MobileAddButton` in same flex row.
3. `src/pages/licenses/LicensesPage.tsx` (~L313-365) — icon+label+count (0 shown),
   `data-testid="tab-keys" / "tab-subs"`, underline + `tabIndicatorIn` animation.
4. `src/components/features/licenses/WindowsKeysSection.tsx` (~L269-304, filterChips) —
   label+count (0 shown), no icons, `data-testid="filter-in_use" / "filter-free"`,
   slightly smaller text (13px), `max-md:py-2.5`.
5. `src/pages/catalogs/CategoriesPage.tsx` (~L226-244) — text-only, `border-b-2 -mb-px`
   scheme (4th visual variant). «+ Добавить» button in same flex row (stays page-side).

NOT in scope (different visual scheme — pills/chips, not underline):
- `src/components/features/parts/CategoryChipStrip.tsx` (rounded-full chips)
- `src/components/features/assets/create/GroupTabs.tsx` (rounded-2xl pill cards)

## Component spec — `src/components/ui/TabStrip.tsx`

```ts
export interface TabStripItem<T extends string = string> {
  id: T
  label: string          // pre-translated by the page
  icon?: string          // lucide name; hidden on mobile (max-md:hidden), size 14
  count?: number         // optional; when provided, 0 IS rendered
  testId?: string        // optional data-testid on the button
  ariaControls?: string  // optional aria-controls (asset detail panels)
}
export interface TabStripProps<T extends string = string> {
  tabs: TabStripItem<T>[]
  active: T
  onChange: (id: T) => void
  size?: 'md' | 'sm'     // md = page tabs (default); sm = filter strips
  className?: string     // extra classes on the tablist container
  'aria-label'?: string
}
```

Render (locked, uniform):
- Container: `role="tablist"`, `flex items-center gap-1 overflow-x-auto no-scrollbar
  flex-nowrap min-w-0` + className. Bottom border line stays on the PAGE container.
- Button: `type="button"`, `role="tab"`, `aria-selected`, `relative flex items-center
  gap-1.5 shrink-0 whitespace-nowrap font-medium transition-colors`
  + md: `px-4 py-3 text-[13.5px]` / sm: `px-3 py-3 max-md:py-2.5 text-[13px]`
  + active `text-accent-light`, inactive `text-text-subtle hover:text-text-tertiary`.
- Icon: `<Icon name size={14} className="max-md:hidden" />`.
- Count badge (only when `count !== undefined`): `text-[12px] font-semibold px-1.5 py-0.5
  rounded-md tabular-nums` + active `bg-accent/15 text-accent-light`,
  inactive `bg-surface-2 text-text-subtle`.
- Active underline: `<span className="absolute bottom-0 left-0 right-0 h-0.5
  bg-accent-light rounded-full" style={{ animation: 'tabIndicatorIn 160ms
  cubic-bezier(0.16,1,0.3,1) both' }} />`.
- When `ariaControls` set: also set `id={'tab-'+id}` on the button.
- exactOptionalPropertyTypes: use conditional-spread idiom for optional attrs.
- Export from `src/components/ui/index.ts`.

## Migration tasks

1. **TabStrip.tsx** — new component per spec + export. Update the stale comment in
   `src/index.css` L379 («used by license tab strip») → «used by TabStrip underline».
2. **DetailTabs.tsx** — keep as thin feature wrapper (visibleTabs filter, container card
   chrome, addedDate span); replace the inline button loop with `<TabStrip size="md">`,
   passing `ariaControls: 'panel-'+id`. Labels via existing t() keys.
3. **PartsTabsHeader.tsx** — replace inline tablist loop with TabStrip. Preserve 1:1:
   devices count badge hidden at 0 → pass `count: devicesCount > 0 ? devicesCount : undefined`.
   Btn/MobileAddButton stay page-side in the flex row.
4. **LicensesPage.tsx** — replace loop; `testId: 'tab-keys' | 'tab-subs'`; counts always
   (incl. 0). Right cluster (search/add) untouched.
5. **WindowsKeysSection.tsx** — replace filterChips with `<TabStrip size="sm">`;
   `testId: 'filter-in_use' | 'filter-free'`; counts always. Header container keeps its
   border-b.
6. **CategoriesPage.tsx** — replace loop with TabStrip (labels only — no icons/counts
   today, preserve). «+ Добавить» stays in the flex row beside it.
7. Delete all four old inline tab markups. Grep re-check: no remaining
   `tabIndicatorIn` inline usages outside TabStrip; no remaining `border-b-2 -mb-px` tab
   buttons.

## Tests

- Update/keep green: `LicensesPage.test.tsx`, `WindowsKeysSection.test.tsx`
  (incl. class assertions ~L480), `PartsPage.test.tsx`, any asset-detail tests.
  Do NOT weaken assertions; testIds preserved by design.
- Add `src/components/ui/TabStrip.test.tsx`: renders tabs, aria roles/selected,
  count 0 rendered, count undefined → no badge, onChange fires, testId passthrough.

## Verification

- `npm run build` (tsc -b is stricter than --noEmit; must pass)
- FULL `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`
