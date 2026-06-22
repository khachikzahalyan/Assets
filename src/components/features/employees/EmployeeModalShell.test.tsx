/**
 * EmployeeModalShell unit tests.
 *
 * Tests that the shell: renders children when open, calls onClose on ESC and
 * backdrop click, renders nothing when closed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmployeeModalShell } from './EmployeeModalShell'

describe('EmployeeModalShell', () => {
  it('renders children when open', () => {
    render(
      <EmployeeModalShell open onClose={() => {}}>
        <div>modal body</div>
      </EmployeeModalShell>,
    )
    expect(screen.getByText('modal body')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(
      <EmployeeModalShell open={false} onClose={() => {}}>
        <div>hidden content</div>
      </EmployeeModalShell>,
    )
    expect(screen.queryByText('hidden content')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn()
    render(
      <EmployeeModalShell open onClose={onClose}>
        <div>body</div>
      </EmployeeModalShell>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <EmployeeModalShell open onClose={onClose}>
        <div>body</div>
      </EmployeeModalShell>,
    )
    const backdrop = document.querySelector('.bg-black\\/60') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
