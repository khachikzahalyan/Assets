/**
 * EmployeesFilterBar unit tests.
 *
 * Assertions:
 * (a) Renders 4 SelectMini triggers (Отдел/Филиал/Статус/Сорт.) with no search input.
 * (b) Сбросить is NOT shown when query is at defaults (status:'active').
 * (c) Сбросить IS shown when status:'all'.
 * (d) Clicking Сбросить fires onChange with the full reset payload.
 * (e) onChange fires when a SelectMini option is selected.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeesFilterBar } from './EmployeesFilterBar'
import type { EmployeeListQuery } from '@/domain/employee'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const DEFAULT_QUERY: EmployeeListQuery = {
  status: 'active',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

const BRANCHES = [
  { id: 'branch-head', name: 'Головной офис' },
  { id: 'branch-yer',  name: 'Ереван' },
]

const DEPARTMENTS = [
  { id: 'dept-it',  name: 'IT' },
  { id: 'dept-hr',  name: 'HR' },
]

function renderBar(
  query: EmployeeListQuery = DEFAULT_QUERY,
  onChange = vi.fn(),
) {
  return {
    onChange,
    ...render(
      <I18nextProvider i18n={i18n}>
        <EmployeesFilterBar
          query={query}
          onChange={onChange}
          branches={BRANCHES}
          departments={DEPARTMENTS}
          headOfficeBranchId="branch-head"
        />
      </I18nextProvider>,
    ),
  }
}

describe('EmployeesFilterBar', () => {
  // ── (a) 4 SelectMini triggers rendered, no search input ─────────────────

  it('(a) renders exactly 4 SelectMini trigger buttons (Отдел, Филиал, Статус, Сорт.)', () => {
    renderBar()

    // Each SelectMini renders a button with aria-haspopup="listbox"
    const triggers = screen.getAllByRole('button', { hidden: false })
    // All 4 triggers + potentially 0 Сбросить (dirty=false at defaults)
    // We identify SelectMini triggers by aria-haspopup attribute
    const selectTriggers = triggers.filter(
      btn => btn.getAttribute('aria-haspopup') === 'listbox',
    )
    expect(selectTriggers).toHaveLength(4)
  })

  it('(a) renders the Отдел trigger button', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Отдел' })).toBeInTheDocument()
  })

  it('(a) renders the Филиал trigger button', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Филиал' })).toBeInTheDocument()
  })

  it('(a) renders the Статус trigger button', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Статус' })).toBeInTheDocument()
  })

  it('(a) renders the Сорт. trigger button', () => {
    renderBar()
    expect(screen.getByRole('button', { name: 'Сорт.' })).toBeInTheDocument()
  })

  it('(a) does NOT render a search input', () => {
    renderBar()
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(document.getElementById('employees-search')).toBeNull()
  })

  // ── (b) Сбросить hidden at defaults (status:'active') ───────────────────

  it('(b) Сбросить is NOT shown when query is at defaults (status:active)', () => {
    renderBar(DEFAULT_QUERY)
    // Only SelectMini triggers (aria-haspopup=listbox) should be present — no plain reset button
    const allButtons = screen.getAllByRole('button')
    const resetBtn = allButtons.find(btn => btn.textContent?.includes('Сбросить'))
    expect(resetBtn).toBeUndefined()
  })

  // ── (c) Сбросить shown when status:'all' (dirty) ─────────────────────────

  it('(c) Сбросить IS shown when status is "all"', () => {
    renderBar({ ...DEFAULT_QUERY, status: 'all' })
    const allButtons = screen.getAllByRole('button')
    const resetBtn = allButtons.find(btn => btn.textContent?.includes('Сбросить'))
    expect(resetBtn).toBeDefined()
    expect(resetBtn).toBeInTheDocument()
  })

  it('(c) Сбросить IS shown when branchId is not "all"', () => {
    renderBar({ ...DEFAULT_QUERY, branchId: 'branch-head' })
    const allButtons = screen.getAllByRole('button')
    const resetBtn = allButtons.find(btn => btn.textContent?.includes('Сбросить'))
    expect(resetBtn).toBeDefined()
  })

  it('(c) Сбросить IS shown when sort is not "updated_desc"', () => {
    renderBar({ ...DEFAULT_QUERY, sort: 'name_asc' })
    const allButtons = screen.getAllByRole('button')
    const resetBtn = allButtons.find(btn => btn.textContent?.includes('Сбросить'))
    expect(resetBtn).toBeDefined()
  })

  // ── (d) Clicking Сбросить fires onChange with reset payload ─────────────

  it('(d) clicking Сбросить calls onChange with the full reset payload', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ ...DEFAULT_QUERY, status: 'all', branchId: 'branch-yer' })

    const allButtons = screen.getAllByRole('button')
    const resetBtn = allButtons.find(btn => btn.textContent?.includes('Сбросить'))!
    await user.click(resetBtn)

    expect(onChange).toHaveBeenCalledWith({
      status: 'active',
      branchId: 'all',
      departmentId: 'all',
      search: '',
      sort: 'updated_desc',
    })
  })

  // ── (e) onChange fires when a SelectMini option is selected ─────────────

  it('(e) selecting "Все" in the Статус SelectMini fires onChange({ status:"all" })', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar(DEFAULT_QUERY)

    // Open the Статус select
    const statusTrigger = screen.getByRole('button', { name: 'Статус' })
    await user.click(statusTrigger)

    // Find the listbox and click the "Все" option
    const listbox = screen.getByRole('listbox')
    const allOption = within(listbox).getByRole('option', { name: /Все/i })
    await user.click(allOption)

    expect(onChange).toHaveBeenCalledWith({ status: 'all' })
  })

  it('(e) selecting a department fires onChange({ departmentId })', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar(DEFAULT_QUERY)

    const deptTrigger = screen.getByRole('button', { name: 'Отдел' })
    await user.click(deptTrigger)

    const listbox = screen.getByRole('listbox')
    const itOption = within(listbox).getByRole('option', { name: 'IT' })
    await user.click(itOption)

    expect(onChange).toHaveBeenCalledWith({ departmentId: 'dept-it' })
  })
})
