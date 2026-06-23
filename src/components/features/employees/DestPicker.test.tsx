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
    const arg = onChange.mock.calls[0][0] as Destination
    expect(arg.kind).toBe('temporary')
    if (arg.kind === 'temporary') {
      expect(arg.tempKind).toBe('audit')
      expect(arg.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(arg.label).toContain('Аудит')
    }
  })
})
