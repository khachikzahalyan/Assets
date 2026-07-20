import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { clearResourceCache } from '@/hooks/useCachedResource'

// Clear the SWR cache between tests so each test starts with a cold store.
afterEach(() => clearResourceCache())

// jsdom does not implement window.matchMedia — provide a minimal stub
// so components that call it (e.g. DestPicker responsive positioning) don't throw.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
