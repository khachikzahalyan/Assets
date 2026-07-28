# Mobile Picker Owner Rule Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every picker (date, select, combobox, multi-select) that opens inside a modal/bottom-sheet/drawer on mobile (≤767px) must open its own `MobileSheet` (z-9000) above the parent — never a cramped anchored popover.

**Architecture:** Add an `isMobile` branch directly inside each picker component; the branch renders `<MobileSheet title={...}>` wrapping the same inner JSX that the desktop popover already renders. Desktop behavior is untouched. `useIsMobile` (first-paint-correct) gates which branch renders. Single-select pickers close on pick; multi-selects close via «Готово».

**Tech Stack:** React 19, TypeScript (exactOptionalPropertyTypes), Tailwind CSS, react-i18next, MobileSheet (src/components/ui/MobileSheet.tsx), useIsMobile (src/hooks/useIsMobile.ts), useDismissOnOutside (src/hooks/useDismissOnOutside.ts).

---

## Scope analysis — which pickers need changes

| Component | Used inside modal/sheet on mobile? | Needs change? |
|---|---|---|
| `ui/DatePicker.tsx` | YES — inside TransferPanel (AssignmentCardMobile) and DestPicker (HandoverModal) | YES |
| `ui/MiniDropdown.tsx` | YES — inside RamSlots+StorageSlots used in SpecsPanel inside AssetCreateForm page-level (NOT a modal) → OUT OF SCOPE | NO — page-level only |
| `ui/SpecCombobox.tsx` | YES — inside LicensePicker (AssetCreateForm page-level) and SpecsPanel (page-level) → OUT OF SCOPE | NO — page-level only |
| `features/employees/DestPicker.tsx` | YES — inside HandoverModal (portal modal z-50) and EmployeeDetailDrawer transfer bar | YES |
| `features/licenses/LicensePicker.tsx` | Inside AssetCreateForm page-level only; SpecCombobox inside it is page-level | NO — page-level only |
| `features/licenses/DatePopover.tsx` | ALREADY CONFORMANT | SKIP |
| `features/licenses/EmployeeMultiSelect.tsx` | ALREADY CONFORMANT | SKIP |
| `features/assets/create/SearchSelect.tsx` | ALREADY CONFORMANT | SKIP |
| `features/assets/create/CategoryPicker.tsx` | ALREADY CONFORMANT | SKIP |
| `features/assets/detail/TransferPanel.tsx` — DatePicker inside it | TransferPanel is used by AssignmentCardMobile (mobile-only, always visible inline, not inside a portal modal) | YES — DatePicker used inside an always-visible mobile card; needs MobileSheet branch in DatePicker |
| `features/licenses/ActivateKeyModal.tsx` | Only contains a search input and radio list — no picker components | NO |
| `features/employees/HandoverModal.tsx` — DestPicker inside it | HandoverModal is a portal modal (z-50 → 1000) | YES — DestPicker conversion handles this transitively |

**Root cause summary:**
1. `ui/DatePicker.tsx` currently uses `DPPortal` which on mobile renders as a z-1000 bottom sheet — **but this stacks BELOW MobileSheet parent modals (z-9000)**. Must switch to MobileSheet on mobile.
2. `features/employees/DestPicker.tsx` opens a portal popover at z-60 on desktop; on mobile it positions itself at `left:8 right:8 bottom:8` — still a fixed-position popover that can be obscured by parent sheets. Must open a MobileSheet sub-sheet on mobile. The inner date picker inside DestPicker's "temporary" sub-panel shares the DatePicker fix above.

---

## File Structure

### Files to modify

| File | Change |
|---|---|
| `src/components/ui/DatePicker.tsx` | Add `isMobile` branch: render `<MobileSheet>` instead of `DPPortal` on mobile; guard the `updatePos` effect with `if (!open \|\| isMobile) return` |
| `src/components/ui/DatePickerPortal.tsx` | Remove the mobile bottom-sheet branch (it becomes dead code once DatePicker owns the MobileSheet) — replace with a guard that returns null on mobile (desktop portal only) |
| `src/components/features/employees/DestPicker.tsx` | Add `isMobile` branch: on mobile render `<MobileSheet>` with the full picker content; no raw fixed-position portal on mobile |
| `src/locales/ru/employees.json` | No new keys needed — `dest.*` keys already exist; `dest.returnDate` used as MobileSheet title for DestPicker date sub-sheet |
| `src/locales/ru/assets.json` | Verify `detail.transfer.returnDateLabel` exists (already used in TransferPanel label) |

### Files NOT to modify

- `src/components/features/licenses/DatePopover.tsx` — already conformant
- `src/components/features/licenses/EmployeeMultiSelect.tsx` — already conformant
- `src/components/features/assets/create/SearchSelect.tsx` — already conformant
- `src/components/ui/MiniDropdown.tsx` — only used on page level (SpecsPanel in AssetCreateForm page)
- `src/components/ui/SpecCombobox.tsx` — only used on page level
- `src/components/features/employees/HandoverModal.tsx` — no change; DestPicker fix handles sub-pickers transitively
- `src/components/features/assets/detail/TransferPanel.tsx` — no change; DatePicker fix handles the date picker inside it transitively
- `src/components/common/ProfileMenu.tsx` — explicitly excluded by task

