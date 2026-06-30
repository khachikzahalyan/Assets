import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { CategoriesPage } from './CategoriesPage'
import { InMemoryCategoryRepository, InMemoryCategoryGroupRepository } from '@/infra/repositories'
import type { Category, CategoryGroup } from '@/domain/category'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }),
}))

// ── Seed data ────────────────────────────────────────────────────────────────

const BASE_GROUPS: CategoryGroup[] = [
  {
    id: 'devices', name: 'Устройства', behavior: 'devices',
    lucideIcon: 'laptop', color: 'blue', order: 0, createdAt: 't', updatedAt: 't',
  },
  {
    id: 'network', name: 'Сетевые', behavior: 'network',
    lucideIcon: 'wifi', color: 'green', order: 1, createdAt: 't', updatedAt: 't',
  },
]

const BASE_CATS: Category[] = [
  {
    id: 'c1', name: 'Laptop', group: 'devices', categoryGroupId: 'devices',
    hasSpecs: true, lucideIcon: 'laptop', createdAt: 't', updatedAt: 't',
  },
  {
    id: 'c2', name: 'Router', group: 'network', categoryGroupId: 'network',
    hasSpecs: false, lucideIcon: 'wifi', createdAt: 't', updatedAt: 't',
  },
]

function makeRepos(
  cats: Category[] = BASE_CATS,
  groups: CategoryGroup[] = BASE_GROUPS,
  catRefs?: { assets?: { categoryId: string }[] },
  groupRefs?: { categories?: { categoryGroupId?: string }[] },
) {
  return {
    catRepo:   new InMemoryCategoryRepository([...cats], catRefs),
    groupRepo: new InMemoryCategoryGroupRepository([...groups], groupRefs),
  }
}

describe('CategoriesPage', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Chips ─────────────────────────────────────────────────────────────────

  it('renders group chips for each CategoryGroup', async () => {
    const { catRepo, groupRepo } = makeRepos()
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    expect(await screen.findByText('Устройства')).toBeInTheDocument()
    expect(screen.getByText('Сетевые')).toBeInTheDocument()
  })

  it('shows subcategories of the default (first) group initially', async () => {
    const { catRepo, groupRepo } = makeRepos()
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    expect(await screen.findByText('Laptop')).toBeInTheDocument()
    expect(screen.queryByText('Router')).not.toBeInTheDocument()
  })

  // ── Chip filtering ────────────────────────────────────────────────────────

  it('selecting a chip filters the table to that group', async () => {
    const { catRepo, groupRepo } = makeRepos()
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    await screen.findByText('Laptop')
    fireEvent.click(screen.getByText('Сетевые'))
    await waitFor(() => expect(screen.queryByText('Laptop')).not.toBeInTheDocument())
    expect(screen.getByText('Router')).toBeInTheDocument()
  })

  // ── Create subcategory ────────────────────────────────────────────────────

  it('+ Добавить подкатегорию creates a subcategory under the selected group', async () => {
    const cats: Category[] = []
    const catRepo   = new InMemoryCategoryRepository(cats)
    const groupRepo = new InMemoryCategoryGroupRepository([...BASE_GROUPS])
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    // Wait for groups to load (chip appears even though table is empty)
    await screen.findByText('Устройства')
    fireEvent.click(screen.getByText(/Добавить подкатегорию|Add subcategory|Ավելացնել ենթ/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Desktop' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => {
      const created = cats.find(c => c.name === 'Desktop')
      expect(created).toBeDefined()
      expect(created?.categoryGroupId).toBe('devices')
      expect(created?.group).toBe('devices')
    })
  })

  // ── Create group ──────────────────────────────────────────────────────────

  it('+ Добавить категорию (add chip) opens group dialog and creates a group', async () => {
    const groups: CategoryGroup[] = [...BASE_GROUPS]
    const groupRepo = new InMemoryCategoryGroupRepository(groups)
    const catRepo   = new InMemoryCategoryRepository([...BASE_CATS])
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    await screen.findByText('Устройства')
    // Click the trailing dashed "add category" chip
    fireEvent.click(screen.getByText(/Добавить категорию|Add category|Ավелац/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Серверы' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    await waitFor(() => expect(groups.some(g => g.name === 'Серверы')).toBe(true))
  })

  // ── Group delete guard ────────────────────────────────────────────────────

  it('blocks deleting a group that still has subcategories', async () => {
    const { catRepo } = makeRepos()
    // Pass categories as refs so groupRepo.countReferences('devices') → 1
    const groupRepo = new InMemoryCategoryGroupRepository(
      [...BASE_GROUPS],
      { categories: BASE_CATS },
    )
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    await screen.findByText('Устройства')
    // 'devices' chip is selected by default, so its delete button is visible
    fireEvent.click(screen.getByTestId('group-delete-devices'))
    await waitFor(() =>
      expect(
        screen.getByText(/В категории есть подкатегории|Category has subcategories/),
      ).toBeInTheDocument(),
    )
  })

  // ── Subcategory delete guard ──────────────────────────────────────────────

  it('blocks deleting an in-use subcategory', async () => {
    const catRepo   = new InMemoryCategoryRepository([...BASE_CATS], { assets: [{ categoryId: 'c1' }] })
    const groupRepo = new InMemoryCategoryGroupRepository([...BASE_GROUPS])
    render(<MemoryRouter><CategoriesPage repository={catRepo} categoryGroupRepository={groupRepo} /></MemoryRouter>)
    await screen.findByText('Laptop')
    fireEvent.click(screen.getByTitle(/Удалить|Delete|Ջնջել/))
    await waitFor(() =>
      expect(screen.getByText(/Нельзя удалить|Cannot delete|Հнарар чэ/)).toBeInTheDocument(),
    )
  })
})
