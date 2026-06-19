import { describe, it, expect, vi, beforeEach } from 'vitest'

const setDoc = vi.fn()
const doc = vi.fn(() => ({ __ref: true }))
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => doc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => '__ts__',
}))
vi.mock('@/lib/firebase', () => ({ db: () => ({}) }))

import { claimPendingUser } from './claimPendingUser'

describe('claimPendingUser', () => {
  beforeEach(() => { setDoc.mockReset(); setDoc.mockResolvedValue(undefined) })

  it('merge-writes a no-role record with NO role key', async () => {
    await claimPendingUser({ uid: 'u1', email: 'a@x.com', displayName: 'A' })
    expect(setDoc).toHaveBeenCalledTimes(1)
    const [, data, opts] = setDoc.mock.calls[0]
    expect(data).not.toHaveProperty('role')
    expect(data).toMatchObject({ email: 'a@x.com', displayName: 'A', status: 'no-role' })
    expect(opts).toEqual({ merge: true })
  })

  it('swallows write failures (never throws)', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'))
    await expect(
      claimPendingUser({ uid: 'u1', email: 'a@x.com', displayName: 'A' }),
    ).resolves.toBeUndefined()
  })
})