---

## Task 1: Fix `ui/DatePicker.tsx` — add MobileSheet branch

**Context:** DatePicker currently uses `DPPortal` which on mobile renders a z-1000 bottom sheet. This is lower than parent MobileSheet modals (z-9000). The fix: on mobile, render `<MobileSheet>` directly instead of going through `DPPortal`. On desktop, keep `DPPortal` exactly as is.

**Files:**
- Modify: `src/components/ui/DatePicker.tsx`
- Modify: `src/components/ui/DatePickerPortal.tsx`

- [ ] **Step 1: Read both files in full**

Read `src/components/ui/DatePicker.tsx` (already done — 262 lines) and `src/components/ui/DatePickerPortal.tsx` (39 lines). Confirm:
- `DatePicker` imports `DPPortal` from `./DatePickerPortal`
- `DPPortal` has a mobile branch (z-1000 bottom sheet with backdrop) that is DIFFERENT from `MobileSheet` (z-9000, uses `useBodyScrollLock`, proper ESC handling)
- `useIsMobile` is already imported in `DatePicker.tsx`
- `MobileSheet` is NOT yet imported in `DatePicker.tsx`

- [ ] **Step 2: Update `DatePickerPortal.tsx` to be desktop-only**

The mobile branch of `DPPortal` becomes dead code once `DatePicker` handles mobile via `MobileSheet`. Make `DPPortal` return null when `isMobile` is true (keeps the interface stable for the few ms before `DatePicker`'s portal render is skipped):

```tsx
import { forwardRef, type ReactNode } from 'react'

/** Calendar surface wrapper: desktop-only anchored popover. Mobile branch is handled by DatePicker via MobileSheet. */
export const DPPortal = forwardRef<HTMLDivElement, {
  isMobile: boolean
  pos: { top: number; left: number; width: number } | null
  onBackdrop: () => void
  children: ReactNode
}>(function DPPortal({ isMobile, pos, onBackdrop: _onBackdrop, children }, ref) {
  // Mobile: DatePicker renders MobileSheet directly — this portal is desktop-only.
  if (isMobile || !pos) return null
  return (
    <div
      ref={ref}
      data-dp-portal="true"
      data-ams-dropdown="true"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
      className="bg-surface ring-1 ring-border rounded-xl shadow-xl shadow-slate-900/40 anim-fade-slide-in overflow-hidden"
    >
      {children}
    </div>
  )
})
```

- [ ] **Step 3: Update `DatePicker.tsx` to use MobileSheet on mobile**

Add `MobileSheet` import. Extract the calendar JSX into a `calendarContent` const (same technique as `DatePopover`). Render `<MobileSheet>` when `isMobile`, `DPPortal` when desktop.

Full replacement for `DatePicker.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from '@/components/ui/icon'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useExclusiveDropdown } from '@/components/ui/dropdownBus'
import { DPPortal } from '@/components/ui/DatePickerPortal'
import { MobileSheet } from '@/components/ui/MobileSheet'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'

const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const parseISO = (s?: string): Date | null => {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
const formatISO = (d: Date | null): string => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const formatDisplay = (d: Date | null): string => {
  if (!d) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${m}.${d.getFullYear()}`
}
const sameDay = (a: Date | null, b: Date | null): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

export interface DatePickerProps {
  value?: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  /** Show a "На 1 год" footer shortcut (warranty field). */
  showPlusYear?: boolean
  /** Accessible label / data-testid passthrough for the trigger. */
  id?: string
  /** Trigger visual style: 'field' (default underline) or 'chip' (compact border box). */
  variant?: 'field' | 'chip'
  /** aria-label for the trigger button. */
  ariaLabel?: string
}

