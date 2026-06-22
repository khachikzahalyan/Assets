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
]

// ── Render helpers ─────────────────────────────────────────────────────────────

function renderDrawer(overrides: Partial<EmployeeDetailDrawerProps> = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  const onArchive = overrides.onArchive ?? vi.fn()
  const onRestore = overrides.onRestore ?? vi.fn()
  const onLinkAssets = overrides.onLinkAssets ?? vi.fn()

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
      />
    </I18nextProvider>,
  )

  return { onClose, onArchive, onRestore, onLinkAssets }
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
    expect(screen.getByText('2')).toBeInTheDocument()
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
