import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { CategoriesPage } from './CategoriesPage'
import { InMemoryCategoryRepository } from '@/infra/repositories'
import type { Category } from '@/domain/category'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }) }))

const seed = (): Category[] => [
  { id: 'c1', name: 'Laptop', group: 'devices', hasSpecs: true, lucideIcon: 'laptop', createdAt: 't', updatedAt: 't' },
]

describe('CategoriesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders categories grouped by section — prefix column not shown', async () => {
    render(<MemoryRouter><CategoriesPage repository={new InMemoryCategoryRepository(seed())} /></MemoryRouter>)
    expect(await screen.findByText('Laptop')).toBeInTheDocument()
    // prefix is no longer a column; its value must not appear in the table
    expect(screen.queryByText('450')).not.toBeInTheDocument()
  })

  it('creates a category via the modal', async () => {
    const data = seed()
    render(<MemoryRouter><CategoriesPage repository={new InMemoryCategoryRepository(data)} /></MemoryRouter>)
    await screen.findByText('Laptop')
    fireEvent.click(screen.getByText(/Добавить категорию|Add category|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Server' } })   // name
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(data.some(c => c.name === 'Server')).toBe(true))
  })

  it('shows delete confirmation and blocks when category is in use', async () => {
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] })
    render(<MemoryRouter><CategoriesPage repository={repo} /></MemoryRouter>)
    await screen.findByText('Laptop')
    fireEvent.click(screen.getByTitle(/Удалить|Delete|Ջնջել/))
    await waitFor(() => expect(screen.getByText(/Нельзя удалить|Cannot delete|Հնարավոր չէ ջնջել/)).toBeInTheDocument())
  })
})
