import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/lib/i18n'
import { CategoryGroupFormDialog } from './CategoryGroupFormDialog'
import type { CategoryGroupFormValues } from './CategoryGroupFormDialog'

describe('CategoryGroupFormDialog', () => {
  // ── Required-name guard ───────────────────────────────────────────────────

  it('shows invalid (red border) when name is empty and submit is attempted', () => {
    const onSubmit = vi.fn()
    render(
      <CategoryGroupFormDialog
        open
        initial={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    // Find the Save button and click without entering a name
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    // onSubmit must NOT be called
    expect(onSubmit).not.toHaveBeenCalled()
    // Input should have aria-invalid=true (Input component sets it when invalid=true)
    const input = screen.getAllByRole('textbox')[0]!
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  // ── Submit returns correct values ─────────────────────────────────────────

  it('calls onSubmit with { name, lucideIcon } when form is valid', () => {
    const onSubmit = vi.fn()
    render(
      <CategoryGroupFormDialog
        open
        initial={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Серверы' } })   // name
    fireEvent.change(inputs[1]!, { target: { value: 'server' } })    // lucideIcon

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)

    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith<[CategoryGroupFormValues]>({ name: 'Серверы', lucideIcon: 'server' })
  })

  it('defaults lucideIcon to "package" when field is left blank', () => {
    const onSubmit = vi.fn()
    render(
      <CategoryGroupFormDialog
        open
        initial={null}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'Склад' } })
    // Leave icon blank
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!)
    expect(onSubmit).toHaveBeenCalledWith<[CategoryGroupFormValues]>({ name: 'Склад', lucideIcon: 'package' })
  })

  // ── Mobile bottom-sheet ───────────────────────────────────────────────────

  it('renders with mobile bottom-sheet classes on ≤767px viewport', () => {
    // Simulate mobile viewport via window.innerWidth — MODAL_SHEET applies max-md: classes
    // in Tailwind; for the RTL structural test we assert the class strings are present.
    render(
      <CategoryGroupFormDialog
        open
        initial={null}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    // The panel div must have the MODAL_SHEET token classes
    const backdrop = document.querySelector('.fixed.inset-0')
    expect(backdrop).toBeTruthy()
    expect(backdrop?.className).toContain('max-md:items-end')

    const panel = backdrop?.querySelector('[class*="max-md:rounded-t"]')
    expect(panel).toBeTruthy()
    expect(panel?.className).toContain('max-md:rounded-t-[18px]')
    expect(panel?.className).toContain('max-md:rounded-b-none')
  })

  // ── onCancel ─────────────────────────────────────────────────────────────

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <CategoryGroupFormDialog
        open
        initial={null}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByText(/Отмена|Cancel|Չеغарк/))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
