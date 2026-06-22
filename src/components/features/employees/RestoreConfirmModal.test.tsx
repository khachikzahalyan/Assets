/**
 * RestoreConfirmModal unit tests.
 *
 * Uses real i18n (ru locale) via I18nextProvider so translated strings are
 * asserted rather than keys.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { RestoreConfirmModal } from './RestoreConfirmModal'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const EMP = { id: 'emp_1', firstName: 'Иван', lastName: 'Иванов' }

describe('RestoreConfirmModal', () => {
  it('renders title and employee name when open', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RestoreConfirmModal
          open
          emp={EMP}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(screen.getByText('Восстановить сотрудника?')).toBeInTheDocument()
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
  })

  it('calls onConfirm when Восстановить button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <RestoreConfirmModal
          open
          emp={EMP}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Восстановить/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Отмена button is clicked', () => {
    const onClose = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <RestoreConfirmModal
          open
          emp={EMP}
          onConfirm={vi.fn()}
          onClose={onClose}
        />
      </I18nextProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Отмена/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when emp is null', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <RestoreConfirmModal
          open
          emp={null}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when open is false', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <RestoreConfirmModal
          open={false}
          emp={EMP}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })
})
