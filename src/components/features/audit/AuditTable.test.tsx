import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuditTable } from './AuditTable'
import type { AuditLog } from '@/domain/audit'
import type { AuditLogReferenceData } from '@/domain/audit/AuditLogRepository'

// All assertions target values (timestamps, names, entity ids) — not translated chrome.

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const REF_DATA: AuditLogReferenceData = {
  actors: [
    { uid: 'uid-alice', displayName: 'Alice Admin' },
    { uid: 'uid-bob',   displayName: 'Bob Tech' },
  ],
}

/** Minimal valid AuditLog builder. */
function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'log-1',
    entityType: 'asset',
    entityId: 'asset-abc-123',
    action: 'created',
    actorUid: 'uid-alice',
    actorRole: 'asset_admin',
    before: null,
    after: { invCode: 'LAP/001', brand: 'Dell' },
    comment: null,
    at: '2026-01-10T10:00:00.000Z',
    ...overrides,
  }
}

/** Render helper — wraps with I18nextProvider + MemoryRouter. */
function renderTable(
  rows: AuditLog[],
  ref: AuditLogReferenceData = REF_DATA,
  initialPath = '/',
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AuditTable rows={rows} ref={ref} />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditTable', () => {

  // ── (a) renders one data row per log ─────────────────────────────────────────
  describe('(a) data row rendering', () => {
    it('renders formatted timestamp for a log entry', () => {
      // Arrange
      const log = makeLog({ at: '2026-01-10T10:30:00.000Z' })

      // Act
      renderTable([log])

      // Assert — timestamp uses DD/Mon/YYYY HH:MM format
      // formatAuditTs localises to the machine's timezone; we verify format shape.
      // The month abbreviation is always a 3-letter English month from auditFormat.ts.
      const tsPattern = /\d{2}\/[A-Z][a-z]{2}\/\d{4} \d{2}:\d{2}/
      const tsEl = screen.getByText(tsPattern)
      expect(tsEl).toBeInTheDocument()
    })

    it('resolves actor display name from ref.actors', () => {
      // Arrange
      const log = makeLog({ actorUid: 'uid-alice' })

      // Act
      renderTable([log])

      // Assert — display name, not raw uid
      expect(screen.getByText('Alice Admin')).toBeInTheDocument()
    })

    it('falls back to uid when actor is not in ref.actors', () => {
      // Arrange
      const log = makeLog({ actorUid: 'uid-unknown' })

      // Act
      renderTable([log])

      // Assert — raw uid is shown
      expect(screen.getByText('uid-unknown')).toBeInTheDocument()
    })

    it('renders one data row per log entry (two logs → two rows of data)', () => {
      // Arrange
      const logs = [
        makeLog({ id: 'log-1', actorUid: 'uid-alice' }),
        makeLog({ id: 'log-2', actorUid: 'uid-bob' }),
      ]

      // Act
      renderTable(logs)

      // Assert — both actor names visible
      expect(screen.getByText('Alice Admin')).toBeInTheDocument()
      expect(screen.getByText('Bob Tech')).toBeInTheDocument()
    })

    it('renders the entityId in each row', () => {
      // Arrange
      const log = makeLog({ entityId: 'asset-abc-123', entityType: 'asset' })

      // Act
      renderTable([log])

      // Assert
      expect(screen.getByText('asset-abc-123')).toBeInTheDocument()
    })
  })

  // ── (b) click row → AuditDiff becomes visible ────────────────────────────────
  describe('(b) row expand / collapse (AuditDiff)', () => {
    it('AuditDiff is NOT visible before clicking the row', () => {
      // Arrange
      const log = makeLog({
        before: { statusId: 'st_warehouse' },
        after:  { statusId: 'st_assigned' },
      })

      // Act
      renderTable([log])

      // Assert — diff values are absent until the row is expanded
      expect(screen.queryByText('st_warehouse')).toBeNull()
      expect(screen.queryByText('st_assigned')).toBeNull()
    })

    it('clicking a row reveals AuditDiff with before/after values', () => {
      // Arrange
      const log = makeLog({
        id: 'log-expand',
        before: { statusId: 'st_warehouse' },
        after:  { statusId: 'st_assigned' },
      })
      renderTable([log])

      // Find the data row (not the header) — the row that contains the actor name
      const rows = screen.getAllByRole('row')
      // rows[0] is the thead <tr>; rows[1] is the first data row
      const dataRow = rows[1]!

      // Act
      fireEvent.click(dataRow)

      // Assert — diff values now appear in the document
      expect(screen.getByText('st_warehouse')).toBeInTheDocument()
      expect(screen.getByText('st_assigned')).toBeInTheDocument()
    })

    it('clicking an expanded row again collapses AuditDiff', () => {
      // Arrange
      const log = makeLog({
        id: 'log-collapse',
        before: { invCode: 'OLD/001' },
        after:  { invCode: 'NEW/001' },
      })
      renderTable([log])

      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]!

      // Act: expand
      fireEvent.click(dataRow)
      expect(screen.getByText('OLD/001')).toBeInTheDocument()

      // Act: collapse
      fireEvent.click(dataRow)

      // Assert — diff values gone
      expect(screen.queryByText('OLD/001')).toBeNull()
      expect(screen.queryByText('NEW/001')).toBeNull()
    })

    it('expanding one row does not expand another (only one diff visible at a time)', () => {
      // Arrange
      const logs = [
        makeLog({ id: 'log-A', before: { x: 'before-A' }, after: { x: 'after-A' } }),
        makeLog({ id: 'log-B', before: { x: 'before-B' }, after: { x: 'after-B' } }),
      ]
      renderTable(logs)

      const rows = screen.getAllByRole('row')
      // rows[0] = thead, rows[1] = log-A data row, rows[2] = log-B data row
      const rowA = rows[1]!
      const rowB = rows[2]!

      // Act: expand row A
      fireEvent.click(rowA)
      expect(screen.getByText('after-A')).toBeInTheDocument()
      expect(screen.queryByText('after-B')).toBeNull()

      // Act: expand row B (should collapse A)
      fireEvent.click(rowB)
      expect(screen.getByText('after-B')).toBeInTheDocument()
      expect(screen.queryByText('after-A')).toBeNull()
    })
  })

  // ── (c) entityId link vs muted span ──────────────────────────────────────────
  describe('(c) entityId — routable vs non-routable', () => {
    it('renders a button for a routable entityType (asset)', () => {
      // Arrange
      const log = makeLog({ entityType: 'asset', entityId: 'asset-link-id' })

      // Act
      renderTable([log])

      // Assert — the entityId is rendered as a clickable button
      const btn = screen.getByRole('button', { name: 'asset-link-id' })
      expect(btn).toBeInTheDocument()
    })

    it('renders a button for a routable entityType (employee)', () => {
      // Arrange
      const log = makeLog({ entityType: 'employee', entityId: 'emp-link-id' })

      // Act
      renderTable([log])

      // Assert
      const btn = screen.getByRole('button', { name: 'emp-link-id' })
      expect(btn).toBeInTheDocument()
    })

    it('renders a NON-interactive span for a non-routable entityType (category)', () => {
      // Arrange
      const log = makeLog({ entityType: 'category', entityId: 'cat-no-link' })

      // Act
      renderTable([log])

      // Assert — no button role for this entityId
      expect(screen.queryByRole('button', { name: 'cat-no-link' })).toBeNull()
      // The entityId text is still visible as a plain span
      expect(screen.getByText('cat-no-link')).toBeInTheDocument()
    })

    it('renders a NON-interactive span for non-routable entityType (asset_status)', () => {
      // Arrange
      const log = makeLog({ entityType: 'asset_status', entityId: 'st-no-link' })

      // Act
      renderTable([log])

      // Assert — no button, plain text present
      expect(screen.queryByRole('button', { name: 'st-no-link' })).toBeNull()
      expect(screen.getByText('st-no-link')).toBeInTheDocument()
    })

    it('clicking the entityId button stops row expansion (stopPropagation)', () => {
      // Arrange: an asset log where entityId link is a button
      const log = makeLog({
        id: 'log-stop-prop',
        entityType: 'asset',
        entityId: 'asset-stop-id',
        before: { invCode: 'OLD/999' },
        after:  { invCode: 'NEW/999' },
      })
      renderTable([log])

      // Locate the entityId button
      const entityBtn = screen.getByRole('button', { name: 'asset-stop-id' })

      // Assert — diff NOT visible before any click
      expect(screen.queryByText('OLD/999')).toBeNull()

      // Act — click the entityId link (should NOT expand the diff row due to stopPropagation)
      fireEvent.click(entityBtn)

      // Assert — diff still NOT visible (stopPropagation prevented row toggle)
      expect(screen.queryByText('OLD/999')).toBeNull()
    })

    it('entityId button navigates to the correct asset route', () => {
      // Arrange: render with a sibling Routes sentinel so we can assert navigation
      const log = makeLog({
        id: 'log-nav',
        entityType: 'asset',
        entityId: 'asset-nav-123',
      })

      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/audit']}>
            <Routes>
              <Route path="/audit" element={<AuditTable rows={[log]} ref={REF_DATA} />} />
              <Route path="/assets/:id" element={<div>ASSET_DETAIL_SENTINEL</div>} />
            </Routes>
          </MemoryRouter>
        </I18nextProvider>,
      )

      // Act — click the entityId link
      const entityBtn = screen.getByRole('button', { name: 'asset-nav-123' })
      fireEvent.click(entityBtn)

      // Assert — router navigated to the asset detail page
      expect(screen.getByText('ASSET_DETAIL_SENTINEL')).toBeInTheDocument()
    })
  })

  // ── (d) Fragment key — no React key warnings ─────────────────────────────────
  describe('(d) Fragment key — no console.error for missing React keys', () => {
    it('renders multiple rows without React key warnings', () => {
      // Arrange: spy on console.error to catch React key warnings
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const logs = [
        makeLog({ id: 'log-key-1' }),
        makeLog({ id: 'log-key-2' }),
        makeLog({ id: 'log-key-3' }),
      ]

      // Act
      renderTable(logs)

      // Assert — no "Each child in a list should have a unique key" warning
      const keyWarnings = consoleSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('unique key'),
      )
      expect(keyWarnings).toHaveLength(0)

      consoleSpy.mockRestore()
    })
  })

  // ── (e) empty rows — no crash ─────────────────────────────────────────────────
  describe('(e) edge cases', () => {
    it('renders without crashing when rows is empty', () => {
      // Arrange + Act
      renderTable([])

      // Assert — table is in the document, no rows except the header
      const rows = screen.getAllByRole('row')
      expect(rows).toHaveLength(1) // only the thead <tr>
    })
  })
})
