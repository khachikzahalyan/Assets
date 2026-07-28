import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { DepartmentsPage } from './DepartmentsPage'
import type { DepartmentRepository } from '@/domain/department'
import type { EmployeeRepository } from '@/domain/employee'

// super_admin can mutate → the loading skeleton MUST include the employees track
// AND the 80px action track (regression guard: the employees column was omitted).
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_super', name: 'S' }, role: 'super_admin' }) }))

/** Repositories whose list() never resolves — keeps useCachedResource in loading=true. */
function pendingRepos() {
  const never = () => new Promise<never>(() => {})
  const deptRepo = { listDepartments: never } as unknown as DepartmentRepository
  const empRepo = { listEmployees: never } as unknown as EmployeeRepository
  return { deptRepo, empRepo }
}

describe('DepartmentsPage loading skeleton (super_admin)', () => {
  it('header grid has the 3-track template (name + employees + 80px action)', () => {
    const { deptRepo, empRepo } = pendingRepos()
    render(
      <MemoryRouter>
        <DepartmentsPage repository={deptRepo} employeeRepository={empRepo} />
      </MemoryRouter>,
    )
    const skeleton = screen.getByTestId('table-skeleton')
    const headerBand = skeleton.children[0] as HTMLElement
    // The employees column ('1fr') is present between the name and action tracks.
    expect(headerBand.style.gridTemplateColumns).toBe('minmax(160px,2fr) 1fr 80px')
  })
})
