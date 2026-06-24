import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { StatusesPage } from './StatusesPage'
import { InMemoryAssetStatusRepository } from '@/infra/repositories'
import type { AssetStatus } from '@/domain/asset_status'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }) }))
const seed = (): AssetStatus[] => [
  { id: 'st_warehouse', name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0, createdAt: 't', updatedAt: 't' },
  { id: 'st_custom_lost', name: 'Lost', color: 'amber', isFinal: true, isSystem: false, sortOrder: 4, createdAt: 't', updatedAt: 't' },
]

describe('StatusesPage', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders statuses', async () => {
    render(<MemoryRouter><StatusesPage repository={new InMemoryAssetStatusRepository(seed())} /></MemoryRouter>)
    expect(await screen.findByText('Warehouse')).toBeInTheDocument()
    expect(screen.getByText('Lost')).toBeInTheDocument()
  })
  it('shows delete only for non-system rows', async () => {
    render(<MemoryRouter><StatusesPage repository={new InMemoryAssetStatusRepository(seed())} /></MemoryRouter>)
    await screen.findByText('Warehouse')
    // one delete button total (only the custom row) — query by title
    const deletes = screen.queryAllByTitle(/Удалить|Delete|Ջնջել/)
    expect(deletes.length).toBe(1)
  })
  it('disables isFinal when editing a system status', async () => {
    render(<MemoryRouter><StatusesPage repository={new InMemoryAssetStatusRepository(seed())} /></MemoryRouter>)
    await screen.findByText('Warehouse')
    // click the first edit button (the system row is first)
    const edits = screen.getAllByTitle(/Изменить|Edit|Խմբագրել/)
    fireEvent.click(edits[0]!)
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement
      expect(checkbox.disabled).toBe(true)
    })
  })
  it('creates a status via the modal', async () => {
    const data = seed()
    render(<MemoryRouter><StatusesPage repository={new InMemoryAssetStatusRepository(data)} /></MemoryRouter>)
    await screen.findByText('Warehouse')
    fireEvent.click(screen.getByText(/Добавить статус|Add status|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'On Loan' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(data.some(s => s.name === 'On Loan' && s.isSystem === false)).toBe(true))
  })
})
