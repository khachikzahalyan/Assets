import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { MyAssetsPage } from './MyAssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { Asset, AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [{ id: 'st_assigned', name: 'Выдано', color: 'green' }],
  branches: [], departments: [],
  categories: [{ id: 'c', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }], employees: [],
}
function ctx() {
  return { user: { id: 'uid_1', name: 'И', email: 'i@x.com', role: 'employee' as const, initials: 'И', avatarColor: '' },
    role: 'employee' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {} }
}
function mk(assignmentEmp: string | null): Asset {
  return { id: 'a_1', categoryId: 'c', brand: 'Dell', model: 'XPS', invCode: '450/1', serial: null,
    statusId: 'st_assigned', assignment: assignmentEmp ? { mode: 'employee', employeeId: assignmentEmp } : null,
    branchId: 'b', deptId: null, updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null }
}
function render_(assets: Asset[]) {
  render(<I18nextProvider i18n={i18n}><AuthContext.Provider value={ctx()}>
    <MyAssetsPage repository={new InMemoryAssetRepository(assets, REF)} />
  </AuthContext.Provider></I18nextProvider>)
}
describe('MyAssetsPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('lists my assigned asset', async () => {
    render_([mk('uid_1')])
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
  })
  it('shows empty state when nothing is assigned', async () => {
    render_([mk('someone_else')])
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()
  })
})
