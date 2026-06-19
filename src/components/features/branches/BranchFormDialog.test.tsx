import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { BranchFormDialog } from './BranchFormDialog'

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
})
