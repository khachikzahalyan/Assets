/**
 * DestPicker unit tests.
 * The component portals its popover to document.body — all queries use document.body.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { DestPicker } from './DestPicker'
import type { DestPickerProps } from './DestPicker'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const EMPLOYEES = [
  { id: 'emp_1', name: 'Иван Иванов', status: 'active' },
  { id: 'emp_2', name: 'Мария Петрова', status: 'active' },
  { id: 'emp_3', name: 'Архивный Архивов', status: 'terminated' },
]

const DEPARTMENTS = [
  { id: 'dep_1', name: 'IT' },
  { id: 'dep_2', name: 'HR' },
]

const BRANCHES = [
  { id: 'br_1', name: 'Головной офис' },
  { id: 'br_2', name: 'Филиал Ереван' },
]

function renderPicker(overrides: Partial<DestPickerProps> = {}) {
  const onChange = overrides.onChange ?? vi.fn()
  const props: DestPickerProps = {
    value: overrides.value ?? { kind: 'warehouse' },
    onChange,
    currentEmpId: overrides.currentEmpId ?? 'emp_1',
    employees: overrides.employees ?? EMPLOYEES,
    departments: overrides.departments ?? DEPARTMENTS,
    branches: overrides.branches ?? BRANCHES,
    forceDropUp: overrides.forceDropUp ?? false,
  }
  render(
    <I18nextProvider i18n={i18n}>
      <DestPicker {...props} />
    </I18nextProvider>,
  )
  return { onChange }
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /склад|сотрудник|отдел|филиал/i }))
}

describe('DestPicker — chip renders', () => {
  it('renders Склад chip by default', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: /Склад/i })).toBeInTheDocument()
  })

  it('renders employee chip when value is employee kind', () => {
    renderPicker({ value: { kind: 'employee', id: 'emp_2', label: 'Мария Петрова' } })
    expect(screen.getByRole('button', { name: /Мария Петрова/i })).toBeInTheDocument()
  })
})

describe('DestPicker — opening popover shows 4 top options', () => {
  it('shows all 4 top-level options after clicking chip', () => {
    renderPicker()
    openPopover()
    const body = document.body
    // 'Склад' appears in both the chip and the popover option — use getAllByText
    expect(within(body).getAllByText('Склад').length).toBeGreaterThanOrEqual(1)
    expect(within(body).getByText('Сотрудник…')).toBeInTheDocument()
    expect(within(body).getByText('Отдел…')).toBeInTheDocument()
    expect(within(body).getByText('Филиал…')).toBeInTheDocument()
  })
})

describe('DestPicker — selecting Склад', () => {
  it('calls onChange with {kind: warehouse} when Склад is clicked', () => {
    const { onChange } = renderPicker()
    openPopover()
    // Get all Склад elements (chip + popover option) — click the last one (popover option)
    const skladEls = within(document.body).getAllByText('Склад')
    const lastSklad = skladEls[skladEls.length - 1]
    if (!lastSklad) throw new Error('Склад element not found')
    fireEvent.click(lastSklad)
    expect(onChange).toHaveBeenCalledWith({ kind: 'warehouse' })
  })
})

describe('DestPicker — employee sub-picker', () => {
  it('enters employee sub-picker when Сотрудник… is clicked', () => {
    renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Сотрудник…'))
    // Search input should appear
    expect(within(document.body).getByPlaceholderText('Поиск…')).toBeInTheDocument()
  })

  it('lists active employees excluding currentEmpId', () => {
    renderPicker({ currentEmpId: 'emp_1' })
    openPopover()
    fireEvent.click(within(document.body).getByText('Сотрудник…'))
    // emp_1 is excluded, emp_3 is terminated — only emp_2 shown
    expect(within(document.body).getByText('Мария Петрова')).toBeInTheDocument()
    expect(within(document.body).queryByText('Иван Иванов')).toBeNull()
    expect(within(document.body).queryByText('Архивный Архивов')).toBeNull()
  })

  it('calls onChange with employee kind on selection', () => {
    const { onChange } = renderPicker({ currentEmpId: 'emp_1' })
    openPopover()
    fireEvent.click(within(document.body).getByText('Сотрудник…'))
    fireEvent.click(within(document.body).getByText('Мария Петрова'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'employee', id: 'emp_2', label: 'Мария Петрова' })
  })
})

describe('DestPicker — department sub-picker', () => {
  it('lists departments from props', () => {
    renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Отдел…'))
    expect(within(document.body).getByText('IT')).toBeInTheDocument()
    expect(within(document.body).getByText('HR')).toBeInTheDocument()
  })

  it('calls onChange with department kind on selection', () => {
    const { onChange } = renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Отдел…'))
    fireEvent.click(within(document.body).getByText('IT'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'department', id: 'dep_1', label: 'IT' })
  })
})

describe('DestPicker — branch sub-picker', () => {
  it('lists branches from props', () => {
    renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Филиал…'))
    expect(within(document.body).getByText('Головной офис')).toBeInTheDocument()
    expect(within(document.body).getByText('Филиал Ереван')).toBeInTheDocument()
  })

  it('calls onChange with branch kind on selection', () => {
    const { onChange } = renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Филиал…'))
    fireEvent.click(within(document.body).getByText('Головной офис'))
    expect(onChange).toHaveBeenCalledWith({ kind: 'branch', id: 'br_1', label: 'Головной офис' })
  })
})

describe('DestPicker — back navigation', () => {
  it('going back from sub-picker shows top options again', () => {
    renderPicker()
    openPopover()
    fireEvent.click(within(document.body).getByText('Сотрудник…'))
    // Click back button
    const backBtn = within(document.body).getByRole('button', { name: /назад/i })
    fireEvent.click(backBtn)
    // After going back, top options are shown (Склад may appear multiple times — chip + option)
    const skladEls = within(document.body).getAllByText('Склад')
    expect(skladEls.length).toBeGreaterThanOrEqual(1)
    // Confirm we're back at top level by checking 'Сотрудник…' is visible
    expect(within(document.body).getByText('Сотрудник…')).toBeInTheDocument()
  })
})
