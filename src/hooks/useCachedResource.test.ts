/**
 * useCachedResource — stale-while-revalidate hook unit tests.
 *
 * Tests cold load / warm remount / background error / cold error /
 * key change / null key / reload / clearResourceCache prefix + full /
 * readResourceCache + writeResourceCache thin wrappers.
 *
 * clearResourceCache() is also called afterEach by src/test-utils/setup.ts
 * to guarantee cross-test isolation even without explicit cleanup here.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  useCachedResource,
  clearResourceCache,
  cacheIdentity,
  readResourceCache,
  writeResourceCache,
} from './useCachedResource'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait until the hook's data equals `expected`. */
async function waitForData<T>(
  result: { current: { data: T | null } },
  expected: T,
) {
  await waitFor(() => expect(result.current.data).toEqual(expected))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCachedResource', () => {
  describe('cold load', () => {
    it('starts with loading=true and data=null; resolves to data after fetch', async () => {
      const fetcher = vi.fn().mockResolvedValue('hello')
      const { result } = renderHook(() => useCachedResource('cold-key', fetcher))

      expect(result.current.loading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.refreshing).toBe(false)

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toBe('hello')
      expect(result.current.error).toBeNull()
    })
  })

  describe('warm remount', () => {
    it('returns cached data synchronously on remount and updates in background', async () => {
      // First mount — populate cache
      const { result: r1, unmount } = renderHook(() =>
        useCachedResource('warm-key', vi.fn().mockResolvedValue('first-value')),
      )
      await waitForData(r1, 'first-value')
      unmount()

      // Second mount — same key, new fetcher returning updated value
      const { result: r2 } = renderHook(() =>
        useCachedResource('warm-key', vi.fn().mockResolvedValue('updated-value')),
      )

      // Cached data visible BEFORE any effect runs (synchronous read from store)
      expect(r2.current.loading).toBe(false)
      expect(r2.current.data).toBe('first-value')
      expect(r2.current.refreshing).toBe(true)

      // Background fetch resolves with newer value
      await waitForData(r2, 'updated-value')
      expect(r2.current.refreshing).toBe(false)
    })
  })

  describe('background error keeps stale data', () => {
    it('shows cached data and sets error when background refresh fails', async () => {
      // Populate cache
      const { result: r1, unmount } = renderHook(() =>
        useCachedResource('bg-err-key', vi.fn().mockResolvedValue('stale')),
      )
      await waitForData(r1, 'stale')
      unmount()

      // Remount with a failing fetcher
      const { result: r2 } = renderHook(() =>
        useCachedResource('bg-err-key', vi.fn().mockRejectedValue(new Error('network error'))),
      )

      // Immediately: stale data visible, no loading
      expect(r2.current.loading).toBe(false)
      expect(r2.current.data).toBe('stale')

      // After background failure:
      await waitFor(() => expect(r2.current.error).not.toBeNull())
      expect(r2.current.data).toBe('stale')   // stale data still visible
      expect(r2.current.loading).toBe(false)
    })
  })

  describe('cold error', () => {
    it('sets error with data=null on first-time fetch failure', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('cold fail'))
      const { result } = renderHook(() => useCachedResource('cold-err-key', fetcher))

      expect(result.current.loading).toBe(true)

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.error).not.toBeNull()
      expect(result.current.data).toBeNull()
    })
  })

  describe('key change', () => {
    it('resets to loading on uncached key; returns cached data instantly for known key', async () => {
      type FetcherMap = Record<string, () => Promise<string>>
      const fetchers: FetcherMap = {
        'key-a': vi.fn().mockResolvedValue('data-a'),
        'key-b': vi.fn().mockResolvedValue('data-b'),
      }

      const { result, rerender } = renderHook(
        ({ k }: { k: string }) => useCachedResource(k, fetchers[k]!),
        { initialProps: { k: 'key-a' } },
      )

      // Wait for key-a to load and cache
      await waitForData(result, 'data-a')

      // Switch to uncached key-b → loading=true
      rerender({ k: 'key-b' })
      expect(result.current.loading).toBe(true)
      expect(result.current.data).toBeNull()

      await waitForData(result, 'data-b')

      // Switch back to cached key-a → instant data, no loading
      rerender({ k: 'key-a' })
      expect(result.current.loading).toBe(false)
      expect(result.current.data).toBe('data-a')
    })
  })

  describe('null key', () => {
    it('behaves like cold fetch (no caching) so every mount starts loading', async () => {
      const fetcher = vi.fn().mockResolvedValue('null-key-data')

      const { result: r1, unmount } = renderHook(() => useCachedResource(null, fetcher))
      expect(r1.current.loading).toBe(true)
      await waitFor(() => expect(r1.current.loading).toBe(false))
      expect(r1.current.data).toBe('null-key-data')
      unmount()

      // Second mount — null key → no cache, loading=true again
      const { result: r2 } = renderHook(() => useCachedResource(null, fetcher))
      expect(r2.current.loading).toBe(true)
    })
  })

  describe('reload', () => {
    it('re-fetches and updates the cache on each call', async () => {
      let callCount = 0
      const fetcher = vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve(`value-${callCount}`)
      })

      const { result } = renderHook(() => useCachedResource('reload-key', fetcher))
      await waitForData(result, 'value-1')

      act(() => result.current.reload())
      await waitForData(result, 'value-2')

      expect(readResourceCache('reload-key')).toBe('value-2')
    })
  })

  describe('clearResourceCache', () => {
    it('prefix variant deletes only keys with that prefix', async () => {
      const { result: ra } = renderHook(() =>
        useCachedResource('pfx-a:one', vi.fn().mockResolvedValue('a')),
      )
      const { result: rb } = renderHook(() =>
        useCachedResource('pfx-b:one', vi.fn().mockResolvedValue('b')),
      )
      await waitForData(ra, 'a')
      await waitForData(rb, 'b')

      clearResourceCache('pfx-a')

      expect(readResourceCache('pfx-a:one')).toBeUndefined()
      expect(readResourceCache('pfx-b:one')).toBe('b')
    })

    it('no-argument variant clears all keys', async () => {
      const { result: ra } = renderHook(() =>
        useCachedResource('clr-a', vi.fn().mockResolvedValue('x')),
      )
      const { result: rb } = renderHook(() =>
        useCachedResource('clr-b', vi.fn().mockResolvedValue('y')),
      )
      await waitForData(ra, 'x')
      await waitForData(rb, 'y')

      clearResourceCache()

      expect(readResourceCache('clr-a')).toBeUndefined()
      expect(readResourceCache('clr-b')).toBeUndefined()
    })
  })

  describe('readResourceCache / writeResourceCache', () => {
    it('writeResourceCache stores a value; readResourceCache retrieves it', () => {
      writeResourceCache('direct-key', { foo: 'bar' })
      expect(readResourceCache('direct-key')).toEqual({ foo: 'bar' })
    })

    it('readResourceCache returns undefined for unknown key', () => {
      expect(readResourceCache('no-such-key')).toBeUndefined()
    })
  })

  describe('cacheIdentity', () => {
    it('returns the same id for the same object', () => {
      const obj = {}
      expect(cacheIdentity(obj)).toBe(cacheIdentity(obj))
    })

    it('returns different ids for different objects', () => {
      const a = {}
      const b = {}
      expect(cacheIdentity(a)).not.toBe(cacheIdentity(b))
    })
  })
})
