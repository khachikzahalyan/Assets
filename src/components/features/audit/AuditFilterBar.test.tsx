import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuditFilterBar } from './AuditFilterBar'
import type { AuditLogQuery } from '@/domain/audit'
import type { AuditLogReferenceData } from '@/domain/audit/AuditLogRepository'

// Assertions are made against query payload shapes, not translated label text.
// The bar uses SelectMini chips (button trigger aria-label = column label,
// options have role="option") — same interaction pattern as EmployeesFilterBar.
// DatePicker chip triggers are buttons with aria-label matching filters.from/to.

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

/** Default query — all filters at their "unset" values. */
const DEFAULT_QUERY: AuditLogQuery = {
  entityType: 'all',
  action: 'all',
  actorUid: 'all',
  fromDate: null,
  toDate: null,
  search: '',
  pageSize: 25,
}

/** Reference data fixture — two actors for the actor select. */
const REF_DATA: AuditLogReferenceData = {
  actors: [
    { uid: 'uid-alice', displayName: 'Alice Admin' },
    { uid: 'uid-bob',   displayName: 'Bob Tech' },
  ],
}

function renderBar(
  query: AuditLogQuery = DEFAULT_QUERY,
  onChange = vi.fn(),
) {
  return {
    onChange,
    ...render(
      <I18nextProvider i18n={i18n}>
        <AuditFilterBar query={query} onChange={onChange} ref={REF_DATA} />
      </I18nextProvider>,
    ),
  }
}

/** Open a SelectMini by its trigger aria-label, then click an option by label. */
function pickOption(triggerLabel: string, optionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: triggerLabel }))
  fireEvent.click(screen.getByRole('option', { name: new RegExp(optionLabel) }))
}

/**
 * Compute today's YYYY-MM-DD using local date parts — mirrors DatePicker.formatISO.
 * Never use toISOString() here: it outputs UTC and is off-by-one in positive-offset zones.
 */
function localTodayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

