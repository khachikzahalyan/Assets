/**
 * Icon component tests.
 *
 * Covers:
 *  - All 7 newly-registered tech-spec icon names render an <svg> without warning.
 *  - An unknown name emits the [Icon] console.warn and still renders a fallback <svg>.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Icon } from './icon'

// The Icon component only warns in DEV mode. Vitest/Vite sets import.meta.env.DEV
// to true in test mode by default, so the warn path is active.

describe('Icon — newly registered tech-spec names', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  const NEW_ICONS = [
    'circuit-board',
    'memory-stick',
    'hard-drive',
    'microchip',
    'fan',
    'plug',
    'battery-medium',
  ] as const

  for (const name of NEW_ICONS) {
    it(`name="${name}" renders an <svg> and does NOT emit [Icon] unknown-name warn`, () => {
      // Arrange + Act
      const { container } = render(<Icon name={name} />)

      // Assert: an SVG is present
      expect(container.querySelector('svg')).not.toBeNull()

      // Assert: no unknown-name warning was emitted
      const unknownWarns = warnSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('[Icon] unknown name'),
      )
      expect(unknownWarns).toHaveLength(0)
    })
  }
})

describe('Icon — unknown name fallback guard', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('an unknown name still renders a fallback <svg>', () => {
    // Arrange + Act
    const { container } = render(<Icon name="definitely-not-an-icon" />)

    // Assert: fallback SVG renders
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('an unknown name emits the [Icon] unknown name console.warn', () => {
    // Arrange + Act
    render(<Icon name="definitely-not-an-icon" />)

    // Assert: warning was emitted
    const unknownWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[Icon] unknown name'),
    )
    expect(unknownWarns.length).toBeGreaterThanOrEqual(1)
  })
})
