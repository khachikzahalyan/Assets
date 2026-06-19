/**
 * Lazy-accessor contract test for src/lib/firebase/index.ts
 *
 * Purpose: prove that the REAL module (no vi.mock) can be imported and its
 * exports referenced when VITE_FIREBASE_* env vars are absent, WITHOUT
 * throwing. This is the primary guarantee of the lazy-accessor design.
 *
 * What is NOT tested here: calling the accessors with invalid config — that
 * is expected to throw (Firebase rejects bad apiKey / projectId) and is
 * intentionally outside this test's scope.
 *
 * No vi.mock('@/lib/firebase') is used so the real module code is exercised.
 */

import { describe, it, expect } from 'vitest'

describe('firebase/index lazy-accessor contract', () => {
  it('importing the real module does not throw even when VITE_FIREBASE_* are unset', async () => {
    // Arrange + Act — dynamic import of the REAL module (no mock interceptor).
    // If any SDK call (initializeApp, getAuth, …) runs at module-evaluation
    // time this import itself would throw. The test would fail here.
    let firebaseModule: typeof import('./index') | undefined

    await expect(
      (async () => {
        firebaseModule = await import('./index')
      })()
    ).resolves.toBeUndefined()

    // Assert — the module loaded; firebaseModule is assigned
    expect(firebaseModule).toBeDefined()
  })

  it('all five exports are functions (lazy accessor shape) after import', async () => {
    // Arrange
    const firebase = await import('./index')

    // Act + Assert — reference each export WITHOUT calling it.
    // Referencing (not invoking) must never throw.
    expect(typeof firebase.app).toBe('function')
    expect(typeof firebase.auth).toBe('function')
    expect(typeof firebase.db).toBe('function')
    expect(typeof firebase.storage).toBe('function')
    expect(typeof firebase.functions).toBe('function')
  })

  it('referencing (not calling) the exports does not invoke Firebase SDK', async () => {
    // Arrange — import the real module
    const firebase = await import('./index')

    // Act — capture references to the accessors without invoking them
    // If initializeApp / getAuth were called at module level the act of
    // importing above would already have thrown. We still explicitly touch
    // each reference to confirm the reference itself is safe.
    const refs = [firebase.app, firebase.auth, firebase.db, firebase.storage, firebase.functions]

    // Assert — we captured five function references; none of this threw
    expect(refs).toHaveLength(5)
    refs.forEach((ref) => expect(typeof ref).toBe('function'))
  })
})
