/**
 * HandoverModal unit tests.
 * Portal renders to document.body — queries use within(document.body).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { HandoverModal } from './HandoverModal'
import type { HandoverModalProps, HandoverAsset } from './HandoverModal'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const EMP: HandoverModalProps['emp'] = {
  id: 'emp_1',
  firstName: 'Иван',
  lastName: 'Иванов',
  position: 'Менеджер',
  departmentName: 'IT',
}

const ASSETS: HandoverAsset[] = [
  { id: 'a1', icon: 'laptop', title: 'MacBook Pro', invCode: 'COMP/001', sn: 'SN001' },
  { id: 'a2', icon: 'monitor', title: 'Dell Monitor', invCode: 'MON/001', sn: 'SN002' },
]

const EMPLOYEES = [
  { id: 'emp_1', name: 'Иван Иванов', status: 'active' },
  { id: 'emp_2', name: 'Мария Петрова', status: 'active' },
]

const DEPARTMENTS = [{ id: 'dep_1', name: 'IT' }]
const BRANCHES = [{ id: 'br_1', name: 'Головной офис' }]

function renderModal(overrides: Partial<HandoverModalProps> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()
  const props: HandoverModalProps = {
    open: overrides.open ?? true,
    emp: overrides.emp !== undefined ? overrides.emp : EMP,
    assets: overrides.assets ?? ASSETS,
    employees: overrides.employees ?? EMPLOYEES,
    departments: overrides.departments ?? DEPARTMENTS,
    branches: overrides.branches ?? BRANCHES,
    onConfirm,
    onClose,
  }
  render(
    <I18nextProvider i18n={i18n}>
      <HandoverModal {...props} />
    </I18nextProvider>,
  )
  return { onConfirm, onClose }
}

describe('HandoverModal — renders', () => {
  it('renders the modal title', () => {
    renderModal()
    expect(within(document.body).getByText('Приёмка техники')).toBeInTheDocument()
  })

  it('renders employee name', () => {
    renderModal()
    expect(within(document.body).getByText(/Иван Иванов/)).toBeInTheDocument()
  })

  it('renders asset rows', () => {
    renderModal()
    expect(within(document.body).getByText('MacBook Pro')).toBeInTheDocument()
    expect(within(document.body).getByText('Dell Monitor')).toBeInTheDocument()
  })

  it('renders nothing when emp is null', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <HandoverModal
          open
          emp={null}
          assets={[]}
          employees={[]}
          departments={[]}
          branches={[]}
          onConfirm={vi.fn()}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('HandoverModal — step 1: receive', () => {
  it('"Далее" button is disabled when no rows are checked', () => {
    renderModal()
    const nextBtn = within(document.body).getByText('Далее').closest('button')
    expect(nextBtn).toBeDisabled()
  })

  it('"Далее" enabled after toggle-all checks all rows', () => {
    renderModal()
    const toggleAllBtn = within(document.body).getByText('Отметить все').closest('button')!
    fireEvent.click(toggleAllBtn)
    const nextBtn = within(document.body).getByText('Далее').closest('button')
    expect(nextBtn).not.toBeDisabled()
  })

  it('individually checking all rows enables Далее', () => {
    renderModal()
    const rows = within(document.body).getAllByRole('button', { name: /Отметить как принят/i })
    rows.forEach(r => fireEvent.click(r))
    const nextBtn = within(document.body).getByText('Далее').closest('button')
    expect(nextBtn).not.toBeDisabled()
  })

  it('toggle-all a second time unchecks all rows (снять все)', () => {
    renderModal()
    // Check all
    fireEvent.click(within(document.body).getByText('Отметить все').closest('button')!)
    // Uncheck all — button label changes
    fireEvent.click(within(document.body).getByText('Снять все').closest('button')!)
    const nextBtn = within(document.body).getByText('Далее').closest('button')
    expect(nextBtn).toBeDisabled()
  })
})

describe('HandoverModal — advancing to step 2', () => {
  function goToStep2() {
    renderModal()
    fireEvent.click(within(document.body).getByText('Отметить все').closest('button')!)
    fireEvent.click(within(document.body).getByText('Далее').closest('button')!)
  }

  it('shows step 2 label after advancing', () => {
    goToStep2()
    expect(within(document.body).getByText(/Шаг 2 из 2/)).toBeInTheDocument()
  })

  it('shows "Завершить приёмку" button in step 2', () => {
    goToStep2()
    expect(within(document.body).getByText(/Завершить/)).toBeInTheDocument()
  })

  it('shows DestPicker chips (Склад) for each row in step 2', () => {
    goToStep2()
    // Both rows default to Склад destination
    const skladChips = within(document.body).getAllByText('Склад')
    expect(skladChips.length).toBeGreaterThanOrEqual(2)
  })
})

describe('HandoverModal — step 2: confirm', () => {
  it('calls onConfirm with correct rows shape on Завершить приёмку', () => {
    const onConfirm = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <HandoverModal
          open
          emp={EMP}
          assets={ASSETS}
          employees={EMPLOYEES}
          departments={DEPARTMENTS}
          branches={BRANCHES}
          onConfirm={onConfirm}
          onClose={vi.fn()}
        />
      </I18nextProvider>,
    )
    // Check all & advance
    const markAllBtn = within(document.body).getByText('Отметить все').closest('button')
    if (!markAllBtn) throw new Error('Mark all button not found')
    fireEvent.click(markAllBtn)
    const nextBtn = within(document.body).getByText('Далее').closest('button')
    if (!nextBtn) throw new Error('Next button not found')
    fireEvent.click(nextBtn)
    // Finish
    const finishBtn = within(document.body).getByText(/Завершить/).closest('button')
    if (!finishBtn) throw new Error('Finish button not found')
    fireEvent.click(finishBtn)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a1', received: true, destination: { kind: 'warehouse' } }),
      expect.objectContaining({ id: 'a2', received: true, destination: { kind: 'warehouse' } }),
    ])
  })
})

describe('HandoverModal — back navigation', () => {
  it('Назад button returns to step 1', () => {
    renderModal()
    fireEvent.click(within(document.body).getByText('Отметить все').closest('button')!)
    fireEvent.click(within(document.body).getByText('Далее').closest('button')!)
    // Now in step 2, click Назад
    fireEvent.click(within(document.body).getByText('Назад').closest('button')!)
    expect(within(document.body).getByText(/Шаг 1 из 2/)).toBeInTheDocument()
  })
})

describe('HandoverModal — cancel', () => {
  it('calls onClose when Отмена is clicked', () => {
    const { onClose } = renderModal()
    fireEvent.click(within(document.body).getByText('Отмена').closest('button')!)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
