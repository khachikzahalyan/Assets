/**
 * EmployeeRow unit tests.
 *
 * (1) A terminated employee row renders the restore button and clicking it
 *     calls onRestore with the id WITHOUT calling onClick (stopPropagation).
 * (2) An active employee row does NOT render a restore button.
 * (3) The status chip text for terminated resolves under i18n 'ru'.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeRow } from './EmployeeRow'
import type { Employee } from '@/domain/employee'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function makeEmp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1',
    firstName: 'Иван',
    lastName: 'Петров',
    email: 'ivan@x.com',
    phone: null,
    position: 'Инженер',
    branchId: 'br_1',
    departmentId: 'dept_1',
    status: 'active',
    terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function renderRow(emp: Employee, onRestore?: (id: string) => void, onClick = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EmployeeRow
        employee={emp}
        branchName="Головной офис"
        isHeadOffice={true}
        deptName="IT"
        assetCount={2}
        onClick={onClick}
        onRestore={onRestore}
      />
    </I18nextProvider>,
  )
}

describe('EmployeeRow', () => {
  it('(1) terminated row renders restore button; click calls onRestore with id, not onClick', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn()
    const onClick = vi.fn()

    renderRow(makeEmp({ status: 'terminated' }), onRestore, onClick)

    // Should find the restore button by its title (Восстановить)
    const restoreBtn = screen.getByTitle('Восстановить')
    expect(restoreBtn).toBeInTheDocument()

    await user.click(restoreBtn)

    expect(onRestore).toHaveBeenCalledOnce()
    expect(onRestore).toHaveBeenCalledWith('emp_1')
    // onClick must NOT be called (stopPropagation)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('(2) active employee row does NOT render a restore button', () => {
    const onRestore = vi.fn()
    renderRow(makeEmp({ status: 'active' }), onRestore)

    expect(screen.queryByTitle('Восстановить')).toBeNull()
  })

  it('(2) terminated row without onRestore prop does NOT render a restore button', () => {
    renderRow(makeEmp({ status: 'terminated' }))
    expect(screen.queryByTitle('Восстановить')).toBeNull()
  })

  it('(3) status chip text for terminated resolves to "Уволен" in ru locale', () => {
    renderRow(makeEmp({ status: 'terminated' }))
    expect(screen.getByText('Уволен')).toBeInTheDocument()
  })

  it('(3) status chip text for active resolves to "Активен" in ru locale', () => {
    renderRow(makeEmp({ status: 'active' }))
    expect(screen.getByText('Активен')).toBeInTheDocument()
  })
})
