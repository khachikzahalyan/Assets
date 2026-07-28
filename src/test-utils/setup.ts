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

// jsdom does not implement Element.prototype.scrollTo — provide a no-op stub
// so components that call it inside requestAnimationFrame (e.g. CategoryChipStrip)
// don't throw an unhandled TypeError that causes the process to exit 1.
if (typeof Element.prototype.scrollTo === 'undefined') {
  Element.prototype.scrollTo = () => {}
}
