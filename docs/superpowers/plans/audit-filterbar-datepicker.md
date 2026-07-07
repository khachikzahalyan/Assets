# Audit filter bar — reuse the custom DatePicker for the date-range filters

## Goal
Replace the two native `<input type="date">` fields («С» / «По») in
`src/components/features/audit/AuditFilterBar.tsx` with the project's existing
custom date picker so the Audit Journal filters match the asset-create form
(«Дата покупки» / «Гарантия до»): dark themed calendar, month header, ПН-ВС
weekday row, orange accent, «Очистить» / «Сегодня» footer, desktop popover +
mobile bottom sheet.

## Golden rule (permanent)
ALWAYS reuse existing components before creating new ones. Here the component
to reuse is `src/components/features/assets/create/DatePicker.tsx`. Cross-feature
import precedent already exists (`src/components/features/employees/DestPicker.tsx`
imports it). Do NOT create a new date picker. Do NOT use
`src/components/features/licenses/DatePopover.tsx` (no Очистить, no mobile sheet).

## Constraints
- No git add/commit/push (user forbids git ops without explicit permission).
- Files ≤300 lines each (branch convention). `DatePicker.tsx` is currently 297
  lines — extract its inner `DPPortal` component into a sibling file to create
  headroom before adding props.
- Must not visually or behaviorally regress existing DatePicker consumers:
  `ConditionWarranty.tsx`, `DestPicker.tsx` (employees), `TransferPanel.tsx`.

## Tasks

### 1. Extend DatePicker with a compact "chip" trigger variant
Files:
- `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/create/DatePickerPortal.tsx` (NEW)
  — move the existing `DPPortal` component (mobile sheet / desktop popover
  wrapper) here verbatim, export it. Keep JSDoc.
- `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/create/DatePicker.tsx`
  — import `DPPortal` from the new file; add optional props:
  - `variant?: 'field' | 'chip'` (default `'field'` — current underline style,
    unchanged markup for existing consumers).
  - `ariaLabel?: string` → `aria-label` on the trigger button.
  - Chip trigger classes mirror the filter-strip chip look used by the current
    native input / SelectMini chips:
    `h-8 px-2 text-[12px] bg-bg border border-border rounded-lg flex items-center gap-1.5 w-full text-left transition-all duration-150`
    with open state `border-accent`, value in `text-text-primary`, placeholder
    in `text-text-subtle`, calendar icon size 13 to the right (`ml-auto`).
  - Calendar surface (popover/sheet) is IDENTICAL for both variants.

### 2. Swap the audit date inputs
File: `C:/Users/DELL/Desktop/assets-crm/src/components/features/audit/AuditFilterBar.tsx`
- Remove `DATE_INPUT_CLASS` and both `<input type="date">`.
- Render two `DatePicker variant="chip"` in fixed-width wrappers
  (`w-[128px] flex-shrink-0`), keeping the visible «С» / «По» text labels
  (`t('filters.from')` / `t('filters.to')`) as `<label htmlFor>` pointing at the
  picker trigger `id`s (`audit-filter-from` / `audit-filter-to`), plus
  `ariaLabel` passthrough.
- Value/format semantics preserved:
  - value = `query.fromDate?.slice(0, 10)` / `query.toDate?.slice(0, 10)`
  - onChange(from): iso ? `${iso}T00:00:00.000Z` : null
  - onChange(to):   iso ? `${iso}T23:59:59.999Z` : null
  - «Очистить» in the picker emits `''` → maps to `null` (clears the bound).
- Cross-bound constraint (DatePicker already supports min/max):
  from gets `max={toDateInput || undefined}`, to gets `min={fromDateInput || undefined}`.
- Mobile: no extra work — the strip already horizontal-scrolls (`max-md:*`
  classes) and DatePicker itself renders a bottom sheet on mobile via
  `useIsMobile`.

### 3. Update tests
File: `C:/Users/DELL/Desktop/assets-crm/src/components/features/audit/AuditFilterBar.test.tsx`
- Rewrite test (f): open the from-picker (click trigger via its accessible
  name), click «Сегодня», assert `onChange` called with
  `{ fromDate: '<today-local-ISO>T00:00:00.000Z' }` (compute today the same way
  DatePicker.formatISO does).
- Add: to-date picks end-of-day bound (`T23:59:59.999Z`) — open to-picker,
  click a day cell (e.g. «Сегодня»), assert suffix.
- Add: clearing — render with `fromDate` set, open from-picker, click
  «Очистить», assert `onChange` with `{ fromDate: null }`.
- `useIsMobile` is jsdom-safe (returns false) → desktop popover branch renders
  in tests; the calendar portals to `document.body`.

### 4. i18n
Tier-1 labels «С»/«По»/reset already exist in `src/locales/{ru,en,hy}/audit.json`
(`filters.from` / `filters.to` / `filters.reset`) — reuse, no new keys. The
DatePicker's internal strings (Сегодня/Очистить, RU months) are hardcoded RU
today for ALL consumers — leave as-is in this task (pre-existing, out of scope).

## Verification
- `npm run typecheck`
- `npm test` (vitest run)
- Line counts: every touched file ≤300 lines.

## Rollback
Revert the three touched files + delete `DatePickerPortal.tsx`; no schema,
rules, or locale changes involved.
