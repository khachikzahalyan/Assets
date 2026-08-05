/**
 * useEmployeesData — writeResourceCache assetCounts correctness.
 *
 * Bug 9: when assetCountsProp is passed from outside, the local `counts`
 * variable stays `{}` (the defaultLoadAssetCounts branch is skipped).
 * The fix uses `effectiveCounts = assetCountsProp ?? counts` before writing
 * to the cache so the snapshot reflects the real counts, not an empty object.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { useEmployeesData } from './useEmployeesData'
import {
  cacheIdentity,
  readResourceCache,
  clearResourceCache,
} from '@/hooks/useCachedResource'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'
import { DEFAULT_QUERY } from './employeesHelpers'

// ── Firebase stub ────────────────────────────────────────────────────────────
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Stub getSharedAssetRepository used inside reload() for categories
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    getSharedEmployeeRepositoryWithGuard: vi.fn(),
    getSharedAssetRepository: vi.fn(() => ({
      loadReferenceData: vi.fn().mockResolvedValue({
        statuses: [], branches: [], departments: [],
        categories: [], employees: [], categoryGroups: [],
      }),
      listAssets: vi.fn().mockResolvedValue([]),
    })),
    getSharedAssignmentRepository: vi.fn(() => ({
      listAssignmentsForEmployee: vi.fn().mockResolvedValue([]),
    })),
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com',
    phone: null, position: null, branchId: null, departmentId: null,
    status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nextProvider, { i18n }, children)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('writeResourceCache with assetCountsProp', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    clearResourceCache()
  })

  it('writes actual assetCounts (not empty {}) to cache when assetCountsProp is provided', async () => {
    const externalCounts: Record<string, number> = { emp_1: 3 }
    const repo = new InMemoryEmployeeRepository([makeEmployee()])

    const loadRefData = vi.fn().mockResolvedValue({ branches: [], departments: [] })

    const { result } = renderHook(
      () => useEmployeesData({
        repository: repo,
        loadRefData,
        assetCounts: externalCounts,
      }),
      { wrapper },
    )

    // Wait for reload() to finish (loading transitions to false)
    await waitFor(() => expect(result.current.loading).toBe(false))

    // The cache key mirrors the one produced in reload()
    const snapKey = `employees:${cacheIdentity(repo)}:${JSON.stringify(DEFAULT_QUERY)}`
    const cached = readResourceCache<{ assetCounts: Record<string, number> }>(snapKey)

    expect(cached).toBeDefined()
    expect(cached!.assetCounts).toEqual({ emp_1: 3 })
  })

  it('writes defaultLoadAssetCounts result to cache when assetCountsProp is NOT provided', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmployee()])
    const loadRefData = vi.fn().mockResolvedValue({ branches: [], departments: [] })

    const { result } = renderHook(
      () => useEmployeesData({
        repository: repo,
        loadRefData,
        // No assetCounts prop — hook should call defaultLoadAssetCounts
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    const snapKey = `employees:${cacheIdentity(repo)}:${JSON.stringify(DEFAULT_QUERY)}`
    const cached = readResourceCache<{ assetCounts: Record<string, number> }>(snapKey)

    expect(cached).toBeDefined()
    // When no prop is given, counts come from internal defaultLoadAssetCounts
    // which uses assetRepo.listAssets — our mock returns [] → counts = {}
    expect(cached!.assetCounts).toEqual({})
  })
})
