import { describe, it, expect, vi, beforeEach } from 'vitest'

const getIdToken = vi.fn()
let currentUser: { getIdToken: typeof getIdToken } | null = { getIdToken }

vi.mock('@/lib/firebase', () => ({
  auth: () => ({ get currentUser() { return currentUser } }),
}))

import { sendAccessEmail } from './sendAccessEmail'

describe('sendAccessEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    getIdToken.mockReset().mockResolvedValue('tok_123')
    currentUser = { getIdToken }
  })

  it('POSTs to /api/notify-access with Bearer token and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const r = await sendAccessEmail({ email: 'x@y.com', name: 'Погос', kind: 'role', roleLabel: 'Админ активов' })

    expect(r).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/notify-access')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer tok_123')
    const sent = JSON.parse(opts.body)
    expect(sent).toMatchObject({ email: 'x@y.com', name: 'Погос', kind: 'role', roleLabel: 'Админ активов' })
  })

  it('returns ok:false and does not throw when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(sendAccessEmail({ email: 'x@y.com', kind: 'employee' })).resolves.toEqual({ ok: false })
  })

  it('returns ok:false on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(sendAccessEmail({ email: 'x@y.com', kind: 'role' })).resolves.toEqual({ ok: false })
  })

  it('returns ok:false without a signed-in user (no fetch)', async () => {
    currentUser = null
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendAccessEmail({ email: 'x@y.com', kind: 'role' })).resolves.toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns ok:false for a blank email (no fetch)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendAccessEmail({ email: '   ', kind: 'role' })).resolves.toEqual({ ok: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
