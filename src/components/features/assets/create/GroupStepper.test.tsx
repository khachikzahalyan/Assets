import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { useState } from 'react'
import i18n from '@/lib/i18n'
import { GroupStepper, type GroupRow } from './GroupStepper'

beforeAll(async () => { await i18n.changeLanguage('ru') })

function Harness({ requiresSerial = true, placeholder = '460/00007' }: { requiresSerial?: boolean; placeholder?: string }) {
  const [rows, setRows] = useState<GroupRow[]>([])
  const [quantity, setQuantity] = useState(3)
  return (
    <I18nextProvider i18n={i18n}>
      <GroupStepper
        requiresSerial={requiresSerial}
        quantity={quantity}
        setQuantity={setQuantity}
        rows={rows}
        setRows={setRows}
        invPlaceholder={placeholder}
      />
      <div data-testid="rows">{rows.map(r => `${r.invCode}|${r.serial}`).join(',')}</div>
    </I18nextProvider>
  )
}

describe('GroupStepper', () => {
  it('confirms a row and auto-advances the inventory code', () => {
    render(<Harness />)
    const inv = screen.getByPlaceholderText('460/00007') as HTMLInputElement
    const ser = screen.getByPlaceholderText('SN-…') as HTMLInputElement
    fireEvent.change(inv, { target: { value: '460/00007' } })
    fireEvent.change(ser, { target: { value: 'SN-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))

    expect(screen.getByTestId('rows').textContent).toBe('460/00007|SN-1')
    // The active inventory code advanced to 460/00008
    expect((screen.getByPlaceholderText('460/00007') as HTMLInputElement).value).toBe('460/00008')
  })

  it('blocks confirming a duplicate inventory code within the batch', () => {
    render(<Harness />)
    const confirm = () => fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))
    fireEvent.change(screen.getByPlaceholderText('460/00007'), { target: { value: '460/00007' } })
    fireEvent.change(screen.getByPlaceholderText('SN-…'), { target: { value: 'SN-1' } })
    confirm()
    // Force the active code back to the duplicate; serial differs.
    fireEvent.change(screen.getByPlaceholderText('460/00007'), { target: { value: '460/00007' } })
    fireEvent.change(screen.getByPlaceholderText('SN-…'), { target: { value: 'SN-2' } })
    // Confirm button is disabled because invCode duplicates an existing row.
    expect(screen.getByRole('button', { name: /Подтвердить/i })).toBeDisabled()
    expect(screen.getByText(/уже добавлен в партию/i)).toBeTruthy()
  })

  it('Enter commits the active row', () => {
    render(<Harness requiresSerial={false} placeholder="470/00012" />)
    const inv = screen.getByPlaceholderText('470/00012')
    fireEvent.change(inv, { target: { value: '470/00012' } })
    fireEvent.keyDown(inv, { key: 'Enter' })
    expect(screen.getByTestId('rows').textContent).toBe('470/00012|')
  })

  it('deletes a confirmed row', () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText('460/00007'), { target: { value: '460/00007' } })
    fireEvent.change(screen.getByPlaceholderText('SN-…'), { target: { value: 'SN-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))
    expect(screen.getByTestId('rows').textContent).toBe('460/00007|SN-1')
    fireEvent.click(screen.getByRole('button', { name: /Удалить строку 1/i }))
    expect(screen.getByTestId('rows').textContent).toBe('')
  })

  it('pulls a confirmed row back into the active form (edit)', () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText('460/00007'), { target: { value: '460/00007' } })
    fireEvent.change(screen.getByPlaceholderText('SN-…'), { target: { value: 'SN-1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))
    fireEvent.click(screen.getByRole('button', { name: /Редактировать строку 1/i }))
    expect(screen.getByTestId('rows').textContent).toBe('')
    expect((screen.getByPlaceholderText('460/00007') as HTMLInputElement).value).toBe('460/00007')
  })
})
