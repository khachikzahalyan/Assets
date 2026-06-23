import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { DestPicker, type Destination } from './DestPicker'

beforeAll(async () => { await i18n.changeLanguage('ru') })

function setup(onChange = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <DestPicker
        value={{ kind: 'warehouse' }}
        onChange={onChange}
        currentEmpId="e0"
        employees={[]}
        departments={[]}
        branches={[]}
      />
    </I18nextProvider>,
  )
  return { onChange }
}

describe('DestPicker temporary', () => {
  it('opens the temporary sub-panel and commits a temporary destination', () => {
    const { onChange } = setup()
    // open the popover (chip trigger shows the warehouse label «Склад»)
    fireEvent.click(screen.getByRole('button', { name: 'Склад' }))
    // click the «Временно» top option
    fireEvent.click(screen.getByText('Временно'))
    // pick «Аудит»
    fireEvent.click(screen.getByRole('button', { name: 'Аудит' }))
    // confirm
    fireEvent.click(screen.getByText('Подтвердить'))
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]?.[0] as Destination
    expect(arg.kind).toBe('temporary')
    if (arg.kind === 'temporary') {
      expect(arg.tempKind).toBe('audit')
      expect(arg.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(arg.label).toContain('Аудит')
    }
  })

  it('selects a PAST return date and commits an expiresAt in the past (floor removed)', () => {
    const { onChange } = setup()

    // Arrange — open popover and navigate to the temporary sub-panel
    fireEvent.click(screen.getByRole('button', { name: 'Склад' }))
    fireEvent.click(screen.getByText('Временно'))
    // Pick a kind so the confirm button becomes enabled
    fireEvent.click(screen.getByRole('button', { name: 'Аудит' }))

    // Act — open the DatePicker calendar.
    // The trigger is a <button id="dest-return-date"> (DatePicker renders it this way).
    const trigger = document.getElementById('dest-return-date') as HTMLButtonElement
    expect(trigger).not.toBeNull()
    fireEvent.click(trigger)

    // The DatePicker renders its calendar into a portal attached to document.body
    // (data-dp-portal="true"). Query within that portal so we don't accidentally
    // target the DestPicker's own «Назад» back-arrow (same translated text).
    const calPortal = document.querySelector('[data-dp-portal]') as HTMLElement
    expect(calPortal).not.toBeNull()

    // Navigate back two months so every in-month day cell is guaranteed to be
    // in the past regardless of today's day-of-month.
    const calBackBtn = calPortal.querySelector('[aria-label="Назад"]') as HTMLButtonElement
    expect(calBackBtn).not.toBeNull()
    fireEvent.click(calBackBtn)
    fireEvent.click(calBackBtn)

    // Click day "15" within the calendar portal.
    // Day 15 is always an in-month cell (never a prev/next overflow row).
    const dayButtons = Array.from(calPortal.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === '15',
    )
    expect(dayButtons.length).toBeGreaterThan(0)
    fireEvent.click(dayButtons[dayButtons.length - 1]!)

    // Confirm — button must not be disabled with a selected date and kind
    const confirmBtn = screen.getByText('Подтвердить').closest('button') as HTMLButtonElement
    expect(confirmBtn).not.toBeDisabled()
    fireEvent.click(confirmBtn)

    // Assert — onChange called once with a temporary destination dated in the past
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]?.[0] as Destination
    expect(arg.kind).toBe('temporary')
    if (arg.kind === 'temporary') {
      const todayISO = (() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })()
      // The committed expiresAt must be strictly before today
      expect(arg.expiresAt < todayISO).toBe(true)
    }
  })
})
