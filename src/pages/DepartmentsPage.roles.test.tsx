import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { DepartmentsPage } from './DepartmentsPage'
import { InMemoryDepartmentRepository } from '@/infra/repositories'
import type { Department } from '@/domain/department'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u_aa' }, role: 'asset_admin' }) }))
const seed = (): Department[] => [{ id: 'd1', name: 'IT', createdAt: 't', updatedAt: 't' }]

describe('DepartmentsPage (asset_admin — read only)', () => {
  it('does NOT show the create button for asset_admin', async () => {
    render(<MemoryRouter><DepartmentsPage repository={new InMemoryDepartmentRepository(seed())} /></MemoryRouter>)
    await screen.findByText('IT')
    expect(screen.queryByText(/Добавить отдел|Add department/)).toBeNull()
  })
})
