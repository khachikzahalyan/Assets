import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AssetWriteRepository } from '@/domain/asset/AssetRepository'
import type { Asset } from '@/domain/asset/types'

let fireScan: (raw: string) => void = () => {}
vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: { onScan: (codes: { rawValue: string }[]) => void }) => {
    fireScan = (raw: string) => props.onScan([{ rawValue: raw }])
    return <div data-testid="scanner-mock" />
  },
}))

const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateSpy,
}))

const toastSpy = vi.fn()
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: toastSpy }) }))

import { ScanPage } from './ScanPage'

const ASSET: Asset = {
  id: 'a_005', categoryId: 'cat_lap', brand: 'Dell', model: 'Latitude', invCode: 'LAP/00123',
  serial: 'SN1', statusId: 'st_assigned', assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-06-01T00:00:00.000Z',
}
function repoWith(byBarcode: Asset | null, byInv: Asset | null = null): AssetWriteRepository {
  // test double — cast is the standard pattern for partial repo mocks in this suite
  return {
    findByBarcode: vi.fn(async () => byBarcode),
    findByInvCode: vi.fn(async () => byInv),
  } as unknown as AssetWriteRepository
}

beforeEach(() => { navigateSpy.mockClear(); toastSpy.mockClear() })

describe('ScanPage', () => {
  it('found: navigates to the asset detail page', async () => {
    render(<MemoryRouter><ScanPage repository={repoWith(ASSET)} /></MemoryRouter>)
    fireScan('LAP/00123')
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets/a_005'))
  })
  it('not found: shows a toast and does not navigate', async () => {
    render(<MemoryRouter><ScanPage repository={repoWith(null)} /></MemoryRouter>)
    fireScan('NOPE/00000')
    await waitFor(() => expect(toastSpy).toHaveBeenCalled())
    expect(navigateSpy).not.toHaveBeenCalled()
  })
  it('fires resolution only once even if onScan fires twice rapidly', async () => {
    const repo = repoWith(ASSET)
    render(<MemoryRouter><ScanPage repository={repo} /></MemoryRouter>)
    fireScan('LAP/00123'); fireScan('LAP/00123')
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1))
    expect(repo.findByBarcode).toHaveBeenCalledTimes(1)
  })
  it('falls back to invCode when barcode lookup misses', async () => {
    render(<MemoryRouter><ScanPage repository={repoWith(null, ASSET)} /></MemoryRouter>)
    fireScan('LAP/00123')
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets/a_005'))
  })
})
