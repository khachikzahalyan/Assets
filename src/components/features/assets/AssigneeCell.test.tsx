import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssigneeCell } from './AssigneeCell'
import type { Asset, EmployeeRow } from '@/domain/asset'

// ── minimal valid Asset fixture ─────────────────────────────────────────────
const baseAsset: Asset = {
  id: 'asset-1',
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'Latitude',
  invCode: '450/001',
  serial: null,
  statusId: 'st_assigned',
  assignment: null,
  branchId: 'br-1',
  deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// ── shared label strings (Russian-ish, as the real app would pass) ──────────
const LABELS = {
  onShelf: 'На складе',
  onShelfSub: 'Ожидает выдачи',
  deptLabel: 'Отдел',
  branchLabel: 'Филиал',
  tempLabel: 'Временно',
  kindAuditLabel: 'Аудитор',
  kindInternLabel: 'Стажёр',
}

// ── maps ─────────────────────────────────────────────────────────────────────
const emp: EmployeeRow = { id: 'e1', firstName: 'Иван', lastName: 'Петров', email: 'ivan@example.test' }
const employeeMap = new Map<string, EmployeeRow>([['e1', emp]])
const deptMap = new Map<string, string>([['d1', 'Бухгалтерия']])
const branchMap = new Map<string, string>([['b1', 'Ереван']])

// helper to render the cell with default maps unless overridden
function renderCell(asset: Asset, overrides?: {
  employeeMap?: Map<string, EmployeeRow>
  deptMap?: Map<string, string>
  branchMap?: Map<string, string>
}) {
  return render(
    <AssigneeCell
      asset={asset}
      employeeMap={overrides?.employeeMap ?? employeeMap}
      deptMap={overrides?.deptMap ?? deptMap}
      branchMap={overrides?.branchMap ?? branchMap}
      {...LABELS}
    />,
  )
}

// ── 1. employee assignment — name as "Lastname Firstname" ───────────────────
describe('AssigneeCell — employee assignment', () => {
  it('renders bold "Lastname Firstname" for a known employee', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1' },
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('Петров Иван')).toBeInTheDocument()
  })

  it('shows department sub-line when employee assignment also carries departmentId', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1', departmentId: 'd1' },
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('Петров Иван')).toBeInTheDocument()
    expect(screen.getByText('Бухгалтерия')).toBeInTheDocument()
  })
})

// ── 2. temporary assignment — amber sub-line ─────────────────────────────────
describe('AssigneeCell — temporary assignment', () => {
  it('shows tempLabel sub-line when isTemporary is true', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: true },
    }

    // act
    const { container } = renderCell(asset)

    // assert — text present
    expect(screen.getByText('Временно')).toBeInTheDocument()

    // assert — amber colour class on the sub-line element
    const subLine = container.querySelector('.text-amber-300')
    expect(subLine).not.toBeNull()
    expect(subLine?.textContent).toBe('Временно')
  })

  it('shows role label "Аудитор" instead of name when tempKind is audit', () => {
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: true, tempKind: 'audit' },
    }
    renderCell(asset)
    expect(screen.getByText('Аудитор')).toBeInTheDocument()
    expect(screen.queryByText('Петров Иван')).not.toBeInTheDocument()
    expect(screen.getByText('Временно')).toBeInTheDocument()
  })

  it('shows role label "Стажёр" instead of name when tempKind is intern', () => {
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: true, tempKind: 'intern' },
    }
    renderCell(asset)
    expect(screen.getByText('Стажёр')).toBeInTheDocument()
    expect(screen.queryByText('Петров Иван')).not.toBeInTheDocument()
  })

  it('does NOT show department sub-line when isTemporary is true (temporary takes priority)', () => {
    // arrange — both isTemporary AND departmentId set
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: true, departmentId: 'd1' },
    }

    // act
    renderCell(asset)

    // assert — amber label shown, dept name NOT shown as sub-line
    expect(screen.getByText('Временно')).toBeInTheDocument()
    expect(screen.queryByText('Бухгалтерия')).not.toBeInTheDocument()
  })
})

// ── 3. department assignment ─────────────────────────────────────────────────
describe('AssigneeCell — department assignment', () => {
  it('renders department name and deptLabel sub-line', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'department', departmentId: 'd1' },
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('Бухгалтерия')).toBeInTheDocument()
    expect(screen.getByText('Отдел')).toBeInTheDocument()
  })
})

// ── 4. branch assignment ─────────────────────────────────────────────────────
describe('AssigneeCell — branch assignment', () => {
  it('renders branch name and branchLabel sub-line', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'branch', branchId: 'b1' },
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('Ереван')).toBeInTheDocument()
    expect(screen.getByText('Филиал')).toBeInTheDocument()
  })
})

// ── 5. warehouse — no assignment, statusId st_warehouse ─────────────────────
describe('AssigneeCell — warehouse (no assignment, st_warehouse)', () => {
  it('renders onShelf name and onShelfSub sub-line', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_warehouse',
      assignment: null,
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('На складе')).toBeInTheDocument()
    expect(screen.getByText('Ожидает выдачи')).toBeInTheDocument()
  })
})

// ── 6. unknown/none — no assignment, statusId NOT st_warehouse ───────────────
// assigneeKind() returns 'none' for this case; the component falls through to
// the same final warehouse block and renders onShelf + onShelfSub.
describe('AssigneeCell — none kind (no assignment, non-warehouse statusId)', () => {
  it('renders onShelf and onShelfSub (same warehouse block)', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned', // not st_warehouse → assigneeKind = 'none'
      assignment: null,
    }

    // act
    renderCell(asset)

    // assert — component falls through to the default warehouse return
    expect(screen.getByText('На складе')).toBeInTheDocument()
    expect(screen.getByText('Ожидает выдачи')).toBeInTheDocument()
  })
})

// ── 7. employee not in map — falls back to '—' ──────────────────────────────
describe('AssigneeCell — unknown employeeId', () => {
  it('renders "—" when employeeId is not in employeeMap', () => {
    // arrange
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'employee', employeeId: 'e-missing' },
    }

    // act
    renderCell(asset)

    // assert
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

// ── 8. true temporary hold (mode === 'temporary') ────────────────────────────
describe('AssigneeCell — mode===temporary hold', () => {
  it('renders a temporary (mode==="temporary") hold with role label + Временно sub-line, not warehouse', () => {
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'temporary', tempKind: 'intern', expiresAt: '2099-01-01', isTemporary: true },
    }
    renderCell(asset)
    expect(screen.getByText('Стажёр')).toBeInTheDocument()
    expect(screen.queryByText('На складе')).not.toBeInTheDocument()
  })

  it('renders kindAuditLabel for tempKind=audit', () => {
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'temporary', tempKind: 'audit', expiresAt: '2099-01-01', isTemporary: true },
    }
    renderCell(asset)
    expect(screen.getByText('Аудитор')).toBeInTheDocument()
    expect(screen.queryByText('На складе')).not.toBeInTheDocument()
  })

  it('renders tempLabel as name when tempKind is absent', () => {
    const asset: Asset = {
      ...baseAsset,
      statusId: 'st_assigned',
      assignment: { mode: 'temporary', isTemporary: true },
    }
    renderCell(asset)
    // "Временно" appears at least once (as the name line)
    expect(screen.getAllByText('Временно').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('На складе')).not.toBeInTheDocument()
  })
})
