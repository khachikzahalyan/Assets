/**
 * ManageAssigneesModal component tests.
 *
 * Covers: search filtering, toggle calls onUpdateAssignees with correct ids,
 * selected employees show aria-pressed=true (checkmark), employee count in footer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { ManageAssigneesModal } from './ManageAssigneesModal'
import type { Employee } from '@/domain/employee'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOW = '2026-06-22T12:00:00.000Z'

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1',
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.test',
    phone: null,
    position: 'Developer',
    branchId: null,
    departmentId: null,
    status: 'active',
    terminatedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const EMP_ALICE = makeEmployee({ id: 'emp_alice', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.test' })
const EMP_BOB   = makeEmployee({ id: 'emp_bob',   firstName: 'Bob',   lastName: 'Jones', email: 'bob@example.test', position: 'Designer' })
const EMP_CAROL = makeEmployee({ id: 'emp_carol', firstName: 'Carol', lastName: 'White', email: 'carol@example.test', position: 'QA' })

function renderModal({
  employees = [EMP_ALICE, EMP_BOB, EMP_CAROL],
  initialAssignedIds = [] as string[],
  onUpdateAssignees = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
  seatsTotal = 10,
} = {}) {
  render(
    <I18nextProvider i18n={i18n}>
      <ManageAssigneesModal
        subId="sub_1"
        subName="Slack Business"
        seatsTotal={seatsTotal}
        initialAssignedIds={initialAssignedIds}
        employees={employees}
        onUpdateAssignees={onUpdateAssignees}
        onClose={onClose}
      />
    </I18nextProvider>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ManageAssigneesModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  // ── 1. Renders employees ────────────────────────────────────────────────────

  it('renders all employee names', () => {
    // Arrange + Act
    renderModal()

    // Assert
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('Carol White')).toBeInTheDocument()
  })

  // ── 2. Search filtering ─────────────────────────────────────────────────────

  it('search input filters employee list by name', () => {
    // Arrange
    renderModal()

    // Act — type "bob" into the search input
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'bob' } })

    // Assert — only Bob visible
    expect(screen.queryByText('Alice Smith')).toBeNull()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.queryByText('Carol White')).toBeNull()
  })

  it('search filters by email', () => {
    // Arrange
    renderModal()

    // Act
    const searchInput = screen.getByRole('textbox')
    fireEvent.change(searchInput, { target: { value: 'carol@' } })

    // Assert
    expect(screen.queryByText('Alice Smith')).toBeNull()
    expect(screen.queryByText('Bob Jones')).toBeNull()
    expect(screen.getByText('Carol White')).toBeInTheDocument()
  })

  it('shows not-found text when no employees match the search', () => {
    // Arrange
    renderModal()
    const searchInput = screen.getByRole('textbox')

    // Act
    fireEvent.change(searchInput, { target: { value: 'zzznobody' } })

    // Assert
    const notFound = i18n.t('manage.notFound', { ns: 'licenses' })
    expect(screen.getByText(notFound)).toBeInTheDocument()
  })

  // ── 3. Toggle calls onUpdateAssignees ───────────────────────────────────────

  it('clicking an unselected employee calls onUpdateAssignees with that id added', async () => {
    // Arrange
    const onUpdateAssignees = vi.fn().mockResolvedValue(undefined)
    renderModal({ initialAssignedIds: [], onUpdateAssignees })

    // Act — click Alice
    fireEvent.click(screen.getByText('Alice Smith'))

    // Assert — called with ['emp_alice']
    await waitFor(() => {
      expect(onUpdateAssignees).toHaveBeenCalledWith('sub_1', ['emp_alice'])
    })
  })

  it('clicking a selected employee calls onUpdateAssignees with that id removed', async () => {
    // Arrange — Alice already assigned
    const onUpdateAssignees = vi.fn().mockResolvedValue(undefined)
    renderModal({ initialAssignedIds: ['emp_alice'], onUpdateAssignees })

    // Act — click Alice (to deselect)
    fireEvent.click(screen.getByText('Alice Smith'))

    // Assert — called with empty array
    await waitFor(() => {
      expect(onUpdateAssignees).toHaveBeenCalledWith('sub_1', [])
    })
  })

  it('toggles add/remove correctly across multiple clicks', async () => {
    // Arrange
    const onUpdateAssignees = vi.fn().mockResolvedValue(undefined)
    renderModal({ initialAssignedIds: [], onUpdateAssignees })

    // Act — add Alice, then add Bob
    fireEvent.click(screen.getByText('Alice Smith'))
    await waitFor(() => expect(onUpdateAssignees).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('Bob Jones'))
    await waitFor(() => expect(onUpdateAssignees).toHaveBeenCalledTimes(2))

    // Assert — second call includes both Alice and Bob
    const secondCall = onUpdateAssignees.mock.calls[1] as [string, string[]]
    expect(secondCall[1]).toContain('emp_alice')
    expect(secondCall[1]).toContain('emp_bob')
  })

  // ── 4. Selected state via aria-pressed ─────────────────────────────────────

  it('initially assigned employees have aria-pressed=true', () => {
    // Arrange + Act
    renderModal({ initialAssignedIds: ['emp_alice'] })

    // Assert — Alice button has aria-pressed=true
    const aliceBtn = screen.getByRole('button', { name: /Alice Smith/ })
    expect(aliceBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('unassigned employees have aria-pressed=false', () => {
    // Arrange + Act
    renderModal({ initialAssignedIds: [] })

    // Assert
    const bobBtn = screen.getByRole('button', { name: /Bob Jones/ })
    expect(bobBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('selected employee shows a checkmark icon', () => {
    // Arrange + Act
    renderModal({ initialAssignedIds: ['emp_bob'] })

    // Assert — Bob row is in selected state (aria-pressed=true = has the check icon rendered)
    const bobBtn = screen.getByRole('button', { name: /Bob Jones/ })
    expect(bobBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // ── 5. Subscription name in header ─────────────────────────────────────────

  it('shows subscription name in header', () => {
    // Arrange + Act
    renderModal()

    // Assert
    expect(screen.getByText('Slack Business')).toBeInTheDocument()
  })

  // ── 6. Escape key calls onClose ─────────────────────────────────────────────

  it('pressing Escape calls onClose', () => {
    // Arrange
    const onClose = vi.fn()
    renderModal({ onClose })

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert
    expect(onClose).toHaveBeenCalled()
  })

  // ── 7. Stale assignees: terminated + deleted still hold seats ───────────────
  // Bug 2026-07-30: card said «2 сотрудника», modal showed 1 ✓ — the second
  // seat was held by a terminated employee filtered out of the list, with no
  // way to release it. Assigned-but-inactive people must stay visible and
  // removable; unassigned terminated people must not be offered.

  it('an assigned TERMINATED employee is rendered with the terminated badge and can be unassigned', async () => {
    // Arrange — Bob is terminated but still holds a seat
    const termBob = makeEmployee({ id: 'emp_bob', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.test', status: 'terminated' })
    const onUpdateAssignees = vi.fn().mockResolvedValue(undefined)
    renderModal({ employees: [EMP_ALICE, termBob], initialAssignedIds: ['emp_alice', 'emp_bob'], onUpdateAssignees })

    // Assert — Bob visible, marked selected, with the «Уволен» badge
    const badge = i18n.t('manage.terminatedBadge', { ns: 'licenses' })
    const bobBtn = screen.getByRole('button', { name: /Bob Jones/ })
    expect(bobBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(badge)).toBeInTheDocument()

    // Act — release the ghost seat
    fireEvent.click(bobBtn)

    // Assert — id removed
    await waitFor(() => {
      expect(onUpdateAssignees).toHaveBeenCalledWith('sub_1', ['emp_alice'])
    })
  })

  it('an UNASSIGNED terminated employee is not offered in the list', () => {
    // Arrange — Carol is terminated and holds no seat
    const termCarol = makeEmployee({ id: 'emp_carol', firstName: 'Carol', lastName: 'White', email: 'carol@example.test', status: 'terminated' })
    renderModal({ employees: [EMP_ALICE, termCarol], initialAssignedIds: [] })

    // Assert
    expect(screen.queryByText('Carol White')).toBeNull()
  })

  it('an assigned id with NO employee record renders a ghost row that can release the seat', async () => {
    // Arrange — 'emp_gone' no longer exists in /employees at all
    const onUpdateAssignees = vi.fn().mockResolvedValue(undefined)
    renderModal({ employees: [EMP_ALICE], initialAssignedIds: ['emp_alice', 'emp_gone'], onUpdateAssignees })

    // Assert — ghost row present and selected
    const ghost = i18n.t('manage.ghostEmployee', { ns: 'licenses' })
    const ghostBtn = screen.getByRole('button', { name: new RegExp(ghost) })
    expect(ghostBtn).toHaveAttribute('aria-pressed', 'true')

    // Act — release
    fireEvent.click(ghostBtn)

    // Assert
    await waitFor(() => {
      expect(onUpdateAssignees).toHaveBeenCalledWith('sub_1', ['emp_alice'])
    })
  })

  it('footer seat count includes ghost seats (matches the card)', () => {
    // Arrange — 1 live + 1 ghost = 2 seats used
    renderModal({ employees: [EMP_ALICE], initialAssignedIds: ['emp_alice', 'emp_gone'] })

    // Assert — subtitle shows 2 / 10
    const subtitle = i18n.t('manage.subtitle', { ns: 'licenses', count: 2, total: 10 })
    expect(screen.getByText(subtitle)).toBeInTheDocument()
  })
})
