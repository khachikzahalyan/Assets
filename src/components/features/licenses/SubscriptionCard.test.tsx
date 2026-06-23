/**
 * SubscriptionCard component tests.
 *
 * Covers: seat ratio (used/total), expiry badge within 10 days, no assignees
 * message, manage button presence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { SubscriptionCard } from './SubscriptionCard'
import type { Subscription } from '@/domain/subscription'
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

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    name: 'GitHub Enterprise',
    vendorEmail: null,
    seatsTotal: 20,
    assignedEmployeeIds: [],
    purchaseDate: '2026-01-01',
    expiryDate: '2027-01-01',
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'u_001',
    updatedBy: 'u_001',
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.test',
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

function renderCard(sub: Subscription, employees: Employee[] = [], onUpdateAssignees = vi.fn().mockResolvedValue(undefined)) {
  render(
    <I18nextProvider i18n={i18n}>
      <SubscriptionCard sub={sub} employees={employees} onUpdateAssignees={onUpdateAssignees} />
    </I18nextProvider>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SubscriptionCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  // ── 1. Card renders with testid ─────────────────────────────────────────────

  it('renders article with data-testid=sub-card-{id}', () => {
    // Arrange + Act
    renderCard(makeSub({ id: 'sub_abc' }))

    // Assert
    expect(screen.getByTestId('sub-card-sub_abc')).toBeInTheDocument()
  })

  it('shows subscription name', () => {
    // Arrange + Act
    renderCard(makeSub({ name: 'Figma Pro' }))

    // Assert
    expect(screen.getByText('Figma Pro')).toBeInTheDocument()
  })

  // ── 2. Seat ratio ───────────────────────────────────────────────────────────

  it('SeatBar shows used/total seat count', () => {
    // Arrange — 3 assigned out of 10
    const sub = makeSub({
      seatsTotal: 10,
      assignedEmployeeIds: ['emp_1', 'emp_2', 'emp_3'],
    })

    // Act
    renderCard(sub)

    // Assert — "3 / 10" text somewhere in the card
    const card = screen.getByTestId('sub-card-sub_1')
    expect(card.textContent).toContain('3')
    expect(card.textContent).toContain('10')
  })

  it('SeatBar progressbar aria-valuenow equals used seat count', () => {
    // Arrange
    const sub = makeSub({
      seatsTotal: 15,
      assignedEmployeeIds: ['e1', 'e2', 'e3', 'e4', 'e5'],
    })

    // Act
    renderCard(sub)

    // Assert
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '5')
    expect(bar).toHaveAttribute('aria-valuemax', '15')
  })

  // ── 3. Expiry badge ─────────────────────────────────────────────────────────

  it('shows expiry badge when expiry is within 10 days', () => {
    // Arrange — expiry tomorrow
    const tomorrow = new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10)
    const sub = makeSub({ expiryDate: tomorrow })

    // Act
    renderCard(sub)

    // Assert — badge text contains "Истекает через"
    const badge = screen.getByText(/Истекает через/i)
    expect(badge).toBeInTheDocument()
  })

  it('does NOT show expiry badge when expiry is far in the future', () => {
    // Arrange — expiry in 1 year
    const farFuture = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
    const sub = makeSub({ expiryDate: farFuture })

    // Act
    renderCard(sub)

    // Assert — no expiry badge
    expect(screen.queryByText(/Истекает через/i)).toBeNull()
  })

  it('does NOT show expiry badge when expiryDate is null', () => {
    // Arrange
    const sub = makeSub({ expiryDate: null })

    // Act
    renderCard(sub)

    // Assert
    expect(screen.queryByText(/Истекает через/i)).toBeNull()
  })

  // ── 4. No assignees ─────────────────────────────────────────────────────────

  it('shows "не назначены" italic text when no employees assigned', () => {
    // Arrange — no assigned employees
    const sub = makeSub({ assignedEmployeeIds: [] })

    // Act
    renderCard(sub)

    // Assert — i18n key for notAssigned
    const notAssignedText = i18n.t('subs.notAssigned', { ns: 'licenses' })
    expect(screen.getByText(notAssignedText)).toBeInTheDocument()
  })

  it('shows employee count text when at least one employee is assigned', () => {
    // Arrange — 2 assigned employees, resolved against the employees prop
    const sub = makeSub({ assignedEmployeeIds: ['emp_1', 'emp_2'] })
    const employees = [
      makeEmployee({ id: 'emp_1', firstName: 'Anna', lastName: 'A' }),
      makeEmployee({ id: 'emp_2', firstName: 'Boris', lastName: 'B' }),
    ]

    // Act
    renderCard(sub, employees)

    // Assert — "2 сотрудника" (or similar plural)
    const card = screen.getByTestId('sub-card-sub_1')
    expect(card.textContent).toContain('2')
  })

  // ── 5. Manage button ────────────────────────────────────────────────────────

  it('renders manage-btn-{id} button', () => {
    // Arrange + Act
    renderCard(makeSub({ id: 'sub_mgmt' }))

    // Assert
    expect(screen.getByTestId('manage-btn-sub_mgmt')).toBeInTheDocument()
  })

  // ── 6. Vendor email ─────────────────────────────────────────────────────────

  it('shows vendor email when present', () => {
    // Arrange
    const sub = makeSub({ vendorEmail: 'admin@example.test' })

    // Act
    renderCard(sub)

    // Assert
    expect(screen.getByText('admin@example.test')).toBeInTheDocument()
  })

  it('does not show vendor email row when vendorEmail is null', () => {
    // Arrange
    const sub = makeSub({ vendorEmail: null })

    // Act
    renderCard(sub)

    // Assert
    expect(screen.queryByText(/@example/)).toBeNull()
  })
})
