/**
 * EmployeeDetailDrawer unit tests.
 *
 * Uses real i18n (ru locale) via I18nextProvider so translated strings are
 * asserted rather than keys.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer'
import type { DrawerLinkedAsset, EmployeeDetailDrawerProps } from './EmployeeDetailDrawer'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTIVE_EMP: EmployeeDetailDrawerProps['emp'] = {
  id: 'emp_1',
  firstName: 'Иван',
  lastName: 'Иванов',
  email: 'ivan@company.am',
  phone: '094908978',
  position: 'Менеджер',
  departmentId: 'dep_it',
  branchId: 'br_main',
  status: 'active',
  createdAt: '2025-01-15T10:00:00Z',
}

const TERMINATED_EMP: EmployeeDetailDrawerProps['emp'] = {
  ...ACTIVE_EMP,
  id: 'emp_2',
  status: 'terminated',
}

const LINKED_ASSETS: DrawerLinkedAsset[] = [
  {
    id: 'asset_1',
    icon: 'laptop',
    title: 'MacBook Pro 14"',
    invCode: 'COMP/001',
    cat: 'Компьютер',
    transferredAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'asset_2',
    icon: 'monitor',
    title: 'Dell Monitor 27"',
    invCode: 'MON/042',
    cat: 'Монитор',
    transferredAt: '2025-05-10T08:00:00Z',
  },
  {
    id: 'asset_3',
    icon: 'smartphone',
    title: 'iPhone 14',
    invCode: 'PHONE/007',
    cat: 'Телефон',
    transferredAt: '2025-04-20T09:00:00Z',
  },
]

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderDrawer(overrides: Partial<EmployeeDetailDrawerProps> = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onArchive = overrides.onArchive ?? vi.fn()
  const onRestore = overrides.onRestore ?? vi.fn()
  const onLinkAssets = overrides.onLinkAssets ?? vi.fn()
  const onTransferAssets = overrides.onTransferAssets ?? vi.fn()

  render(
    <I18nextProvider i18n={i18n}>
      <EmployeeDetailDrawer
        open={overrides.open ?? true}
        emp={overrides.emp ?? ACTIVE_EMP}
        branchName={overrides.branchName ?? 'Головной офис'}
        departmentName={overrides.departmentName ?? 'IT'}
        linkedAssets={overrides.linkedAssets ?? []}
        onClose={onClose}
        onArchive={onArchive}
        onRestore={onRestore}
        onLinkAssets={onLinkAssets}
        employees={overrides.employees ?? [{ id: 'e2', name: 'Борис Сидоров', status: 'active' }]}
        departments={overrides.departments ?? [{ id: 'dep_it', name: 'ИТ' }]}
        branches={overrides.branches ?? [{ id: 'br_2', name: 'Филиал 2' }]}
        onTransferAssets={onTransferAssets}
      />
    </I18nextProvider>,
  )

  return { onClose, onArchive, onRestore, onLinkAssets, onTransferAssets }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmployeeDetailDrawer — basic rendering', () => {
  it('renders employee name', () => {
    renderDrawer()
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
  })

  it('renders branch name', () => {
    renderDrawer()
    expect(screen.getByText('Головной офис')).toBeInTheDocument()
  })

  it('renders department name', () => {
    renderDrawer()
    expect(screen.getByText(/IT/)).toBeInTheDocument()
  })

  it('renders formatted phone', () => {
    renderDrawer()
    // 094908978 → "094 90 89 78"
    expect(screen.getByText('094 90 89 78')).toBeInTheDocument()
  })

  it('renders nothing when emp is null', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <EmployeeDetailDrawer
          open
          emp={null}
          branchName=""
          departmentName=""
          linkedAssets={[]}
          onClose={vi.fn()}
          onArchive={vi.fn()}
          onRestore={vi.fn()}
          onLinkAssets={vi.fn()}
          employees={[]}
          departments={[]}
          branches={[]}
          onTransferAssets={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('EmployeeDetailDrawer — active employee', () => {
  it('shows "Сдача техники" footer button for active employee', () => {
    renderDrawer({ emp: ACTIVE_EMP })
    expect(screen.getByRole('button', { name: /Сдача техники/i })).toBeInTheDocument()
  })

  it('shows "Привязать актив" section button for active employee', () => {
    renderDrawer({ emp: ACTIVE_EMP })
    expect(screen.getByRole('button', { name: /Привязать актив/i })).toBeInTheDocument()
  })

  it('does NOT show "Восстановить" for active employee', () => {
    renderDrawer({ emp: ACTIVE_EMP })
    expect(screen.queryByRole('button', { name: /^Восстановить$/i })).toBeNull()
  })
})

describe('EmployeeDetailDrawer — terminated employee', () => {
  it('shows "Восстановить" footer button for terminated employee', () => {
    renderDrawer({ emp: TERMINATED_EMP })
    expect(screen.getByRole('button', { name: /Восстановить/i })).toBeInTheDocument()
  })

  it('does NOT show "Привязать актив" for terminated employee', () => {
    renderDrawer({ emp: TERMINATED_EMP })
    expect(screen.queryByRole('button', { name: /Привязать актив/i })).toBeNull()
  })

  it('does NOT show "Сдача техники" for terminated employee', () => {
    renderDrawer({ emp: TERMINATED_EMP })
    expect(screen.queryByRole('button', { name: /Сдача техники/i })).toBeNull()
  })
})

describe('EmployeeDetailDrawer — linked assets', () => {
  it('renders linked asset title and invCode', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    expect(screen.getByText('MacBook Pro 14"')).toBeInTheDocument()
    expect(screen.getByText('COMP/001')).toBeInTheDocument()
    expect(screen.getByText('Dell Monitor 27"')).toBeInTheDocument()
    expect(screen.getByText('MON/042')).toBeInTheDocument()
  })

  it('shows empty state text when no linked assets', () => {
    renderDrawer({ linkedAssets: [] })
    expect(screen.getByText(/Нет закреплённых активов/i)).toBeInTheDocument()
  })

  it('shows the count of linked assets', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('EmployeeDetailDrawer — callbacks', () => {
  it('calls onArchive(id) when Сдача техники is clicked', () => {
    const { onArchive } = renderDrawer({ emp: ACTIVE_EMP })
    fireEvent.click(screen.getByRole('button', { name: /Сдача техники/i }))
    expect(onArchive).toHaveBeenCalledWith('emp_1')
  })

  it('calls onLinkAssets(id) when Привязать актив is clicked', () => {
    const { onLinkAssets } = renderDrawer({ emp: ACTIVE_EMP })
    fireEvent.click(screen.getByRole('button', { name: /Привязать актив/i }))
    expect(onLinkAssets).toHaveBeenCalledWith('emp_1')
  })

  it('calls onRestore(id) when Восстановить is clicked for terminated emp', () => {
    const { onRestore } = renderDrawer({ emp: TERMINATED_EMP })
    fireEvent.click(screen.getByRole('button', { name: /Восстановить/i }))
    expect(onRestore).toHaveBeenCalledWith('emp_2')
  })

  it('calls onClose when X button is clicked', () => {
    const { onClose } = renderDrawer()
    fireEvent.click(screen.getByRole('button', { name: /Закрыть/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── Transfer / multi-select tests ─────────────────────────────────────────────

describe('EmployeeDetailDrawer — multi-select transfer flow', () => {
  it('1. no checkboxes before entering select mode', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    // The asset rows should not be present (they are plain <li>s) — no aria-pressed
    expect(document.querySelectorAll('[aria-pressed]')).toHaveLength(0)
  })

  it('2. clicking Выбрать enters select mode — rows get aria-pressed', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    // Each asset row should now have aria-pressed
    const pressedEls = document.querySelectorAll('[aria-pressed]')
    expect(pressedEls.length).toBe(3)
  })

  it('3. Выбрать все selects all rows; count shows 3', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    fireEvent.click(screen.getByRole('button', { name: /Выбрать все/i }))
    expect(screen.getByText(/Выбрано: 3/)).toBeInTheDocument()
  })

  it('4. with ≥1 selected, transfer bar shows DestPicker chip (Склад) and Передать button', () => {
    renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    // Select first asset by clicking first aria-pressed element
    const rows = Array.from(document.querySelectorAll('[aria-pressed]'))
    fireEvent.click(rows[0] as Element)
    // Transfer bar should appear
    expect(screen.getByText(/Склад/)).toBeInTheDocument()
    // Передать button
    expect(screen.getByRole('button', { name: /^Передать$/i })).toBeInTheDocument()
  })

  it('5. clicking Передать shows confirm; confirming calls onTransferAssets once with all 3 ids and {kind:warehouse}', () => {
    const { onTransferAssets } = renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    // Select all
    fireEvent.click(screen.getByRole('button', { name: /Выбрать все/i }))
    // Click transfer action
    fireEvent.click(screen.getByRole('button', { name: /^Передать$/i }))
    // Confirm title should appear
    expect(screen.getByText(/Передать 3 → Склад/i)).toBeInTheDocument()
    // Click the confirm button (last one in the list — the one inside confirm row)
    const confirmBtn = screen.getAllByRole('button', { name: /^Передать$/i })
    fireEvent.click(confirmBtn[confirmBtn.length - 1] as HTMLElement)
    expect(onTransferAssets).toHaveBeenCalledTimes(1)
    expect(onTransferAssets).toHaveBeenCalledWith(
      expect.arrayContaining(['asset_1', 'asset_2', 'asset_3']),
      { kind: 'warehouse' },
    )
  })

  it('6. after confirming, select mode exits — no aria-pressed elements, no transfer bar', () => {
    const { onTransferAssets } = renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    fireEvent.click(screen.getByRole('button', { name: /Выбрать все/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Передать$/i }))
    // click confirm
    const confirmBtns = screen.getAllByRole('button', { name: /^Передать$/i })
    fireEvent.click(confirmBtns[confirmBtns.length - 1] as HTMLElement)
    expect(onTransferAssets).toHaveBeenCalledTimes(1)
    // select mode should be gone
    expect(document.querySelectorAll('[aria-pressed]')).toHaveLength(0)
    // transfer bar gone — no "Выбрано:" text
    expect(screen.queryByText(/Выбрано:/)).toBeNull()
  })

  it('7. clicking Готово in select mode exits without calling onTransferAssets', () => {
    const { onTransferAssets } = renderDrawer({ linkedAssets: LINKED_ASSETS })
    fireEvent.click(screen.getByRole('button', { name: /Выбрать/i }))
    // Select one asset
    const rows = Array.from(document.querySelectorAll('[aria-pressed]'))
    fireEvent.click(rows[0] as Element)
    // Now toggle button says "Готово"
    fireEvent.click(screen.getByRole('button', { name: /Готово/i }))
    // onTransferAssets NOT called
    expect(onTransferAssets).not.toHaveBeenCalled()
    // no aria-pressed elements remain
    expect(document.querySelectorAll('[aria-pressed]')).toHaveLength(0)
  })
})
