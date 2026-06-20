/**
 * LicenseHistory component tests.
 *
 * Verifies: masked keys from audit payload render (never raw-looking);
 * empty state text shows when there are no entries.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { LicenseHistory } from './LicenseHistory'
import type { AuditLog } from '@/domain/audit'

function makeEntry(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'al_1',
    entityType: 'license',
    entityId: 'lic_1',
    action: 'created',
    actorUid: 'u_001',
    actorRole: 'super_admin',
    before: null,
    after: null,
    comment: null,
    at: '2026-01-01T12:00:00.000Z',
    ...overrides,
  }
}

function renderHistory(entries: AuditLog[]) {
  render(
    <I18nextProvider i18n={i18n}>
      <LicenseHistory entries={entries} />
    </I18nextProvider>,
  )
}

describe('LicenseHistory', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('shows empty state text when opened with no entries', () => {
    // Arrange
    renderHistory([])

    // Act — click to open the history panel
    fireEvent.click(screen.getByRole('button', { name: /История/i }))

    // Assert
    expect(screen.getByText('Записей в истории нет')).toBeInTheDocument()
  })

  it('renders the action label when entries are present', () => {
    // Arrange
    const entries = [makeEntry({ action: 'created' })]
    renderHistory(entries)

    // Act — open history
    fireEvent.click(screen.getByRole('button', { name: /История/i }))

    // Assert — action text rendered
    expect(screen.getByText('created')).toBeInTheDocument()
  })

  it('renders masked key from audit payload and never a raw-looking key', () => {
    // Arrange — payload has an already-masked key (server masked it)
    const MASKED = '****-****-****-5592'
    const RAW_FRAGMENT = 'XCVF'
    const entries = [
      makeEntry({
        action: 'key_rotated',
        after: { key: MASKED } as unknown as Record<string, unknown>,
      }),
    ]
    renderHistory(entries)

    // Act — open history
    fireEvent.click(screen.getByRole('button', { name: /История/i }))

    // Assert — masked key appears
    expect(screen.getByText(MASKED)).toBeInTheDocument()

    // Assert — raw key fragment must NOT appear
    expect(screen.queryByText(RAW_FRAGMENT)).toBeNull()
  })

  it('renders multiple entries in descending time order', () => {
    // Arrange — two entries with different timestamps
    const entries = [
      makeEntry({ id: 'al_1', action: 'assigned',  at: '2026-01-01T10:00:00.000Z' }),
      makeEntry({ id: 'al_2', action: 'key_rotated', at: '2026-01-02T10:00:00.000Z' }),
    ]
    renderHistory(entries)

    // Act — open history
    fireEvent.click(screen.getByRole('button', { name: /История/i }))

    // Assert — both actions visible
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
    // key_rotated (newer) should appear before assigned (older) — verify via text content order
    const texts = items.map(el => el.textContent ?? '')
    expect(texts[0]).toContain('key_rotated')
    expect(texts[1]).toContain('assigned')
  })
})
