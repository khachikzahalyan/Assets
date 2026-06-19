import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuditDiff } from './AuditDiff'
import type { AuditLog } from '@/domain/audit'

// All assertions target values, structure, or masked strings — not translated labels.

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderDiff(log: AuditLog) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuditDiff log={log} />
    </I18nextProvider>,
  )
}

/** Minimal valid AuditLog builder */
function makeLog(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: 'log-1',
    entityType: 'asset',
    entityId: 'asset-1',
    action: 'created',
    actorUid: 'uid-1',
    actorRole: 'asset_admin',
    before: null,
    after: null,
    comment: null,
    at: '2026-01-10T10:00:00.000Z',
    ...overrides,
  }
}

describe('AuditDiff', () => {
  // ── (a) created entry — before=null, only "added" rows (no before column values) ──────────
  it('(a) created entry (before=null) shows only added rows — before cells show dash, after cells show new values', () => {
    const log = makeLog({
      action: 'created',
      before: null,
      after: { invCode: 'LAP/001', brand: 'Dell' },
    })

    // Arrange + Act
    renderDiff(log)

    // Assert — after values appear in the document
    expect(screen.getByText('LAP/001')).toBeInTheDocument()
    expect(screen.getByText('Dell')).toBeInTheDocument()

    // The "before" column should show em-dash (—) for added rows (no prior value)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2) // one per added key

    // Key names appear in the field column
    expect(screen.getByText('invCode')).toBeInTheDocument()
    expect(screen.getByText('brand')).toBeInTheDocument()
  })

  // ── (b) update entry — changed rows have BOTH before and after values ────────────────────
  it('(b) update entry shows changed rows with both before AND after values present', () => {
    const log = makeLog({
      action: 'updated',
      before: { statusId: 'st_warehouse', brand: 'Dell' },
      after:  { statusId: 'st_assigned',  brand: 'Dell' }, // brand unchanged — must NOT appear
    })

    // Arrange + Act
    renderDiff(log)

    // Assert — only the changed key (statusId) appears; unchanged brand does NOT
    expect(screen.getByText('statusId')).toBeInTheDocument()
    expect(screen.getByText('st_warehouse')).toBeInTheDocument() // before value
    expect(screen.getByText('st_assigned')).toBeInTheDocument()  // after value

    // brand is unchanged so it should not appear in the diff table
    expect(screen.queryByText('brand')).toBeNull()
  })

  // ── (c) masked value renders verbatim ────────────────────────────────────────────────────
  it('(c) a masked value renders verbatim — the masked string appears as-is in the DOM', () => {
    const MASKED = '****-****-****-5592'
    const log = makeLog({
      action: 'updated',
      before: { cardNumber: '1234-5678-9012-5592' },
      after:  { cardNumber: MASKED },
    })

    // Arrange + Act
    renderDiff(log)

    // Assert — the exact masked string is in the document without any reveal affordance
    expect(screen.getByText(MASKED)).toBeInTheDocument()

    // Sanity: no button that could unmask exists
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  // ── (d) comment renders when present ────────────────────────────────────────────────────
  it('(d) comment renders when present', () => {
    const COMMENT = 'Transferred per request #42'
    const log = makeLog({
      action: 'updated',
      before: { statusId: 'old' },
      after:  { statusId: 'new' },
      comment: COMMENT,
    })

    // Arrange + Act
    renderDiff(log)

    // Assert — the comment text is rendered in the document
    expect(screen.getByText(COMMENT)).toBeInTheDocument()
  })

  // ── (e) no-changes empty state ───────────────────────────────────────────────────────────
  it('(e) shows empty state when before and after are identical (no diff rows)', () => {
    const log = makeLog({
      action: 'updated',
      before: { statusId: 'st_warehouse' },
      after:  { statusId: 'st_warehouse' }, // identical — no diff
    })

    // Arrange + Act
    renderDiff(log)

    // Assert — no table rows rendered; the translated "noChanges" message is shown
    expect(screen.queryByRole('row')).toBeNull()
    expect(screen.getByText(i18n.t('diff.noChanges', { ns: 'audit' }))).toBeInTheDocument()
  })
})
