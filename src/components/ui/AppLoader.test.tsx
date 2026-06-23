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

  it('renders the default label "Загрузка…"', () => {
    render(<AppLoader />)
    expect(screen.getByText('Загрузка…')).toBeInTheDocument()
  })

  it('renders a custom label when label prop is provided', () => {
    render(<AppLoader label="X" />)
    expect(screen.getByText('X')).toBeInTheDocument()
    expect(screen.queryByText('Загрузка…')).toBeNull()
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
