import { render, screen } from '@testing-library/react'
import { AppLoader } from './AppLoader'

describe('AppLoader', () => {
  it('renders with data-testid="app-loader" and role="status"', () => {
    render(<AppLoader />)
    const loader = screen.getByTestId('app-loader')
    expect(loader).toBeInTheDocument()
    expect(loader).toHaveAttribute('role', 'status')
  })

  it('renders the AMS brand mark text', () => {
    render(<AppLoader />)
    expect(screen.getByText('AMS')).toBeInTheDocument()
  })

  it('label is screen-reader-only (visually hidden via sr-only)', () => {
    render(<AppLoader />)
    const label = screen.getByText('Загрузка…')
    expect(label.className).toContain('sr-only')
  })

  it('fullScreen=true → root has min-h-screen class', () => {
    render(<AppLoader fullScreen />)
    const loader = screen.getByTestId('app-loader')
    expect(loader.className).toContain('min-h-screen')
  })

  it('fullScreen=false (default) → root does NOT have min-h-screen class', () => {
    render(<AppLoader />)
    const loader = screen.getByTestId('app-loader')
    expect(loader.className).not.toContain('min-h-screen')
  })
})
