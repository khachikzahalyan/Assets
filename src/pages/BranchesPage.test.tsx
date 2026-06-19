import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { BranchesPage } from './BranchesPage'
import { InMemoryBranchRepository } from '@/infra/repositories'
import type { Branch } from '@/domain/branch'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }),
}))

function seed(): Branch[] {
  return [{ id: 'b1', name: 'Main Office', type: 'branch', city: 'Yerevan', address: null, createdAt: 't', updatedAt: 't' }]
}

describe('BranchesPage', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders branches from the injected repo', async () => {
    const repo = new InMemoryBranchRepository(seed())
    render(<MemoryRouter><BranchesPage repository={repo} /></MemoryRouter>)
    expect(await screen.findByText('Main Office')).toBeInTheDocument()
  })
  it('creates a branch via the modal', async () => {
    const data = seed()
    const repo = new InMemoryBranchRepository(data)
    render(<MemoryRouter><BranchesPage repository={repo} /></MemoryRouter>)
    await screen.findByText('Main Office')
    fireEvent.click(screen.getByText(/Добавить филиал|Add branch|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'North' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(data.some(b => b.name === 'North')).toBe(true))
  })
})
