import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { BranchFormDialog } from './BranchFormDialog'
import type { Branch } from '@/domain/branch'

describe('BranchFormDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(<BranchFormDialog open={false} onSubmit={() => {}} onCancel={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
  it('blocks submit when name empty, then submits trimmed values', () => {
    const onSubmit = vi.fn()
    render(<BranchFormDialog open onSubmit={onSubmit} onCancel={() => {}} />)
    const buttons = screen.getAllByRole('button')
    const save = buttons[buttons.length - 1]!
    fireEvent.click(save)
    expect(onSubmit).not.toHaveBeenCalled()
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: '  North  ' } })
    fireEvent.click(save)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'North', type: 'branch', city: null, address: null }))
  })

  describe('key-based reset — fields update when initial changes (Bug 3)', () => {
    const branchA: Branch = {
      id: 'branch-a', name: 'Alpha Office', type: 'branch',
      city: null, address: null,
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    }
    const branchB: Branch = {
      id: 'branch-b', name: 'Beta Office', type: 'branch',
      city: null, address: null,
      createdAt: '2024-01-01', updatedAt: '2024-01-01',
    }

    it('shows branchA.name when mounted with initial=branchA', () => {
      render(
        <BranchFormDialog
          key={branchA.id}
          open
          initial={branchA}
          onSubmit={() => {}}
          onCancel={() => {}}
        />,
      )
      const nameInput = screen.getAllByRole('textbox')[0] as HTMLInputElement
      expect(nameInput.value).toBe('Alpha Office')
    })

    it('shows branchB.name after unmount+remount with initial=branchB (simulates key change in parent)', () => {
      const { unmount } = render(
        <BranchFormDialog
          key={branchA.id}
          open
          initial={branchA}
          onSubmit={() => {}}
          onCancel={() => {}}
        />,
      )
      // Verify branchA is shown first
      const nameInputA = screen.getAllByRole('textbox')[0] as HTMLInputElement
      expect(nameInputA.value).toBe('Alpha Office')

      // Simulate key change: unmount branchA instance, mount branchB instance
      unmount()
      render(
        <BranchFormDialog
          key={branchB.id}
          open
          initial={branchB}
          onSubmit={() => {}}
          onCancel={() => {}}
        />,
      )

      // Now field must show branchB.name, not the stale branchA.name
      const nameInputB = screen.getAllByRole('textbox')[0] as HTMLInputElement
      expect(nameInputB.value).toBe('Beta Office')
    })
  })
})
