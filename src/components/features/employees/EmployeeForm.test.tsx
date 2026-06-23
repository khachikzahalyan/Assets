import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeForm, isValidEmail } from './EmployeeForm'

describe('isValidEmail', () => {
  it('accepts a normal address', () => { expect(isValidEmail('i@x.com')).toBe(true) })
  it('rejects malformed', () => {
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
})

describe('EmployeeForm phone field', () => {
  it('renders the phone input in create mode', async () => {
    await i18n.changeLanguage('ru')
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeForm
          mode="create"
          branches={[]}
          departments={[]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(screen.getByLabelText('Телефон')).toBeInTheDocument()
  })

  it('renders the phone input in edit mode', async () => {
    await i18n.changeLanguage('ru')
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeForm
          mode="edit"
          initial={{ phone: '099123456' }}
          branches={[]}
          departments={[]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    const input = screen.getByLabelText('Телефон') as HTMLInputElement
    expect(input.value).toBe('099123456')
  })
})
