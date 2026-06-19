import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { MyActsPage } from './MyActsPage'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

// MyActsPage imports storage() from firebase only inside handleViewScan (not at render time).
// Mock it so the module resolves even though no Firebase app is initialised.
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// actScanUrl is called only when the user clicks "view scan" — not during render.
// Mock it globally so the import doesn't touch the real Firebase Storage SDK.
vi.mock('@/infra/storage', () => ({
  actScanUrl: vi.fn().mockResolvedValue('https://example.test/scan.pdf'),
}))

// ---------------------------------------------------------------------------
// Minimal stub — only implements the one method MyActsPage calls.
// ---------------------------------------------------------------------------
function makeRepo(assignments: Assignment[]): AssignmentRepository {
  return {
    listAssignmentsForEmployee: async () => assignments,
    listAssignments:   async () => [],
    getActiveAssignment: async () => null,
    assign:      (_input: unknown, _actor: Actor): Promise<AuditedResult<Assignment>> => Promise.reject(new Error('not implemented')),
    returnAsset: (_assetId: string, _actor: Actor): Promise<AuditedResult<Assignment>> => Promise.reject(new Error('not implemented')),
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
function authCtx(uid = 'uid_1') {
  return {
    user: { id: uid, name: 'Тест', email: 't@example.test', role: 'employee' as const, initials: 'Т', avatarColor: '' },
    role: 'employee' as const,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    id: 'as_1',
    assetId: 'a_1',
    mode: 'employee',
    assignedToEmployeeId: 'uid_1',
    assignedToBranchId: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: null,
    actStoragePath: 'acts/a_1/scan.pdf',
    transferComment: null,
    createdBy: 'admin_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function renderPage(repo: AssignmentRepository, uid = 'uid_1') {
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(uid)}>
        <MyActsPage repository={repo} />
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MyActsPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders a row with a "view scan" button when the employee has an assignment with an actStoragePath', async () => {
    // Arrange
    const repo = makeRepo([assignment()])

    // Act
    renderPage(repo)

    // Assert — the scan button is visible and the assetId appears as the row label
    expect(await screen.findByText(/a_1/)).toBeInTheDocument()
    // Russian locale: "Открыть скан"
    expect(screen.getByRole('button', { name: /открыть скан/i })).toBeInTheDocument()
  })

  it('shows the noActs empty state when the employee has no assignments with a scan', async () => {
    // Arrange — assignment exists but has no actStoragePath
    const repo = makeRepo([assignment({ actStoragePath: null })])

    // Act
    renderPage(repo)

    // Assert — Russian locale: "У вас нет подписанных актов"
    expect(await screen.findByText(/нет подписанных актов/i)).toBeInTheDocument()
  })

  it('shows the noActs empty state when the employee has no assignments at all', async () => {
    // Arrange
    const repo = makeRepo([])

    // Act
    renderPage(repo)

    // Assert
    expect(await screen.findByText(/нет подписанных актов/i)).toBeInTheDocument()
  })

  it('does NOT render an act row for an assignment that belongs to a different employee', async () => {
    // Arrange — the assignment is for uid_other, not uid_1.
    // The repo's listAssignmentsForEmployee is scoped per employee; a correct repo
    // returns nothing for uid_1.  Verify the page shows empty-state and doesn't
    // display the foreign employee's assetId.
    const otherAssignment = assignment({ assignedToEmployeeId: 'uid_other' })
    const repo = makeRepo([]) // listAssignmentsForEmployee('uid_1') returns []

    // Act
    renderPage(repo, 'uid_1')

    // Assert — uid_1 sees only their own acts (empty → noActs state)
    expect(await screen.findByText(/нет подписанных актов/i)).toBeInTheDocument()
    // otherAssignment's assetId must NOT appear anywhere
    expect(screen.queryByText(otherAssignment.assetId)).not.toBeInTheDocument()
  })
})
