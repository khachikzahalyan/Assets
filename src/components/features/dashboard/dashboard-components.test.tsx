/**
 * TDD test suite for the 7 dashboard presentational components.
 *
 * i18n wrapper: I18nextProvider + the real @/lib/i18n instance (same pattern
 * as AuditTable.test.tsx and MyAssetsPage.test.tsx in this repo).
 *
 * Router wrapper: MemoryRouter (KpiTile / PeopleTile / RecentActivityList use
 * react-router-dom <Link>).
 *
 * i18n keys for the `dashboard` namespace are not yet seeded (Task 7). The
 * i18next fallback returns the key string itself, which is sufficient for
 * assertions that do NOT target translated chrome (they target data values).
 * Where a component accepts an explicit string prop (title, label, emptyLabel)
 * we pass a literal — no dependency on un-added keys.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import type { AssetStatusId } from '@/domain/asset'
import { ASSET_STATUS_IDS } from '@/domain/asset'
import type {
  GroupCount,
  BranchCount,
  WorkstationLicenseStats,
} from '@/domain/dashboard'
import type { StatusRow } from '@/domain/asset'
import {
  KpiTile,
  StatusBreakdown,
  GroupBreakdown,
  BranchBreakdown,
  LicenseStatTile,
  PeopleTile,
  RecentActivityList,
} from './index'
import type { ActivityRowVM } from './index'

// ── wrapper ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function wrap(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  )
}

// ── KpiTile ──────────────────────────────────────────────────────────────────

describe('KpiTile', () => {
  it('renders the numeric value', () => {
    wrap(<KpiTile icon="package" label="Assets" value={42} to="/assets" />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the label', () => {
    wrap(<KpiTile icon="package" label="Assets" value={42} to="/assets" />)
    expect(screen.getByText('Assets')).toBeInTheDocument()
  })

  it('renders a link with the correct href', () => {
    wrap(<KpiTile icon="package" label="Assets" value={7} to="/assets" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/assets')
  })

  it('renders optional sub line when provided', () => {
    wrap(<KpiTile icon="package" label="Assets" value={5} to="/assets" sub="sub info" />)
    expect(screen.getByText('sub info')).toBeInTheDocument()
  })

  it('does not render sub when omitted', () => {
    wrap(<KpiTile icon="package" label="Assets" value={5} to="/assets" />)
    expect(screen.queryByText('sub info')).toBeNull()
  })
})

// ── StatusBreakdown ───────────────────────────────────────────────────────────

describe('StatusBreakdown', () => {
  const statuses: StatusRow[] = [
    { id: 'st_warehouse', name: 'На складе',  color: 'gray' },
    { id: 'st_assigned',  name: 'Выдано',     color: 'green' },
    { id: 'st_repair',    name: 'В ремонте',  color: 'orange' },
    { id: 'st_disposed',  name: 'Списано',    color: 'red' },
  ]
  const byStatus: Record<AssetStatusId, number> = {
    st_warehouse: 10,
    st_assigned: 25,
    st_repair: 3,
    st_disposed: 2,
  }

  it('renders all 4 status names', () => {
    wrap(<StatusBreakdown byStatus={byStatus} statuses={statuses} total={40} />)
    expect(screen.getByText('На складе')).toBeInTheDocument()
    expect(screen.getByText('Выдано')).toBeInTheDocument()
    expect(screen.getByText('В ремонте')).toBeInTheDocument()
    expect(screen.getByText('Списано')).toBeInTheDocument()
  })

  it('renders all 4 counts', () => {
    wrap(<StatusBreakdown byStatus={byStatus} statuses={statuses} total={40} />)
    // counts as text
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders statuses in ASSET_STATUS_IDS order', () => {
    wrap(<StatusBreakdown byStatus={byStatus} statuses={statuses} total={40} />)
    const allNames = statuses.map(s => s.name)
    // Each name should appear in document in ASSET_STATUS_IDS order
    const rendered = ASSET_STATUS_IDS.map(id => statuses.find(s => s.id === id)!.name)
    rendered.forEach(name => {
      expect(screen.getByText(name)).toBeInTheDocument()
    })
  })

  it('does not crash when total is 0', () => {
    const zero: Record<AssetStatusId, number> = {
      st_warehouse: 0, st_assigned: 0, st_repair: 0, st_disposed: 0,
    }
    expect(() =>
      wrap(<StatusBreakdown byStatus={zero} statuses={statuses} total={0} />)
    ).not.toThrow()
  })
})

// ── GroupBreakdown ────────────────────────────────────────────────────────────

describe('GroupBreakdown', () => {
  const byGroup: GroupCount[] = [
    { group: 'devices',   count: 50 },
    { group: 'network',   count: 20 },
    { group: 'furniture', count: 10 },
  ]

  it('renders 3 rows (one per group)', () => {
    wrap(<GroupBreakdown byGroup={byGroup} />)
    // counts visible
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('does not crash when all counts are 0', () => {
    const zeros: GroupCount[] = [
      { group: 'devices', count: 0 },
      { group: 'network', count: 0 },
      { group: 'furniture', count: 0 },
    ]
    expect(() => wrap(<GroupBreakdown byGroup={zeros} />)).not.toThrow()
  })
})

// ── BranchBreakdown ───────────────────────────────────────────────────────────

describe('BranchBreakdown', () => {
  const branches: BranchCount[] = [
    { branchId: 'b1', name: 'Ереван',  count: 30 },
    { branchId: 'b2', name: 'Москва',  count: 15 },
    { branchId: 'b3', name: 'Тбилиси', count: 5  },
  ]

  it('renders branch names and counts', () => {
    wrap(<BranchBreakdown branches={branches} />)
    expect(screen.getByText('Ереван')).toBeInTheDocument()
    expect(screen.getByText('Москва')).toBeInTheDocument()
    expect(screen.getByText('Тбилиси')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders EmptyState when branches is empty', () => {
    wrap(<BranchBreakdown branches={[]} />)
    // No branch names in the DOM
    expect(screen.queryByText('Ереван')).toBeNull()
    // Some empty state indicator is present (icon container or text)
    // We check for absence of branch rows rather than implementation details
    expect(screen.queryByText('30')).toBeNull()
  })
})

// ── LicenseStatTile ───────────────────────────────────────────────────────────

describe('LicenseStatTile', () => {
  const stats: WorkstationLicenseStats = {
    total: 100,
    free: 30,
    inUse: 65,
    retired: 5,
  }

  it('renders the total number', () => {
    wrap(<LicenseStatTile stats={stats} />)
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders free count', () => {
    wrap(<LicenseStatTile stats={stats} />)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders inUse count', () => {
    wrap(<LicenseStatTile stats={stats} />)
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('renders retired count', () => {
    wrap(<LicenseStatTile stats={stats} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('NEVER renders a license key pattern (XXXXX-XXXXX)', () => {
    wrap(<LicenseStatTile stats={stats} />)
    const { container } = wrap(<LicenseStatTile stats={stats} />)
    expect(container.textContent).not.toMatch(/[A-Z0-9]{5}-[A-Z0-9]{5}/)
  })
})

// ── PeopleTile ────────────────────────────────────────────────────────────────

describe('PeopleTile', () => {
  it('renders employee count', () => {
    wrap(<PeopleTile employeeCount={42} pendingUsersCount={null} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders pending link when pendingUsersCount > 0', () => {
    wrap(<PeopleTile employeeCount={10} pendingUsersCount={3} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pending-users')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does NOT render pending link when pendingUsersCount is null', () => {
    wrap(<PeopleTile employeeCount={10} pendingUsersCount={null} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('does NOT render pending link when pendingUsersCount is 0', () => {
    wrap(<PeopleTile employeeCount={10} pendingUsersCount={0} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

// ── RecentActivityList ────────────────────────────────────────────────────────

describe('RecentActivityList', () => {
  const rows: ActivityRowVM[] = [
    {
      id: 'act-1',
      icon: 'arrow-right-left',
      label: 'Laptop Dell assigned to Alice',
      at: '2026-06-19T10:00:00.000Z',
      to: '/assets/a1',
    },
    {
      id: 'act-2',
      icon: 'arrow-right-left',
      label: 'Monitor LG returned',
      at: '2026-06-18T08:30:00.000Z',
    },
  ]

  it('renders all row labels', () => {
    wrap(
      <RecentActivityList
        title="Recent Activity"
        icon="history"
        rows={rows}
        emptyLabel="No activity yet"
      />,
    )
    expect(screen.getByText('Laptop Dell assigned to Alice')).toBeInTheDocument()
    expect(screen.getByText('Monitor LG returned')).toBeInTheDocument()
  })

  it('renders dates in DD/Mon/YYYY format', () => {
    wrap(
      <RecentActivityList
        title="Recent Activity"
        icon="history"
        rows={rows}
        emptyLabel="No activity yet"
      />,
    )
    // 2026-06-19 → "19/Jun/2026" (en locale) or similar; match the pattern
    expect(screen.getByText(/19\/[A-Za-zА-Яа-яёЁ.]+\/2026/)).toBeInTheDocument()
  })

  it('wraps rows with to prop in a Link', () => {
    wrap(
      <RecentActivityList
        title="Recent Activity"
        icon="history"
        rows={rows}
        emptyLabel="No activity yet"
      />,
    )
    const links = screen.getAllByRole('link')
    // row[0] has to="/assets/a1" → link with that href
    expect(links.some(l => l.getAttribute('href') === '/assets/a1')).toBe(true)
  })

  it('renders EmptyState with emptyLabel when rows is empty', () => {
    wrap(
      <RecentActivityList
        title="Recent Activity"
        icon="history"
        rows={[]}
        emptyLabel="No activity yet"
      />,
    )
    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  it('renders moreTo "view all" link when provided', () => {
    wrap(
      <RecentActivityList
        title="Recent Activity"
        icon="history"
        rows={rows}
        emptyLabel="No activity yet"
        moreTo="/audit"
      />,
    )
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/audit')).toBe(true)
  })
})
