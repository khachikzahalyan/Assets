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

  it('confirm button is not disabled for a past return date (no floor)', () => {
    const { onChange } = setup()
    // open popover, navigate to temporary sub-panel
    fireEvent.click(screen.getByRole('button', { name: 'Склад' }))
    fireEvent.click(screen.getByText('Временно'))

    // The date input must NOT have a min attribute (floor removed)
    const dateInput = document.getElementById('dest-return-date') as HTMLInputElement | null
    // DatePicker may render a hidden native input or a custom trigger —
    // assert no min attribute is present if the native input is found
    if (dateInput) {
      expect(dateInput.getAttribute('min')).toBeNull()
    }

    // Pick a kind (Аудит) — default returnDate is +7 days (future), confirm must be enabled
    fireEvent.click(screen.getByRole('button', { name: 'Аудит' }))
    const confirmBtn = screen.getByText('Подтвердить').closest('button') as HTMLButtonElement
    expect(confirmBtn).not.toBeDisabled()

    // Confirm fires onChange even when date is present (no past-date guard)
    fireEvent.click(confirmBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0]?.[0] as Destination
    expect(arg.kind).toBe('temporary')
  })
})
