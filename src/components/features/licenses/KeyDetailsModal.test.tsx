/**
 * KeyDetailsModal component tests.
 *
 * Covers: default masked key display, copy/reveal for privileged roles,
 * copy button hidden for non-privileged role, history timeline,
 * empty history state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { KeyDetailsModal } from './KeyDetailsModal'
import type { AuditLog } from '@/domain/audit'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOW = '2026-06-22T12:00:00.000Z'

function makeAuditEntry(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'al_1',
    entityType: 'license',
    entityId: 'lic_1',
    action: 'assigned',
    actorUid: 'u_001',
    actorRole: 'super_admin',
    before: null,
    after: null,
    comment: null,
    at: NOW,
    ...overrides,
  }
}

const MASKED = '****-****-****-5592'
const RAW_KEY = 'ABCDE-FGHIJ-KLMNO-PQRST-UVWXY'

function renderModal({
  canReveal = true,
  revealFn = vi.fn().mockResolvedValue(RAW_KEY),
  auditEntries = [] as AuditLog[],
  isInUse = false,
  maskedKey = MASKED,
} = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <KeyDetailsModal
        licenseId="lic_test"
        maskedKey={maskedKey}
        version="Windows 11 Pro"
        isInUse={isInUse}
        auditEntries={auditEntries}
        canReveal={canReveal}
        revealFn={revealFn}
        onClose={vi.fn()}
      />
    </I18nextProvider>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('KeyDetailsModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  // ── 1. Default masked key display ──────────────────────────────────────────

  it('displays the masked key by default (not the raw key)', () => {
    // Arrange + Act
    renderModal({ maskedKey: MASKED })

    // Assert — masked form shown
    expect(screen.getByText(MASKED)).toBeInTheDocument()
    // Raw key must NOT appear
    expect(screen.queryByText(RAW_KEY)).toBeNull()
  })

  it('shows the license version name in the modal', () => {
    // Arrange + Act
    renderModal()

    // Assert
    expect(screen.getByText('Windows 11 Pro')).toBeInTheDocument()
  })

  // ── 2. Copy button for privileged roles ────────────────────────────────────

  it('copy button IS rendered when canReveal=true', () => {
    // Arrange + Act
    renderModal({ canReveal: true })

    // Assert — copy button present
    expect(screen.getByRole('button', { name: /копировать|copy/i })).toBeInTheDocument()
  })

  it('copy button is NOT rendered when canReveal=false', () => {
    // Arrange + Act
    renderModal({ canReveal: false })

    // Assert — no copy button
    expect(screen.queryByRole('button', { name: /копировать|copy/i })).toBeNull()
  })

  // ── 3. Reveal flow ─────────────────────────────────────────────────────────

  it('clicking copy calls revealFn and then copies raw key to clipboard', async () => {
    // Arrange
    const revealFn = vi.fn().mockResolvedValue(RAW_KEY)
    renderModal({ canReveal: true, revealFn })

    // Act
    fireEvent.click(screen.getByRole('button', { name: /копировать|copy/i }))

    // Assert — revealFn called with correct args
    await waitFor(() => {
      expect(revealFn).toHaveBeenCalledWith('licenses', 'lic_test')
    })

    // Assert — clipboard.writeText called with the raw key
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(RAW_KEY)
    })
  })

  it('after reveal, the raw key is displayed in the key area', async () => {
    // Arrange
    const revealFn = vi.fn().mockResolvedValue(RAW_KEY)
    renderModal({ canReveal: true, revealFn })

    // Act
    fireEvent.click(screen.getByRole('button', { name: /копировать|copy/i }))

    // Assert — raw key text appears
    expect(await screen.findByText(RAW_KEY)).toBeInTheDocument()
  })

  // ── 4. History timeline ────────────────────────────────────────────────────

  it('shows empty history text when auditEntries is empty and key is not in use', () => {
    // Arrange + Act
    renderModal({ auditEntries: [], isInUse: false })

    // Assert — empty history text
    const emptyText = i18n.t('keyDetails.historyEmpty', { ns: 'licenses' })
    expect(screen.getByText(emptyText)).toBeInTheDocument()
  })

  it('renders audit entry actions in the history timeline', () => {
    // Arrange
    const entries = [
      makeAuditEntry({ id: 'al_1', action: 'assigned', at: '2026-01-01T10:00:00.000Z' }),
      makeAuditEntry({ id: 'al_2', action: 'created',  at: '2025-12-01T08:00:00.000Z' }),
    ]

    // Act
    renderModal({ auditEntries: entries, isInUse: false })

    // Assert — both actions visible, rendered via their translated labels
    expect(screen.getByText(i18n.t('licenses:keyDetails.action.assigned'))).toBeInTheDocument()
    expect(screen.getByText(i18n.t('licenses:keyDetails.action.created'))).toBeInTheDocument()
  })

  it('filters out non-timeline actions (e.g. subscription_created) from history', () => {
    // Arrange — only 'assigned', 'created', 'key_rotated', 'license_decoupled' are shown
    const entries = [
      makeAuditEntry({ id: 'al_1', action: 'assigned' }),
      makeAuditEntry({ id: 'al_2', action: 'subscription_created' as AuditLog['action'] }),
    ]

    // Act
    renderModal({ auditEntries: entries, isInUse: false })

    // Assert — only 'assigned' is visible (via its translated label);
    // the non-timeline action is filtered out, so its raw label never renders
    expect(screen.getByText(i18n.t('licenses:keyDetails.action.assigned'))).toBeInTheDocument()
    expect(screen.queryByText('subscription_created')).toBeNull()
  })

  it('shows the "current" asset name when isInUse and assetName are provided', () => {
    // Arrange + Act
    render(
      <I18nextProvider i18n={i18n}>
        <KeyDetailsModal
          licenseId="lic_test"
          maskedKey={MASKED}
          version="Windows 11 Pro"
          isInUse={true}
          assetName="Dell Latitude 7420"
          invCode="450/302042"
          auditEntries={[]}
          canReveal={true}
          revealFn={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )

    // Assert
    expect(screen.getByText('Dell Latitude 7420')).toBeInTheDocument()
    expect(screen.getByText('450/302042')).toBeInTheDocument()
  })

  // ── 5. Escape key closes modal ─────────────────────────────────────────────

  it('pressing Escape calls onClose', () => {
    // Arrange
    const onClose = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <KeyDetailsModal
          licenseId="lic_test"
          maskedKey={MASKED}
          version="Windows 11 Pro"
          isInUse={false}
          auditEntries={[]}
          canReveal={true}
          revealFn={vi.fn()}
          onClose={onClose}
        />
      </I18nextProvider>,
    )

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert
    expect(onClose).toHaveBeenCalled()
  })
})