/** Themed calendar (dark/orange) matching the AMS brand. Ported from the prototype. */
export function DatePicker({ value, onChange, min, max, disabled = false, placeholder = 'дд.мм.гггг', showPlusYear = false, id, variant = 'field', ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  useExclusiveDropdown(open, setOpen)
  const isMobile = useIsMobile()
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(parseISO(value) || new Date()))
  const [calMode, setCalMode] = useState<'days' | 'months' | 'years'>('days')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  useDismissOnOutside([rootRef, portalRef], () => setOpen(false), open && !isMobile)

  const selected = parseISO(value)
  const minDate = parseISO(min)
  const maxDate = parseISO(max)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const updatePos = () => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const popWidth = 288, popHeight = 340
    let left = r.left
    if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8
    if (left < 8) left = 8
    let top = r.bottom + 6
    if (top + popHeight > window.innerHeight - 8 && r.top - popHeight - 6 > 8) top = r.top - popHeight - 6
    setPos({ top, left, width: popWidth })
  }

  useEffect(() => {
    if (!open) { setPos(null); return }
    setViewMonth(startOfMonth(parseISO(value) || new Date()))
    setCalMode('days')
    // Mobile renders as MobileSheet — no anchor positioning needed.
    if (isMobile) return
    updatePos()
    const onChangeWin = () => updatePos()
    window.addEventListener('resize', onChangeWin)
    window.addEventListener('scroll', onChangeWin, true)
    return () => {
      window.removeEventListener('resize', onChangeWin)
      window.removeEventListener('scroll', onChangeWin, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile])

  useEffect(() => {
    if (!open || isMobile) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  const monthStart = startOfMonth(viewMonth)
  const firstDow = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const daysInPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate()
  const cells: { day: number; monthOffset: number; date: Date }[] = []
  for (let i = 0; i < 42; i++) {
    let day: number, monthOffset: number
    if (i < firstDow) { day = daysInPrev - firstDow + 1 + i; monthOffset = -1 }
    else if (i < firstDow + daysInMonth) { day = i - firstDow + 1; monthOffset = 0 }
    else { day = i - firstDow - daysInMonth + 1; monthOffset = 1 }
    cells.push({ day, monthOffset, date: new Date(viewMonth.getFullYear(), viewMonth.getMonth() + monthOffset, day) })
  }

  const isDisabledDate = (d: Date) => (minDate && d < minDate) || (maxDate && d > maxDate)
  const pick = (d: Date) => { if (isDisabledDate(d)) return; onChange(formatISO(d)); setOpen(false) }
  const handleToday = () => { if (isDisabledDate(today)) return; onChange(formatISO(today)); setOpen(false) }
  const handleOneYear = () => {
    const d = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    if (isDisabledDate(d)) return
    onChange(formatISO(d)); setOpen(false)
  }
  const handleClear = () => { onChange(''); setOpen(false) }

  const yearAnchor = viewMonth.getFullYear()
  const yearStart = yearAnchor - 6
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i)

  // ── Touch target sizes (bigger on mobile, compact on desktop) ────────────────
  const navBtnSize = isMobile ? 'w-10 h-10' : 'w-7 h-7'
  const dayCellSize = isMobile ? 'h-10 w-10' : 'h-8'

  // ── Shared calendar inner JSX — same content for MobileSheet and DPPortal ────
  const calendarContent = (
    <>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => setCalMode(m => m === 'days' ? 'months' : m === 'months' ? 'years' : 'days')}
          className="px-2 py-1 text-[15px] font-semibold text-text-primary hover:bg-surface-2 rounded-md transition-colors flex items-center gap-1"
        >
          {calMode === 'days' && <>{RU_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</>}
          {calMode === 'months' && <>{viewMonth.getFullYear()}</>}
          {calMode === 'years' && <>{yearStart}—{yearStart + 11}</>}
          <Icon name="chevron-down" size={12} className="text-text-subtle" />
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              if (calMode === 'days') setViewMonth(addMonths(viewMonth, -1))
              if (calMode === 'months') setViewMonth(new Date(viewMonth.getFullYear() - 1, viewMonth.getMonth(), 1))
              if (calMode === 'years') setViewMonth(new Date(viewMonth.getFullYear() - 12, viewMonth.getMonth(), 1))
            }}
            className={`${navBtnSize} flex items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors`}
            aria-label="Назад"
          ><Icon name="chevron-left" size={14} /></button>
          <button
            type="button"
            onClick={() => {
              if (calMode === 'days') setViewMonth(addMonths(viewMonth, 1))
              if (calMode === 'months') setViewMonth(new Date(viewMonth.getFullYear() + 1, viewMonth.getMonth(), 1))
              if (calMode === 'years') setViewMonth(new Date(viewMonth.getFullYear() + 12, viewMonth.getMonth(), 1))
            }}
            className={`${navBtnSize} flex items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors`}
            aria-label="Вперёд"
          ><Icon name="chevron-right" size={14} /></button>
        </div>
      </div>

      <div className="px-3 pb-2">
        {calMode === 'days' && (
          <>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {RU_WEEKDAYS.map((wd, i) => (
                <div key={wd} className={`text-center text-[12px] font-semibold uppercase tracking-wide py-1 ${i >= 5 ? 'text-accent/70' : 'text-text-subtle'}`}>{wd}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((c, i) => {
                const isOut = c.monthOffset !== 0
                const isSel = sameDay(c.date, selected)
                const isTd = sameDay(c.date, today)
                const dis = isDisabledDate(c.date)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(c.date)}
                    disabled={!!dis}
                    className={`${dayCellSize} text-[14px] rounded-md transition-colors font-medium
                      ${isSel ? 'bg-accent text-white shadow-sm'
                        : dis ? 'text-border-strong cursor-not-allowed'
                        : isOut ? 'text-[#475569] hover:bg-surface-2 hover:text-text-tertiary'
                        : isTd ? 'text-accent ring-1 ring-[#F97316]/40 hover:bg-[rgba(249,115,22,0.08)]'
                        : 'text-text-primary hover:bg-surface-2'}`}
                  >{c.day}</button>
                )
              })}
            </div>
          </>
        )}
        {calMode === 'months' && (
          <div className="grid grid-cols-3 gap-1 py-1">
            {RU_MONTHS.map((m, i) => (
              <button key={m} type="button"
                onClick={() => { setViewMonth(new Date(viewMonth.getFullYear(), i, 1)); setCalMode('days') }}
                className={`h-10 text-[14px] rounded-md transition-colors font-medium ${i === viewMonth.getMonth() ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface-2'}`}
              >{m.slice(0, 3)}</button>
            ))}
          </div>
        )}
        {calMode === 'years' && (
          <div className="grid grid-cols-3 gap-1 py-1">
            {years.map(y => (
              <button key={y} type="button"
                onClick={() => { setViewMonth(new Date(y, viewMonth.getMonth(), 1)); setCalMode('months') }}
                className={`h-10 text-[14px] rounded-md transition-colors font-medium ${y === viewMonth.getFullYear() ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface-2'}`}
              >{y}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-[#111315]/40">
        <button type="button" onClick={handleClear} className="text-[13px] font-semibold text-text-subtle hover:text-text-primary transition-colors px-2 py-1 rounded">Очистить</button>
        {showPlusYear && (
          <button type="button" onClick={handleOneYear} className="text-[13px] font-semibold text-accent hover:bg-[rgba(249,115,22,0.12)] transition-colors px-2 py-1 rounded">На 1 год</button>
        )}
        <button type="button" onClick={handleToday} className="text-[13px] font-semibold text-accent hover:bg-[rgba(249,115,22,0.12)] transition-colors px-2 py-1 rounded">Сегодня</button>
      </div>
    </>
  )

  return (
    <div ref={rootRef} data-ams-dropdown="true" className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={variant === 'chip'
          ? `w-full h-8 px-2 text-[12px] bg-bg border border-border rounded-lg flex items-center gap-1.5 text-left transition-all duration-150 ${open ? 'border-accent' : 'border-border hover:border-border-strong'} disabled:opacity-50 disabled:cursor-not-allowed`
          : `w-full px-0 py-2.5 text-[15px] border-b bg-transparent rounded-none flex items-center gap-2 outline-none shadow-none transition-[border-color,box-shadow] duration-200 text-left ${open ? 'border-accent shadow-[0_2px_8px_rgba(217,119,87,0.1)]' : 'border-border hover:border-border-strong'} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-subtle'}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <Icon name="calendar" size={variant === 'chip' ? 13 : 14} className={`ml-auto shrink-0 transition-colors ${open ? 'text-accent' : 'text-text-subtle'}`} />
      </button>

      {/* Desktop: anchored popover via DPPortal */}
      {!isMobile && open && ReactDOM.createPortal(
        <DPPortal ref={portalRef} isMobile={false} pos={pos} onBackdrop={() => setOpen(false)}>
          {calendarContent}
        </DPPortal>,
        document.body,
      )}

      {/* Mobile: own MobileSheet above parent modals (z-9000) */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title={ariaLabel ?? placeholder}>
          <div className="px-3 pb-2">
            {calendarContent}
          </div>
        </MobileSheet>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: no errors in `DatePicker.tsx` or `DatePickerPortal.tsx`

- [ ] **Step 5: Run tests to confirm desktop tests still pass**

Run: `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/ui`
Expected: all tests pass (jsdom defaults to desktop matchMedia=false, so desktop branch tests run)

---

## Task 2: Fix `features/employees/DestPicker.tsx` — add MobileSheet branch

**Context:** `DestPicker` opens a fixed-position portal at z-60 (desktop) or `left:8 right:8 bottom:8` (mobile). On mobile, this is under any parent MobileSheet (z-9000). The fix: on mobile, render `<MobileSheet>` instead of the portal. The top-level picker AND sub-pickers (employee/dept/branch search, temporary) must all render inside the same sub-sheet. When the user picks a value the sub-sheet closes, returning to the parent form.

The inner `<DatePicker>` for the temporary return-date sub-panel already gets fixed by Task 1 (it will open its OWN MobileSheet above the DestPicker sub-sheet — correct stacking: parent form at z-9000, DestPicker sub-sheet at z-9000, DatePicker sub-sub-sheet also at z-9000; they stack by paint order, which is correct since MobileSheet portals to body and latest one is topmost).

**Files:**
- Modify: `src/components/features/employees/DestPicker.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `DestPicker.tsx`:
```tsx
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileSheet } from '@/components/ui/MobileSheet'
```

Remove the `rafThrottle` import if it becomes unused after removing the scroll/resize listeners for mobile (keep for desktop).

- [ ] **Step 2: Add `isMobile` hook and restructure render**

In `DestPicker`, add `const isMobile = useIsMobile()` after existing hooks.

Extract the popover content into a `pickerContent` const (already inlined — just move the JSX from inside the portal div into a variable). Then:
- Desktop: render `ReactDOM.createPortal(<div ref={popoverRef} ...>{pickerContent}</div>, document.body)` exactly as before.
- Mobile: render `<MobileSheet open={open} onClose={() => setOpen(false)} title={t('dest.warehouse')}>` wrapping the picker content. Note: the sheet title doesn't need to be a "dest label" — it can be the current sub-label or the emp-name context. Use `t('handover.title')` from the employees namespace if DestPicker has access to it, OR just use a generic label. Given DestPicker uses `useTranslation('employees')` and has `t('dest.warehouse')` etc, use `title={t('dest.temporary')}` for the temp sub-panel or keep the title as the field context from the call site. The simplest approach: pass an optional `mobileTitle` prop to DestPicker, default to the chipLabel (which already reflects the current value). This way HandoverModal can pass the column/field name.

Actually, looking at the two call sites:
- `EmployeeDetailDrawer` transfer bar: no separate title needed — `chipLabel` value works
- `HandoverModal` step-2 route row: per-row so `chipLabel` (current value) works

So: use `title={chipLabel}` as the MobileSheet title. `chipLabel` is already computed at the top of the component as the human-readable current destination value.

- [ ] **Step 3: Write the full DestPicker replacement**

Key logic changes:
1. Add `isMobile = useIsMobile()`
2. Remove mobile positioning shortcut (`if (isMobile) { setPos({ left:8... }) }`) from `updatePos`
3. Guard `useLayoutEffect` and scroll/resize listeners with `!isMobile`
4. Remove `forceDropUp` from mobile branch (not needed)
5. Add mobile render path

Full replacement for `src/components/features/employees/DestPicker.tsx`:

```tsx
/**
 * DestPicker — portal chip + popover for picking an asset destination.
 *
 * Desktop: portal popover at z-60, anchored to trigger.
 * Mobile (owner rule 2026-07-28): opens its own MobileSheet (z-9000)
 * above parent modals — the cramped fixed popover was unusable at 375px.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { DatePicker } from '@/components/ui'
import { MobileSheet } from '@/components/ui/MobileSheet'
import { useIsMobile } from '@/hooks/useIsMobile'
import { rafThrottle } from '@/lib/rafThrottle'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Destination =
  | { kind: 'warehouse' }
  | { kind: 'employee'; id: string; label: string }
  | { kind: 'department'; id: string; label: string }
  | { kind: 'branch'; id: string; label: string }
  | { kind: 'temporary'; tempKind: 'audit' | 'intern'; expiresAt: string; label: string }

export interface DestPickerProps {
  value: Destination
  onChange: (d: Destination) => void
  currentEmpId: string
  employees: { id: string; name: string; status: string }[]
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  forceDropUp?: boolean
}

// ── Internal types ────────────────────────────────────────────────────────────

type SubKind = 'employee' | 'department' | 'branch' | 'temporary'

interface PopoverPos {
  top?: number
  bottom?: number
  left?: number
  right?: number
  width: number | string
}

// ── Accent config — matches prototype exactly ─────────────────────────────────

const KIND_ACCENT = {
  warehouse: {
    icon: 'warehouse',
    iconCls: 'bg-surface-2 text-text-tertiary',
    chipCls: 'bg-bg ring-border text-text-tertiary hover:bg-surface-2',
  },
  employee: {
    icon: 'user-round',
    iconCls: 'bg-accent/10 text-accent',
    chipCls: 'bg-accent/10 ring-accent text-accent hover:bg-accent/15',
  },
  department: {
    icon: 'layout-list',
    iconCls: 'bg-amber-500/15 text-amber-300',
    chipCls: 'bg-amber-500/10 ring-amber-500/30 text-amber-300 hover:bg-amber-500/15',
  },
  branch: {
    icon: 'git-branch',
    iconCls: 'bg-teal-50 text-teal-700',
    chipCls: 'bg-teal-50 ring-teal-200 text-teal-700 hover:bg-teal-100',
  },
  temporary: {
    icon: 'timer',
    iconCls: 'bg-rose-500/15 text-rose-300',
    chipCls: 'bg-rose-500/10 ring-rose-500/30 text-rose-300 hover:bg-rose-500/15',
  },
} as const

// ── Date helpers (module scope — stable across renders) ───────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const plusDaysISO = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return toISO(d) }

const samePopoverPos = (a: PopoverPos | null, b: PopoverPos): boolean =>
  a !== null &&
  a.top === b.top &&
  a.bottom === b.bottom &&
  a.left === b.left &&
  a.right === b.right &&
  a.width === b.width

// ── Component ─────────────────────────────────────────────────────────────────

export function DestPicker({
  value,
  onChange,
  currentEmpId,
  employees,
  departments,
  branches,
  forceDropUp = false,
}: DestPickerProps) {
  const { t } = useTranslation('employees')
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState<SubKind | null>(null)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<PopoverPos | null>(null)

  const [tempKind, setTempKind] = useState<'audit' | 'intern' | null>(null)
  const [returnDate, setReturnDate] = useState(() => plusDaysISO(7))

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 180
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = forceDropUp || spaceBelow < popoverHeight + 8
    const next: PopoverPos = openUp
      ? {
          bottom: window.innerHeight - rect.top + 4,
          right: window.innerWidth - rect.right,
          width: 240,
        }
      : {
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
          width: 240,
        }
    setPos((prev) => (samePopoverPos(prev, next) ? prev : next))
  }, [forceDropUp])

  useLayoutEffect(() => {
    if (!open) {
      setSub(null)
      setQuery('')
      setPos(null)
      setTempKind(null)
      setReturnDate(plusDaysISO(7))
      return
    }
    // Mobile uses MobileSheet — no positioning needed
    if (isMobile) return
    updatePos()
  }, [open, isMobile, updatePos])

  // Outside-press close — desktop only; MobileSheet handles its own backdrop on mobile
  useDismissOnOutside([wrapRef, popoverRef], () => setOpen(false), open && !isMobile)

  useEffect(() => {
    if (!open || isMobile) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScrollResize = rafThrottle(updatePos)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      onScrollResize.cancel()
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, isMobile, updatePos])

  const commit = (next: Destination) => {
    onChange(next)
    setOpen(false)
  }

  const activeEmps = employees.filter(
    (e) => e.status === 'active' && e.id !== currentEmpId,
  )

  const filteredList = <T extends { name: string }>(list: T[]): T[] => {
    const q = query.trim().toLowerCase()
    return q ? list.filter((x) => x.name.toLowerCase().includes(q)) : list
  }

  const accent = KIND_ACCENT[value.kind] ?? KIND_ACCENT.warehouse
  const chipLabel =
    value.kind === 'warehouse' ? t('dest.warehouse') : (value as { label: string }).label

  const TOP_OPTS = [
    {
      kind: 'warehouse' as const,
      label: t('dest.warehouse'),
      sub: null,
      iconCls: KIND_ACCENT.warehouse.iconCls,
      icon: KIND_ACCENT.warehouse.icon,
    },
    {
      kind: 'employee' as const,
      label: t('dest.employee'),
      sub: 'employee' as SubKind,
      iconCls: KIND_ACCENT.employee.iconCls,
      icon: KIND_ACCENT.employee.icon,
    },
    {
      kind: 'department' as const,
      label: t('dest.department'),
      sub: 'department' as SubKind,
      iconCls: KIND_ACCENT.department.iconCls,
      icon: KIND_ACCENT.department.icon,
    },
    {
      kind: 'branch' as const,
      label: t('dest.branch'),
      sub: 'branch' as SubKind,
      iconCls: KIND_ACCENT.branch.iconCls,
      icon: KIND_ACCENT.branch.icon,
    },
    {
      kind: 'temporary' as const,
      label: t('dest.temporary'),
      sub: 'temporary' as SubKind,
      iconCls: KIND_ACCENT.temporary.iconCls,
      icon: KIND_ACCENT.temporary.icon,
    },
  ]

  const SUB_ICON = {
    employee: KIND_ACCENT.employee,
    department: KIND_ACCENT.department,
    branch: KIND_ACCENT.branch,
  }

  const emptyState = (
    <div className="flex flex-col items-center py-3 gap-1">
      <Icon name="search-x" size={16} className="text-text-subtle" />
      <span className="text-[13.5px] text-text-tertiary">{t('dest.notFound')}</span>
    </div>
  )

  // ── Shared picker content JSX (rendered in both desktop portal and mobile sheet) ──

  const pickerContent = (
    <>
      {!sub ? (
        <div className="space-y-0.5 py-1">
          {TOP_OPTS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              onClick={() => {
                if (opt.sub) {
                  setSub(opt.sub)
                  setQuery('')
                } else {
                  commit({ kind: 'warehouse' })
                }
              }}
              className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-[14.5px] font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2.5"
            >
              <span
                className={`inline-flex items-center justify-center w-[20px] h-[20px] rounded-[5px] shrink-0 ${opt.iconCls}`}
              >
                <Icon name={opt.icon} size={11} />
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          {/* Employee / department / branch search sub-panels */}
          {sub !== 'temporary' && (
            <>
              <div className="flex items-center gap-1 px-1 mb-1.5">
                <button
                  type="button"
                  aria-label={t('dest.back')}
                  onClick={() => {
                    setSub(null)
                    setQuery('')
                  }}
                  className="p-1 rounded-md text-text-subtle hover:text-text-secondary hover:bg-surface-2 transition-colors"
                >
                  <Icon name="arrow-left" size={12} />
                </button>
                <div className="ams-destpicker-search flex-1 flex items-center gap-1.5 bg-bg rounded-lg px-2 py-1">
                  <Icon name="search" size={11} className="text-text-subtle shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('dest.search')}
                    aria-label={t('dest.search')}
                    autoFocus={!isMobile}
                    className="ams-destpicker-search-input flex-1 text-[14px] bg-transparent border-none outline-none placeholder:text-text-subtle text-text-primary min-w-0"
                  />
                </div>
              </div>
              <div className="max-h-[45vh] overflow-y-auto space-y-0.5">
                {sub === 'employee' &&
                  filteredList(activeEmps).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => commit({ kind: 'employee', id: e.id, label: e.name })}
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-[14px] font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.employee.iconCls}`}
                      >
                        <Icon name={SUB_ICON.employee.icon} size={11} />
                      </span>
                      <span className="truncate">{e.name}</span>
                    </button>
                  ))}
                {sub === 'department' &&
                  filteredList(departments).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        commit({ kind: 'department', id: d.id, label: d.name })
                      }
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-[14px] font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.department.iconCls}`}
                      >
                        <Icon name={SUB_ICON.department.icon} size={11} />
                      </span>
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                {sub === 'branch' &&
                  filteredList(branches).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => commit({ kind: 'branch', id: b.id, label: b.name })}
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-[14px] font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.branch.iconCls}`}
                      >
                        <Icon name={SUB_ICON.branch.icon} size={11} />
                      </span>
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                {sub === 'employee' && filteredList(activeEmps).length === 0 && emptyState}
                {sub === 'department' && filteredList(departments).length === 0 && emptyState}
                {sub === 'branch' && filteredList(branches).length === 0 && emptyState}
              </div>
            </>
          )}

          {/* Temporary sub-panel */}
          {sub === 'temporary' && (
            <div className="px-1.5 pb-1">
              <div className="flex items-center gap-1 px-0.5 mb-2">
                <button
                  type="button"
                  aria-label={t('dest.back')}
                  onClick={() => { setSub(null); setTempKind(null); setReturnDate(plusDaysISO(7)) }}
                  className="p-1 rounded-md text-text-subtle hover:text-text-secondary hover:bg-surface-2 transition-colors"
                >
                  <Icon name="arrow-left" size={12} />
                </button>
                <span className="text-[12px] uppercase tracking-[0.06em] font-semibold text-text-tertiary">
                  {t('dest.temporary')}
                </span>
              </div>
              <div className="flex items-center gap-1 h-9 bg-bg border border-border rounded-lg overflow-hidden mb-2">
                {(['audit', 'intern'] as const).map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTempKind(k)}
                    aria-pressed={tempKind === k}
                    className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''}
                      ${tempKind === k ? 'bg-rose-500/80 text-white' : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'}`}
                  >
                    {k === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')}
                  </button>
                ))}
              </div>
              <label htmlFor="dest-return-date" className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
                {t('dest.returnDate')}
              </label>
              <DatePicker
                id="dest-return-date"
                value={returnDate}
                onChange={(v) => setReturnDate(v)}
                placeholder={t('dest.returnDatePlaceholder')}
                ariaLabel={t('dest.returnDate')}
              />
              <button
                type="button"
                disabled={!tempKind || !returnDate}
                onClick={() => {
                  if (!tempKind) return
                  const dd = returnDate.split('-')
                  const short = `${dd[2]}.${dd[1]}`
                  const kindLabel = tempKind === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')
                  commit({
                    kind: 'temporary',
                    tempKind,
                    expiresAt: returnDate,
                    label: t('dest.tempLabel', { kind: kindLabel, date: short }),
                  })
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[14px] bg-rose-500/80 text-white hover:bg-rose-500 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="check" size={13} />
                {t('dest.tempConfirm')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div ref={wrapRef}>
      {/* Chip trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={chipLabel}
        onClick={() => setOpen((v) => !v)}
        className={`ams-handover-destpicker-trigger inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[14px] font-medium ring-1 transition-colors duration-150 cursor-pointer ${accent.chipCls}`}
      >
        <span
          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${accent.iconCls}`}
        >
          <Icon name={accent.icon} size={11} />
        </span>
        <span className="truncate max-w-[110px]">{chipLabel}</span>
        <Icon name="chevron-down" size={10} className="shrink-0 opacity-50" />
      </button>

      {/* Desktop: portal popover */}
      {!isMobile && open && pos &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              zIndex: 60,
              width: pos.width,
              ...(pos.top !== undefined ? { top: pos.top } : {}),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
              ...(pos.left !== undefined ? { left: pos.left } : {}),
              ...(pos.right !== undefined ? { right: pos.right } : {}),
            }}
            className="bg-surface shadow-2xl shadow-slate-900/15 rounded-2xl ring-1 ring-border p-1.5 anim-fade-slide-in"
          >
            {pickerContent}
          </div>,
          document.body,
        )}

      {/* Mobile: own MobileSheet above parent modals */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title={chipLabel}>
          <div className="px-2 pb-2">
            {pickerContent}
          </div>
        </MobileSheet>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: no errors in `DestPicker.tsx`.

Important notes for TypeScript:
- `exactOptionalPropertyTypes` is active. The conditional-spread idiom is already used in the existing `pos` spread: `...(pos.top !== undefined ? { top: pos.top } : {})` — keep exactly this pattern.
- `rafThrottle` import: it is still used for the desktop scroll/resize listener. Keep it.

- [ ] **Step 5: Run DestPicker and HandoverModal tests**

Run: `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4 src/components/features/employees`
Expected: all pass. jsdom matchMedia returns false → `isMobile = false` → desktop branch runs → portal path same as before → tests unaffected.

---

## Task 3: Full build and test verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: exits 0. Last 10 lines should show vite build success, no TypeScript errors.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`
Expected: all tests pass.

- [ ] **Step 3: Check for any TypeScript strict issues**

The `_onBackdrop` rename in `DPPortal` (Task 1, Step 2) uses underscore prefix to suppress the "unused parameter" lint. In TypeScript with `noUnusedParameters` this would error — check if the tsconfig enables it. If it does, either keep the parameter named `onBackdrop` and just not call it in the desktop-only render, or use `onBackdrop: _` destructure. Safest: keep the parameter named `onBackdrop` (no rename) since the DPPortal interface is public and callers still pass it.

---

## Self-Review

### Spec coverage check

| Requirement | Covered by |
|---|---|
| Every picker inside a modal/sheet must open MobileSheet on mobile | Task 1 (DatePicker), Task 2 (DestPicker) |
| Desktop anchored popovers stay exactly as-is | Task 1 keeps DPPortal for desktop; Task 2 keeps portal for desktop |
| Sub-sheet title = field label the user tapped | DatePicker: uses `ariaLabel ?? placeholder`; DestPicker: uses `chipLabel` |
| Single-select pickers close on pick | DatePicker: `pick()` calls `setOpen(false)` ✓; DestPicker: `commit()` calls `setOpen(false)` ✓ |
| Done button / backdrop / Escape closes sub-sheet | MobileSheet handles backdrop and Escape internally ✓ |
| No autofocus on search input on mobile (keyboard jump) | DestPicker: `autoFocus={!isMobile}` on search input ✓ |
| No raw document mousedown/touchstart listeners | useDismissOnOutside used with `enabled` guard; MobileSheet handles its own backdrop ✓ |
| touch targets comfortable | DatePicker: day cells h-10 w-10 on mobile; nav buttons w-10 h-10 ✓; DestPicker: rows py-3 md:py-2 ✓ |
| No change to desktop behavior | Desktop paths untouched ✓ |
| No change to loading/skeletons | Not touched ✓ |
| exactOptionalPropertyTypes: conditional-spread idiom | DatePicker: no optional spreading; DestPicker: same `...(pos.top !== undefined ? ...)` pattern kept ✓ |
| Existing tests green | jsdom matchMedia→false → desktop branches → same as before ✓ |
| MiniDropdown (RamSlots, StorageSlots in SpecsPanel) — out of scope | AssetCreatePage is page-level (not modal) → correct out-of-scope ✓ |
| SpecCombobox (LicensePicker, SpecsPanel) — out of scope | Same reason ✓ |
| ActivateKeyModal — no picker components inside | Verified — only search input + radio list ✓ |
| InstallModal — Select component inside it | InstallModal already uses `MobileSheet` on mobile for the whole modal (checked: line 432) ✓ |

### Placeholder scan

No "TBD", "TODO", or missing code in this plan. All code shown in full.

### Type consistency

- `DatePickerProps.ariaLabel?: string` — used as `ariaLabel ?? placeholder` (both string) ✓
- `DestPickerProps` interface unchanged — all existing callers (HandoverModal, EmployeeDetailDrawer) need no changes ✓
- `DPPortal` props: `onBackdrop` renamed in implementation to allow unused; keep the prop name as-is to avoid breaking callers ✓
- `isMobile: boolean` passed to DPPortal desktop call as `isMobile={false}` (literal) to satisfy the prop type ✓

---

## Execution notes

**Do NOT:**
- Change HandoverModal — DestPicker fix handles the picker inside it transitively
- Change TransferPanel — DatePicker fix handles the date picker inside it transitively
- Touch MiniDropdown or SpecCombobox — they are page-level only (confirmed: AssetCreateForm is a full page, not a modal)
- Run `git add` / `git commit` / `git push`
- Edit files via PowerShell Set-Content (UTF-8 corruption risk on Windows) — use Read/Write/Edit tools only

**Locale files:** No new i18n keys needed. All strings are existing ones (`dest.*`, `Очистить`, `Сегодня`, `На 1 год`). The MobileSheet `title` prop receives values already resolved from existing keys via `t()`.
