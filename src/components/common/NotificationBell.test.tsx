import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { NotificationBell } from './NotificationBell'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { Asset, AssetReferenceData } from '@/domain/asset'

beforeAll(async () => { await i18n.changeLanguage('ru') })

const base: Asset = {
  id: 'a0', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
  invCode: '450/001', serial: null, statusId: 'st_assigned',
  assignment: null, branchId: 'br-1', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
function temp(id: string, expiresAt: string, tempKind: 'audit' | 'intern', invCode: string): Asset {
  return { ...base, id, invCode, assignment: { mode: 'temporary', isTemporary: true, tempKind, expiresAt } }
}
const EMPTY_REF: AssetReferenceData = { statuses: [], branches: [], departments: [], categories: [], employees: [] }
function stubRepo(assets: Asset[]): AssetRepository {
  return {
    listAssets: vi.fn().mockResolvedValue(assets),
    loadReferenceData: vi.fn().mockResolvedValue(EMPTY_REF),
    listAssetsForEmployee: vi.fn().mockResolvedValue([]),
    loadSelfServiceRefData: vi.fn().mockResolvedValue({ statuses: [], categories: [], branches: [], departments: [] }),
  }
}
function renderBell(repo: AssetRepository, onSelect = vi.fn()) {
  render(<I18nextProvider i18n={i18n}><NotificationBell repository={repo} onSelect={onSelect} /></I18nextProvider>)
  return { onSelect }
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('NotificationBell', () => {
  it('shows a badge with the dueSoon+overdue count (active excluded)', async () => {
    const repo = stubRepo([
      temp('overdue1', '2000-01-01', 'intern', '450/002'),
      temp('active1', '2999-01-01', 'audit', '450/003'),
    ])
    renderBell(repo)
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('1'))
  })

  it('renders no badge when there are zero holds', async () => {
    const repo = stubRepo([])
    renderBell(repo)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    expect(screen.queryByTestId('bell-badge')).toBeNull()
  })

  it('opens the panel and shows the empty state when no holds', async () => {
    const repo = stubRepo([])
    renderBell(repo)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(await screen.findByText('Нет активов к возврату')).toBeInTheDocument()
  })

  it('lists overdue before dueSoon and calls onSelect with the assetId', async () => {
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7)
    const repo = stubRepo([
      temp('soon1', iso(tomorrow), 'intern', '450/004'),
      temp('late1', iso(lastWeek), 'audit', '450/005'),
    ])
    const { onSelect } = renderBell(repo)
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('2'))
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    const items = await screen.findAllByTestId('bell-item')
    expect(items).toHaveLength(2)
    fireEvent.click(items[0]!) // overdue first → late1
    expect(onSelect).toHaveBeenCalledWith('late1')
  })
})
