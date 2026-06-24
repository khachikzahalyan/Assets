import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { DepartmentsPage } from './DepartmentsPage'
import { InMemoryDepartmentRepository } from '@/infra/repositories'
import type { Department } from '@/domain/department'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }) }))
const seed = (): Department[] => [{ id: 'd1', name: 'IT', createdAt: 't', updatedAt: 't' }]

describe('DepartmentsPage (super_admin)', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders departments', async () => {
    render(<MemoryRouter><DepartmentsPage repository={new InMemoryDepartmentRepository(seed())} /></MemoryRouter>)
    expect(await screen.findByText('IT')).toBeInTheDocument()
  })
  it('creates a department via the modal', async () => {
    const data = seed()
    render(<MemoryRouter><DepartmentsPage repository={new InMemoryDepartmentRepository(data)} /></MemoryRouter>)
    await screen.findByText('IT')
    fireEvent.click(screen.getByText(/Добавить отдел|Add department|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Finance' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(data.some(d => d.name === 'Finance')).toBe(true))
  })
})
