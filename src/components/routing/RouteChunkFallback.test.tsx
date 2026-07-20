import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RouteChunkFallback } from './RouteChunkFallback'

describe('RouteChunkFallback', () => {
  it('covers the viewport so the shell chrome is never visible behind it', () => {
    render(<RouteChunkFallback />)
    const overlay = screen.getByTestId('startup-route-overlay')
    expect(overlay).toHaveClass('fixed', 'inset-0')
  })

  it('renders the fullscreen-centered loader — same position as the auth loader', () => {
    render(<RouteChunkFallback />)
    expect(screen.getByTestId('app-loader')).toHaveClass('min-h-screen')
  })

  it('renders exactly one loader', () => {
    render(<RouteChunkFallback />)
    expect(screen.getAllByTestId('app-loader')).toHaveLength(1)
  })
})
