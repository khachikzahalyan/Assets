import { describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useDismissOnOutside } from './useDismissOnOutside'

/**
 * Owner rule (2026-07-28): a tap outside an open overlay only CLOSES it —
 * on touch, the follow-up click must never reach the element underneath.
 */
function Harness({ onOutsideAction }: { onOutsideAction: () => void }) {
  const [open, setOpen] = useState(true)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  useDismissOnOutside([triggerRef, popRef], () => setOpen(false), open)
  return (
    <div>
      <button ref={triggerRef} data-testid="trigger">trigger</button>
      {open && <div ref={popRef} data-testid="popover">popover</div>}
      <button data-testid="outside" onClick={onOutsideAction}>outside</button>
    </div>
  )
}

function pointerDown(el: Element, pointerType: string) {
  // jsdom lacks PointerEvent — synthesize via MouseEvent with pointerType patched
  // on, dispatched through fireEvent so React state updates are act()-wrapped.
  const e = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  fireEvent(el, e)
}

describe('useDismissOnOutside', () => {
  it('closes on mousedown outside (jsdom/legacy fallback)', () => {
    render(<Harness onOutsideAction={() => {}} />)
    expect(screen.getByTestId('popover')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('popover')).toBeNull()
  })

  it('does NOT close on press inside any of the refs', () => {
    render(<Harness onOutsideAction={() => {}} />)
    fireEvent.mouseDown(screen.getByTestId('popover'))
    fireEvent.mouseDown(screen.getByTestId('trigger'))
    expect(screen.getByTestId('popover')).toBeInTheDocument()
  })

  it('touch pointerdown outside closes AND swallows the follow-up click', () => {
    const onOutsideAction = vi.fn()
    render(<Harness onOutsideAction={onOutsideAction} />)
    const outside = screen.getByTestId('outside')

    pointerDown(outside, 'touch')
    expect(screen.queryByTestId('popover')).toBeNull()

    // The click that the browser fires right after the dismissing touch —
    // must be trapped in capture phase and never reach the outside button.
    fireEvent.click(outside)
    expect(onOutsideAction).not.toHaveBeenCalled()

    // A later, unrelated click works normally (one-shot trap).
    fireEvent.click(outside)
    expect(onOutsideAction).toHaveBeenCalledTimes(1)
  })

  it('mouse pointerdown outside closes WITHOUT swallowing the next click (desktop unchanged)', () => {
    const onOutsideAction = vi.fn()
    render(<Harness onOutsideAction={onOutsideAction} />)
    const outside = screen.getByTestId('outside')

    pointerDown(outside, 'mouse')
    expect(screen.queryByTestId('popover')).toBeNull()

    fireEvent.click(outside)
    expect(onOutsideAction).toHaveBeenCalledTimes(1)
  })
})
