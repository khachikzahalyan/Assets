import { render, screen, fireEvent } from '@testing-library/react'
import { Drawer } from './Drawer'

it('renders children when open', () => {
  render(<Drawer open onClose={() => {}}><div>panel body</div></Drawer>)
  expect(screen.getByText('panel body')).toBeInTheDocument()
})
it('calls onClose on ESC', () => {
  const onClose = vi.fn()
  render(<Drawer open onClose={onClose}><div>x</div></Drawer>)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})
it('calls onClose on backdrop click', () => {
  const onClose = vi.fn()
  render(<Drawer open onClose={onClose}><div>x</div></Drawer>)
  // backdrop is the element with the bg-black/60 class
  const backdrop = document.querySelector('.bg-black\\/60') as HTMLElement
  fireEvent.click(backdrop)
  expect(onClose).toHaveBeenCalled()
})
it('renders nothing when closed', () => {
  render(<Drawer open={false} onClose={() => {}}><div>hidden</div></Drawer>)
  expect(screen.queryByText('hidden')).toBeNull()
  expect(document.querySelector('[data-drawer]')).toBeNull()
})
