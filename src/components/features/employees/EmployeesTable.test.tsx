/**
 * EmployeesTable unit tests.
 *
 * (1) Given 3 rows and default minRows=10, the desktop table renders 7
 *     placeholder rows (data-testid="emp-placeholder-row").
 * (2) Clicking a data row calls onRowClick with the employee.
 *
 * In jsdom, matchMedia is undefined so isMobile=false and the desktop
 * branch always renders — no mobile cards.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeesTable } from './EmployeesTable'
import type { Employee } from '@/domain/employee'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function makeEmp(id: string, over: Partial<Employee> = {}): Employee {
  return {
    id,
    firstName: 'Иван',
    lastName: `Петров${id}`,
    email: `${id}@x.com`,
    phone: null,
    position: 'Инженер',
    branchId: null,
    departmentId: null,
    status: 'active',
    terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const BRANCHES = [{ id: 'br_1', name: 'Головной офис' }]
const DEPARTMENTS = [{ id: 'dept_1', name: 'IT' }]

function renderTable(
  rows: Employee[],
  onRowClick = vi.fn(),
  minRows = 10,
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EmployeesTable
        rows={rows}
        branches={BRANCHES}
        departments={DEPARTMENTS}
        assetCounts={{}}
        headOfficeBranchId="br_1"
        onRowClick={onRowClick}
        minRows={minRows}
      />
    </I18nextProvider>,
  )
}

describe('EmployeesTable', () => {
  it('(1) renders 7 placeholder rows when given 3 data rows and minRows=10', () => {
    const rows = [
      makeEmp('e1'),
      makeEmp('e2'),
      makeEmp('e3'),
    ]
    renderTable(rows)

    const placeholders = screen.getAllByTestId('emp-placeholder-row')
    expect(placeholders).toHaveLength(7)
  })

  it('(1) renders 0 placeholder rows when data rows >= minRows', () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeEmp(`e${i}`))
    renderTable(rows)

    expect(screen.queryAllByTestId('emp-placeholder-row')).toHaveLength(0)
  })

  it('(2) clicking a data row calls onRowClick with that employee', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const emp = makeEmp('e1')
    renderTable([emp], onRowClick)

    // Click on the employee's name text to hit the row
    const nameEl = screen.getByText('Иван Петровe1')
    await user.click(nameEl)

    expect(onRowClick).toHaveBeenCalledOnce()
    expect(onRowClick).toHaveBeenCalledWith(emp)
  })
})
