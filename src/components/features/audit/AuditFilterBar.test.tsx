import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuditFilterBar } from './AuditFilterBar'
import type { AuditLogQuery } from '@/domain/audit'
import type { AuditLogReferenceData } from '@/domain/audit/AuditLogRepository'

// 'audit' namespace is not yet seeded (Task 9), so t() returns raw keys.
// Assertions are made against query payload shapes, not translated label text.

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

describe('AuditFilterBar', () => {
  // ── (a) entityType select fires onChange with { entityType } ─────────────────────────────
  it('(a) changing the entityType select fires onChange with { entityType }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // The entityType select contains options built from ENTITY_TYPES.
    // 'all' is the first option. Find the native <select> that currently shows 'all'.
    // There are three Select components (entityType, action, actorUid). We locate by
    // querying all native selects and picking the one whose value is 'all' for entityType.
    // Because all three start at 'all', we identify by option list length:
    // entityType has 11 options (1 'all' + 10 entity types).
    const allSelects = screen.getAllByRole('combobox')
    const entityTypeSelect = allSelects.find(
      (el) => (el as HTMLSelectElement).options.length === 11,
    ) as HTMLSelectElement

    // Act
    fireEvent.change(entityTypeSelect, { target: { value: 'asset' } })

    // Assert
    expect(onChange).toHaveBeenCalledWith({ entityType: 'asset' })
  })

  // ── (b) search input fires onChange with { search } ──────────────────────────────────────
  it('(b) typing in the search input fires onChange with { search }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // The search input has type="search" and an aria-label matching the 'search' i18n key.
    // When the audit namespace is absent t('search') returns 'search'.
    const searchInput = screen.getByRole('searchbox')

    // Act
    fireEvent.change(searchInput, { target: { value: 'Dell' } })

    // Assert
    expect(onChange).toHaveBeenCalledWith({ search: 'Dell' })
  })

  // ── (c) Reset button visibility and reset behaviour ──────────────────────────────────────
  it('(c) Reset button is HIDDEN when query is at defaults', () => {
    // Arrange + Act
    renderBar(DEFAULT_QUERY)

    // Assert — no button in the DOM when all filters are at their defaults
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('(c) Reset button is SHOWN when a filter is set (entityType ≠ all)', () => {
    // Arrange + Act
    renderBar({ ...DEFAULT_QUERY, entityType: 'asset' })

    // Assert — at least one button appears (the Reset button)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('(c) clicking Reset fires onChange resetting all filters to defaults', () => {
    // Arrange
    const onChange = vi.fn()
    // Start with a dirty query so the Reset button is visible
    renderBar({ ...DEFAULT_QUERY, entityType: 'asset', search: 'Dell' }, onChange)

    const resetBtn = screen.getByRole('button')

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

  // ── (d) action select fires onChange with { action } ─────────────────────────────────────
  it('(d) changing the action select fires onChange with { action }', () => {
    // Arrange
    const onChange = vi.fn()
    renderBar(DEFAULT_QUERY, onChange)

    // action select has 15 options (1 'all' + 14 AUDIT_ACTIONS)
    const allSelects = screen.getAllByRole('combobox')
    const actionSelect = allSelects.find(
      (el) => (el as HTMLSelectElement).options.length === 15,
    ) as HTMLSelectElement

    // Act
    fireEvent.change(actionSelect, { target: { value: 'created' } })

    // Assert
    expect(onChange).toHaveBeenCalledWith({ action: 'created' })
  })
})
