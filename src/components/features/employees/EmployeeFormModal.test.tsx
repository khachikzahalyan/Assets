/**
 * EmployeeFormModal unit tests.
 *
 * Uses real i18n (ru locale) via I18nextProvider so translated strings are
 * asserted rather than keys.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeFormModal } from './EmployeeFormModal'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'dep_it', name: 'IT' },
  { id: 'dep_hr', name: 'HR' },
]

const INITIAL_EMPLOYEE = {
  id: 'emp_1',
  firstName: 'Иван',
  lastName: 'Иванов',
  email: 'ivan@company.am',
  phone: '094908978',
  position: 'Менеджер',
  departmentId: 'dep_it',
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderCreate(overrides?: {
  onSave?: ReturnType<typeof vi.fn>
  onClose?: ReturnType<typeof vi.fn>
}) {
  const onSave  = overrides?.onSave  ?? vi.fn()
  const onClose = overrides?.onClose ?? vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <EmployeeFormModal
        open
        initial={null}
        departments={DEPARTMENTS}
        onSave={onSave}
        onClose={onClose}
      />
    </I18nextProvider>,
  )
  return { onSave, onClose }
}

function renderEdit(overrides?: {
  onSave?: ReturnType<typeof vi.fn>
  onClose?: ReturnType<typeof vi.fn>
}) {
  const onSave  = overrides?.onSave  ?? vi.fn()
  const onClose = overrides?.onClose ?? vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <EmployeeFormModal
        open
        initial={INITIAL_EMPLOYEE}
        departments={DEPARTMENTS}
        onSave={onSave}
        onClose={onClose}
      />
    </I18nextProvider>,
  )
  return { onSave, onClose }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmployeeFormModal — create mode', () => {
  it('renders editable firstName input', () => {
    renderCreate()
    // In create mode, firstName is an editable input
    const firstNameInput = screen.getByRole('textbox', { name: /Имя/i })
    expect(firstNameInput).toBeInTheDocument()
    expect(firstNameInput.tagName).toBe('INPUT')
  })

  it('Создать button is disabled initially (empty form)', () => {
    renderCreate()
    const createBtn = screen.getByRole('button', { name: /Создать/i })
    expect(createBtn).toBeDisabled()
  })

  it('Создать button enables and calls onSave with trimmed values when form is fully valid', () => {
    const { onSave } = renderCreate()

    // Fill firstName
    fireEvent.change(screen.getByRole('textbox', { name: /Имя/i }), {
      target: { value: '  Петр  ' },
    })
    // Fill lastName
    fireEvent.change(screen.getByRole('textbox', { name: /Фамилия/i }), {
      target: { value: '  Петров  ' },
    })
    // Fill position
    fireEvent.change(screen.getByRole('textbox', { name: /Должность/i }), {
      target: { value: 'Разработчик' },
    })
    // Select department
    fireEvent.change(screen.getByRole('combobox', { name: /Отдел/i }), {
      target: { value: 'dep_it' },
    })
    // Fill phone (9 digits: 094908978)
    fireEvent.change(screen.getByRole('textbox', { name: /Телефон/i }), {
      target: { value: '094908978' },
    })
    // Fill email
    fireEvent.change(screen.getByRole('textbox', { name: /Gmail/i }), {
      target: { value: 'petr@gmail.com' },
    })

    const createBtn = screen.getByRole('button', { name: /Создать/i })
    expect(createBtn).not.toBeDisabled()

    fireEvent.click(createBtn)

    expect(onSave).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const arg = onSave.mock.calls[0]![0] as ReturnType<typeof onSave>
    expect(arg.firstName).toBe('Петр')
    expect(arg.lastName).toBe('Петров')
    expect(arg.position).toBe('Разработчик')
    expect(arg.departmentId).toBe('dep_it')
    expect(arg.email).toBe('petr@gmail.com')
    // id must be undefined for create (page will generate it)
    expect(arg.id).toBeUndefined()
    // phone must be normalized to 9 digits
    expect(arg.phone).toBe('094908978')
  })
})

describe('EmployeeFormModal — edit mode', () => {
  it('firstName and lastName are read-only (no editable input for them)', () => {
    renderEdit()
    // The first name "Иван" and last name "Иванов" appear as text but NOT as inputs
    expect(screen.getByText('Иван')).toBeInTheDocument()
    expect(screen.getByText('Иванов')).toBeInTheDocument()
    // No textbox should have label "Имя" or "Фамилия"
    expect(screen.queryByRole('textbox', { name: /Имя/i })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Фамилия/i })).toBeNull()
  })

  it('email is read-only in edit mode (no editable input for it)', () => {
    renderEdit()
    expect(screen.getByText('ivan@company.am')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Gmail/i })).toBeNull()
  })

  it('position field is editable', () => {
    renderEdit()
    const posInput = screen.getByRole('textbox', { name: /Должность/i })
    expect(posInput).toBeInTheDocument()
    expect(posInput.tagName).toBe('INPUT')
  })

  it('phone field is editable', () => {
    renderEdit()
    const phoneInput = screen.getByRole('textbox', { name: /Телефон/i })
    expect(phoneInput).toBeInTheDocument()
    expect(phoneInput.tagName).toBe('INPUT')
  })

  it('Сохранить button is enabled when position and phone are valid', () => {
    renderEdit()
    // initial has valid position + phone so Сохранить should be enabled
    const saveBtn = screen.getByRole('button', { name: /Сохранить/i })
    expect(saveBtn).not.toBeDisabled()
  })

  it('Сохранить calls onSave with correct id', () => {
    const { onSave } = renderEdit()
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const arg = onSave.mock.calls[0]![0] as ReturnType<typeof onSave>
    expect(arg.id).toBe('emp_1')
  })
})

describe('EmployeeFormModal — phone formatting', () => {
  it('typing digits into phone shows formatted 0XX XX XX XX', () => {
    renderCreate()
    const phoneInput = screen.getByRole('textbox', { name: /Телефон/i })
    // simulate typing 9 raw digits
    fireEvent.change(phoneInput, { target: { value: '094908978' } })
    // After normalization + formatting, value should be "094 90 89 78"
    expect((phoneInput as HTMLInputElement).value).toBe('094 90 89 78')
  })
})