describe('AuditFilterBar', () => {
  // ── (a) entityType SelectMini fires onChange with { entityType } ─────────────
  it('(a) picking an entity option fires onChange with { entityType }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // Act — open the entity chip (label = col.entity) and pick 'asset'
    pickOption(i18n.t('col.entity', { ns: 'audit' }), i18n.t('entity.asset', { ns: 'audit' }))

    // Assert
    expect(onChange).toHaveBeenCalledWith({ entityType: 'asset' })
  })

  // ── (b) search input fires onChange with { search } ──────────────────────────
  it('(b) typing in the search input fires onChange with { search }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // The search input has type="search".
    const searchInput = screen.getByRole('searchbox')

    // Act
    fireEvent.change(searchInput, { target: { value: 'Dell' } })

    // Assert
    expect(onChange).toHaveBeenCalledWith({ search: 'Dell' })
  })

  // ── (c) Reset button visibility and reset behaviour ──────────────────────────
  it('(c) Reset button is HIDDEN when query is at defaults', () => {
    // Arrange + Act
    renderBar(DEFAULT_QUERY)

    // Assert — no reset button when all filters are at their defaults
    // (SelectMini triggers are buttons too, so query specifically by name)
    const resetLabel = i18n.t('filters.reset', { ns: 'audit' })
    expect(screen.queryByRole('button', { name: resetLabel })).toBeNull()
  })

  it('(c) Reset button is SHOWN when a filter is set (entityType ≠ all)', () => {
    // Arrange + Act
    renderBar({ ...DEFAULT_QUERY, entityType: 'asset' })

    // Assert
    const resetLabel = i18n.t('filters.reset', { ns: 'audit' })
    expect(screen.getByRole('button', { name: resetLabel })).toBeInTheDocument()
  })

  it('(c) clicking Reset fires onChange resetting all filters to defaults', () => {
    // Arrange
    const onChange = vi.fn()
    // Start with a dirty query so the Reset button is visible
    renderBar({ ...DEFAULT_QUERY, entityType: 'asset', search: 'Dell' }, onChange)

    const resetLabel = i18n.t('filters.reset', { ns: 'audit' })
    const resetBtn = screen.getByRole('button', { name: resetLabel })

    // Act
    fireEvent.click(resetBtn)

    // Assert — onChange called with the full reset patch
    expect(onChange).toHaveBeenCalledWith({
      entityType: 'all',
      action: 'all',
      actorUid: 'all',
      fromDate: null,
      toDate: null,
      search: '',
    })
  })

  // ── (d) action SelectMini fires onChange with { action } ─────────────────────
  it('(d) picking an action option fires onChange with { action }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // Act — open the action chip (label = col.action) and pick 'created'
    pickOption(i18n.t('col.action', { ns: 'audit' }), i18n.t('action.created', { ns: 'audit' }))

    // Assert
    expect(onChange).toHaveBeenCalledWith({ action: 'created' })
  })

  // ── (e) actor SelectMini fires onChange with { actorUid } ────────────────────
  it('(e) picking an actor option fires onChange with { actorUid }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // Act — open the actor chip (label = col.actor) and pick Alice
    pickOption(i18n.t('col.actor', { ns: 'audit' }), 'Alice Admin')

    // Assert
    expect(onChange).toHaveBeenCalledWith({ actorUid: 'uid-alice' })
  })

  // ── (f) from-date picker fires onChange with LOCAL start-of-day UTC instant ──
  it('(f) clicking «Сегодня» in the from-picker fires onChange with the LOCAL day start as a UTC instant', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)
    const todayISO = localTodayISO()
    // The bound is local midnight converted to UTC — NOT `${day}T00:00:00.000Z`
    // (that UTC-day bug shifted the window by the timezone offset, e.g. +4h in Armenia).
    const expected = new Date(`${todayISO}T00:00:00`).toISOString()

    // Act — open the from-date chip picker (unique aria-label = filters.from = «С»)
    const fromLabel = i18n.t('filters.from', { ns: 'audit' })
    fireEvent.click(screen.getByRole('button', { name: fromLabel }))
    // Calendar portals to document.body — screen queries the full document
    fireEvent.click(screen.getByText('Сегодня'))

    // Assert
    expect(onChange).toHaveBeenCalledWith({ fromDate: expected })
  })

  // ── (g) to-date picker fires onChange with LOCAL end-of-day UTC instant ──────
  it('(g) clicking «Сегодня» in the to-picker fires onChange with the LOCAL day end as a UTC instant', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)
    const todayISO = localTodayISO()
    const expected = new Date(`${todayISO}T23:59:59.999`).toISOString()

    // Act — open the to-date chip picker (unique aria-label = filters.to = «По»)
    const toLabel = i18n.t('filters.to', { ns: 'audit' })
    fireEvent.click(screen.getByRole('button', { name: toLabel }))
    fireEvent.click(screen.getByText('Сегодня'))

    // Assert
    expect(onChange).toHaveBeenCalledWith({ toDate: expected })
  })

  // ── (g-2) stored bound round-trips to the same LOCAL day in the picker ───────
  it('(g-2) a stored local-midnight bound displays as the SAME local day (no slice(0,10) off-by-one)', () => {
    // Arrange — store today's local midnight as the query bound (what the picker emits)
    const todayISO = localTodayISO()
    const storedFrom = new Date(`${todayISO}T00:00:00`).toISOString()
    renderBar({ ...DEFAULT_QUERY, fromDate: storedFrom })

    // Act — open the from-picker; its trigger must show today's LOCAL day.
    // In UTC+ zones, storedFrom.slice(0,10) would be YESTERDAY — the display
    // must convert back via local date parts instead.
    const fromLabel = i18n.t('filters.from', { ns: 'audit' })
    const trigger = screen.getByRole('button', { name: fromLabel })

    // Assert — DatePicker chip renders the selected day as DD.MM.YYYY
    const [y, m, d] = todayISO.split('-')
    expect(trigger.textContent).toContain(`${d}.${m}.${y}`)
  })

  // ── (h) «Очистить» in the from-picker emits { fromDate: null } ───────────────
  it('(h) clicking «Очистить» in the from-picker fires onChange with { fromDate: null }', () => {
    // Arrange — render with a from-date already set so the picker has a value
    const onChange = vi.fn()
    renderBar({ ...DEFAULT_QUERY, fromDate: '2026-01-05T00:00:00.000Z' }, onChange)

    // Act — open the from-picker then click clear
    const fromLabel = i18n.t('filters.from', { ns: 'audit' })
    fireEvent.click(screen.getByRole('button', { name: fromLabel }))
    fireEvent.click(screen.getByText('Очистить'))

    // Assert — empty string from DatePicker maps to null in the filter handler
    expect(onChange).toHaveBeenCalledWith({ fromDate: null })
  })
})
