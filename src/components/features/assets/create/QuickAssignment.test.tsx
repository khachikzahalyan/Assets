import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { useState } from 'react'
import i18n from '@/lib/i18n'
import { QuickAssignment, type QAValue } from './QuickAssignment'
import type { EmployeeRow, StatusRow, RefRow } from '@/domain/asset'

beforeAll(async () => { await i18n.changeLanguage('ru') })

const STATUSES: StatusRow[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray' },
  { id: 'st_assigned', name: 'Выдано', color: 'green' },
]
const EMPLOYEES: EmployeeRow[] = [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }]
const DEPARTMENTS: RefRow[] = [{ id: 'd1', name: 'IT' }]
const BRANCHES: RefRow[] = [{ id: 'b_main', name: 'Головной офис' }, { id: 'b2', name: 'Филиал №2' }]

function Harness({ isLaptop = false, isNetwork = false }: { isLaptop?: boolean; isNetwork?: boolean }) {
  const [value, setValue] = useState<QAValue>({ picked: null, assignment: null })
  return (
    <I18nextProvider i18n={i18n}>
      <QuickAssignment
        value={value}
        onChange={setValue}
        employees={EMPLOYEES}
        departments={DEPARTMENTS}
        branches={BRANCHES}
        mainBranchId="b_main"
        statuses={STATUSES}
        isLaptop={isLaptop}
        isNetwork={isNetwork}
      />
      <div data-testid="val">{JSON.stringify(value)}</div>
    </I18nextProvider>
  )
}

describe('QuickAssignment', () => {
  it('warehouse → null assignment', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))
    const v = JSON.parse(screen.getByTestId('val').textContent!)
    expect(v.picked).toBe('warehouse')
    expect(v.assignment).toBeNull()
  })

  it('employee → assignment carries mode + employeeId', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /^Сотрудник$/i }))
    let v = JSON.parse(screen.getByTestId('val').textContent!)
    expect(v.picked).toBe('employee')
    expect(v.assignment.mode).toBe('employee')
  })

  it('network device shows only Warehouse + Employee modes', () => {
    render(<Harness isNetwork />)
    expect(screen.getByRole('button', { name: /Склад/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Сотрудник$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Филиал$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Отдел$/i })).toBeNull()
  })

  it('laptop shows the work-mode toggle once an employee mode is picked', () => {
    render(<Harness isLaptop />)
    fireEvent.click(screen.getByRole('button', { name: /^Сотрудник$/i }))
    expect(screen.getByRole('button', { name: /Основной/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Удалённый/i })).toBeTruthy()
    // Default work mode is office; switching to remote updates the assignment.
    fireEvent.click(screen.getByRole('button', { name: /Удалённый/i }))
    const v = JSON.parse(screen.getByTestId('val').textContent!)
    expect(v.assignment.workMode).toBe('remote')
  })

  it('non-laptop does NOT show a work-mode toggle for employee', () => {
    render(<Harness isLaptop={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^Сотрудник$/i }))
    expect(screen.queryByRole('button', { name: /Удалённый/i })).toBeNull()
  })
})
