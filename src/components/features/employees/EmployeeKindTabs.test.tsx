/**
 * EmployeeKindTabs unit tests.
 *
 * Assertions:
 * (a) Renders both chips with correct labels and counts.
 * (b) The active tab (`selected='all'`) has `bg-[#F97316]` class; inactive does not.
 * (c) Clicking Сотрудники calls onSelect('staff').
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeKindTabs } from './EmployeeKindTabs'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderTabs(
  selected = 'all',
  onSelect = vi.fn(),
  counts = { all: 5, staff: 5 },
) {
  return {
    onSelect,
    ...render(
      <I18nextProvider i18n={i18n}>
        <EmployeeKindTabs
          selected={selected}
          onSelect={onSelect}
          counts={counts}
        />
      </I18nextProvider>,
    ),
  }
}

describe('EmployeeKindTabs', () => {
  // ── (a) Both chips render with correct labels and counts ─────────────────

  it('(a) renders the "Все" chip with count 5', () => {
    renderTabs()
    expect(screen.getByText('Все')).toBeInTheDocument()
  })

  it('(a) renders the "Сотрудники" chip with count 5', () => {
    renderTabs()
    expect(screen.getByText('Сотрудники')).toBeInTheDocument()
  })

  it('(a) renders count spans — both show 5', () => {
    renderTabs()
    const countSpans = screen.getAllByText('5')
    expect(countSpans).toHaveLength(2)
  })

  // ── (b) Active chip has bg-[#F97316]; inactive does not ──────────────────

  it('(b) active tab (all) has bg-[#F97316] class', () => {
    renderTabs('all')
    const allButton = screen.getByRole('button', { name: /Все/ })
    expect(allButton.className).toContain('bg-[#F97316]')
  })

  it('(b) inactive tab (staff) does NOT have bg-[#F97316] class', () => {
    renderTabs('all')
    const staffButton = screen.getByRole('button', { name: /Сотрудники/ })
    expect(staffButton.className).not.toContain('bg-[#F97316]')
  })

  it('(b) when staff is active, staff chip has bg-[#F97316]', () => {
    renderTabs('staff')
    const staffButton = screen.getByRole('button', { name: /Сотрудники/ })
    expect(staffButton.className).toContain('bg-[#F97316]')
  })

  // ── (c) Clicking Сотрудники calls onSelect('staff') ──────────────────────

  it('(c) clicking Сотрудники calls onSelect with "staff"', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderTabs('all')
    const staffButton = screen.getByRole('button', { name: /Сотрудники/ })
    await user.click(staffButton)
    expect(onSelect).toHaveBeenCalledWith('staff')
  })

  it('(c) clicking Все calls onSelect with "all"', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderTabs('staff')
    const allButton = screen.getByRole('button', { name: /Все/ })
    await user.click(allButton)
    expect(onSelect).toHaveBeenCalledWith('all')
  })
})
