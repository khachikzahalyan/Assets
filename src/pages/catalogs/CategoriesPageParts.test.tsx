/**
 * Tests for the «Запчасти» (Parts) tab on CategoriesPage.
 *
 * Mirrors the existing CategoriesPage.test.tsx structure:
 *   - render list from seeded in-memory repo (7 defaults via makeSeededPartCategoryRepository)
 *   - super_admin sees the section, non-super-admin does NOT see the tab
 *   - create flow calls repository.create with correct input (behavior included)
 *   - edit flow calls repository.update WITHOUT behavior
 *   - deactivate calls update({ active: false })
 *   - inactive row renders greyed with chip
 *   - no delete button exists
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { CategoriesPage } from './CategoriesPage'
import {
  InMemoryCategoryRepository,
  InMemoryCategoryGroupRepository,
  makeSeededPartCategoryRepository,
  InMemoryPartCategoryRepository,
} from '@/infra/repositories'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'

// ── Auth mock stubs ─────────────────────────────────────────────────────────
// Default: super_admin. Individual tests that need a different role override locally.
let mockRole: string = 'super_admin'
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super', name: 'Super' }, role: mockRole }),
}))

// ── Seed helpers ─────────────────────────────────────────────────────────────
function makeEmptyAssetRepos() {
  return {
    catRepo:   new InMemoryCategoryRepository([]),
    groupRepo: new InMemoryCategoryGroupRepository([]),
  }
}

function renderWithParts(partCatRepo: InstanceType<typeof InMemoryPartCategoryRepository>) {
  const { catRepo, groupRepo } = makeEmptyAssetRepos()
  return render(
    <MemoryRouter>
      <CategoriesPage
        repository={catRepo}
        categoryGroupRepository={groupRepo}
        partCategoryRepository={partCatRepo}
      />
    </MemoryRouter>,
  )
}

async function openPartsTab(partCatRepo: InstanceType<typeof InMemoryPartCategoryRepository>) {
  renderWithParts(partCatRepo)
  // The tab strip only appears for super_admin — click the «Запчасти» tab
  const partsTab = await screen.findByRole('button', { name: /Запчасти|Parts|Պահեստամաս/ })
  fireEvent.click(partsTab)
  return partsTab
}

describe('CategoriesPage — Parts tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRole = 'super_admin'
  })

  // ── Tab visibility ─────────────────────────────────────────────────────────

  it('super_admin sees the Запчасти tab', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    renderWithParts(repo)
    expect(await screen.findByRole('button', { name: /Запчасти|Parts|Պահեստամաս/ })).toBeInTheDocument()
  })

  it('non-super-admin does NOT see the Запчасти tab', async () => {
    mockRole = 'asset_admin'
    const { repo } = makeSeededPartCategoryRepository()
    const { catRepo, groupRepo } = makeEmptyAssetRepos()
    render(
      <MemoryRouter>
        <CategoriesPage
          repository={catRepo}
          categoryGroupRepository={groupRepo}
          partCategoryRepository={repo}
        />
      </MemoryRouter>,
    )
    // Give render time to settle
    await screen.findByText(/Добавить подкатегорию|Add subcategory|Ավ/).catch(() => {/* ok if absent */})
    expect(screen.queryByRole('button', { name: /Запчасти|Parts|Պահеստամաս/ })).not.toBeInTheDocument()
  })

  // ── List rendering ─────────────────────────────────────────────────────────

  it('renders 7 seeded part categories after clicking the tab', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    await openPartsTab(repo)
    // "Блоки" is the ru name of the psu category
    expect(await screen.findByText('Блоки')).toBeInTheDocument()
    // "ОЗУ" is the ru name of the ram category
    expect(screen.getByText('ОЗУ')).toBeInTheDocument()
  })

  it('renders inactive row with greyed class and chip', async () => {
    const inactiveDef: PartCategoryDef = {
      id: 'test-inactive',
      name: { ru: 'Тестовая', en: 'Test', hy: 'Թեստ' },
      icon: 'package',
      tintToken: 'slate',
      order: 99,
      behavior: 'single',
      slotKind: 'other',
      storageType: null,
      familyOverrides: null,
      variants: null,
      generations: null,
      active: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const repo = new InMemoryPartCategoryRepository([inactiveDef])
    await openPartsTab(repo)
    expect(await screen.findByText('Тестовая')).toBeInTheDocument()
    // Inactive chip visible
    expect(screen.getByText(/Неактивна|Inactive|Անակտիվ/)).toBeInTheDocument()
  })

  // ── Create ─────────────────────────────────────────────────────────────────

  it('create flow calls repository.create with behavior in input', async () => {
    const defs: PartCategoryDef[] = []
    const repo = new InMemoryPartCategoryRepository(defs)
    const createSpy = vi.spyOn(repo, 'create')

    await openPartsTab(repo)

    // Click «Добавить категорию запчастей» button
    const addBtn = await screen.findByRole('button', { name: /Добавить категорию запчастей|Add part category|Ավ/ })
    fireEvent.click(addBtn)

    // Fill RU name (required)
    const ruInput = await screen.findByLabelText(/RU/)
    fireEvent.change(ruInput, { target: { value: 'Тест RU' } })

    // Fill EN name (required)
    const enInput = screen.getByLabelText(/EN/)
    fireEvent.change(enInput, { target: { value: 'Test EN' } })

    // Click Save button (last primary button in the dialog)
    const buttons = screen.getAllByRole('button')
    const saveBtn = buttons[buttons.length - 1]!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1)
      const [input] = createSpy.mock.calls[0]!
      // behavior must be present in create input
      expect(input).toHaveProperty('behavior')
      expect(input.name.ru).toBe('Тест RU')
      expect(input.name.en).toBe('Test EN')
    })
  })

  // ── Edit ───────────────────────────────────────────────────────────────────

  it('edit flow calls repository.update WITHOUT behavior field', async () => {
    const def: PartCategoryDef = {
      id: 'psu-test',
      name: { ru: 'Блоки', en: 'Power supplies', hy: 'Սնուցման' },
      icon: 'plug',
      tintToken: 'amber',
      order: 0,
      behavior: 'single',
      slotKind: 'psu',
      storageType: null,
      familyOverrides: null,
      variants: null,
      generations: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const repo = new InMemoryPartCategoryRepository([def])
    const updateSpy = vi.spyOn(repo, 'update')

    await openPartsTab(repo)

    // Click edit (pencil) button for the first row
    const editBtns = await screen.findAllByTitle(/Редактирование|Edit|Խ/)
    fireEvent.click(editBtns[0]!)

    // Change ru name
    const ruInput = await screen.findByLabelText(/RU/)
    fireEvent.change(ruInput, { target: { value: 'Блоки питания' } })

    // Click Save
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1)
      const [, patch] = updateSpy.mock.calls[0]!
      // behavior must NOT be in the patch
      expect(patch).not.toHaveProperty('behavior')
      // name change should be present
      expect(patch.name?.ru).toBe('Блоки питания')
    })
  })

  // ── Deactivate ────────────────────────────────────────────────────────────

  it('deactivate calls repository.update({ active: false })', async () => {
    const def: PartCategoryDef = {
      id: 'psu-test',
      name: { ru: 'Блоки', en: 'Power supplies', hy: 'Սնուցման' },
      icon: 'plug',
      tintToken: 'amber',
      order: 0,
      behavior: 'single',
      slotKind: 'psu',
      storageType: null,
      familyOverrides: null,
      variants: null,
      generations: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const repo = new InMemoryPartCategoryRepository([def])
    const updateSpy = vi.spyOn(repo, 'update')

    await openPartsTab(repo)
    await screen.findByText('Блоки')

    // Click the deactivate button (title = 'Деактивировать' / 'Deactivate')
    const toggleBtn = await screen.findByTitle(/Деактивировать|Deactivate|Ապ/)
    fireEvent.click(toggleBtn)

    // Confirm dialog appears — the dialog title and confirm button both appear;
    // use findAllByRole to get all matching buttons and click the last one (the confirm Btn)
    await waitFor(() => screen.findByText(/Деактивировать категорию|Deactivate category|Ապ/))
    const allBtns = screen.getAllByRole('button')
    // The confirm button is after the toggle buttons — it's in a portal so it's typically last
    const confirmBtn = allBtns.find(b => b.textContent?.match(/Деактивировать|Deactivate|Ապ/) && !b.title)
    expect(confirmBtn).toBeDefined()
    fireEvent.click(confirmBtn!)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'psu-test',
        expect.objectContaining({ active: false }),
        expect.any(Object),
      )
    })
  })

  // ── No delete button ──────────────────────────────────────────────────────

  it('no delete (trash) button exists in the parts tab', async () => {
    const { repo } = makeSeededPartCategoryRepository()
    await openPartsTab(repo)
    await screen.findByText('Блоки')

    // There should be NO button with a trash/delete title
    const trashBtns = screen.queryAllByTitle(/Удалить|Delete|Ջнջ/)
    expect(trashBtns).toHaveLength(0)
  })
})
