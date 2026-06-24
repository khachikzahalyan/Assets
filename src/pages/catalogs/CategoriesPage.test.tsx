import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { CategoriesPage } from './CategoriesPage'
import { InMemoryCategoryRepository } from '@/infra/repositories'
import type { Category } from '@/domain/category'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }) }))
const seed = (): Category[] => [
  { id: 'c1', name: 'Laptop', group: 'devices', prefix: '450', hasSpecs: true, lucideIcon: 'laptop', createdAt: 't', updatedAt: 't' },
]

describe('CategoriesPage', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders categories with name + prefix', async () => {
    render(<MemoryRouter><CategoriesPage repository={new InMemoryCategoryRepository(seed())} /></MemoryRouter>)
    expect(await screen.findByText('Laptop')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
  })
  it('creates a category via the modal', async () => {
    const data = seed()
    render(<MemoryRouter><CategoriesPage repository={new InMemoryCategoryRepository(data)} /></MemoryRouter>)
    await screen.findByText('Laptop')
    fireEvent.click(screen.getByText(/Добавить категорию|Add category|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Server' } })   // name
    fireEvent.change(inputs[1]!, { target: { value: '500' } })       // prefix (inputs[1] is prefix; lucideIcon is inputs[2])
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(data.some(c => c.name === 'Server' && c.prefix === '500')).toBe(true))
  })
  it('disables the prefix input when editing a referenced category', async () => {
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] })
    render(<MemoryRouter><CategoriesPage repository={repo} /></MemoryRouter>)
    await screen.findByText('Laptop')
    // open edit on the row (click the edit IconBtn — by title)
    fireEvent.click(screen.getByTitle(/Изменить|Edit|Խմբագրել/))
    // prefix input should be disabled
    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      // find the disabled one (the prefix)
      expect(inputs.some(i => i.disabled)).toBe(true)
    })
  })
})
