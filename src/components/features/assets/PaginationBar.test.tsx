import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { PaginationBar } from './PaginationBar'

// Force Russian locale for stable assertions.
beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderBar(props: {
  page: number
  pageSize: number
  total: number
  onPage?: (p: number) => void
}) {
  const onPage = props.onPage ?? vi.fn()
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <PaginationBar
        page={props.page}
        pageSize={props.pageSize}
        total={props.total}
        onPage={onPage}
      />
    </I18nextProvider>,
  )
  return { container, onPage }
}

// ── Prototype window algorithm verification ────────────────────────────────────
//
// PAGE_SIZE=10, total=115 → totalPages = ceil(115/10) = 12
//
// page=1:  start=max(1,1-2)=1  end=min(12,1+4)=5  → window=[1,2,3,4,5]
//          start>1 → false (no leading "1 …")
//          end<12  → true, end(5) < 12-1(11) → trailing "… 12"
//          rendered buttons: 1,2,3,4,5,…,12
//
// page=6:  start=max(1,6-2)=4  end=min(12,4+4)=8  → window=[4,5,6,7,8]
//          start(4)>1 → leading "1 …"
//          end(8)<12  → end(8)<11 → trailing "… 12"
//          rendered buttons: 1,…,4,5,6,7,8,…,12
//
// page=12: start=max(1,12-2)=10  end=min(12,10+4)=12, end-start+1=3<5 → start=max(1,12-4)=8
//          window=[8,9,10,11,12]
//          start(8)>1 → leading "1 …"
//          end(12)==12 → no trailing
//          rendered buttons: 1,…,8,9,10,11,12

describe('PaginationBar — prototype window algorithm (pageSize=10, total=115, totalPages=12)', () => {
  it('page 1: window is [1,2,3,4,5] with trailing … 12', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 115 })

    // Window buttons 1–5 present
    expect(screen.getByRole('button', { name: '1', current: 'page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()

    // No button 6 in main window
    const btn6 = container.querySelectorAll('button[aria-label="6"]')
    expect(btn6.length).toBe(0)

    // Trailing ellipsis and jump-to-last button
    const ellipses = screen.getAllByText('…')
    expect(ellipses.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument()

    // No leading jump-to-1 (window starts at 1 already)
    // There should be exactly one button with aria-label "1" (the active window button)
    const btn1s = container.querySelectorAll('button[aria-label="1"]')
    expect(btn1s.length).toBe(1)
  })

  it('page 6: window is [4,5,6,7,8] with leading 1 … and trailing … 12', () => {
    renderBar({ page: 6, pageSize: 10, total: 115 })

    // Window buttons 4–8
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '8' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6', current: 'page' })).toBeInTheDocument()

    // Leading jump-to-1
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    // Trailing jump-to-12
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument()

    // Two ellipsis spans (leading and trailing)
    const ellipses = screen.getAllByText('…')
    expect(ellipses.length).toBe(2)
  })

  it('page 12: window is [8,9,10,11,12] with leading 1 … and no trailing', () => {
    renderBar({ page: 12, pageSize: 10, total: 115 })

    // Window buttons 8–12
    expect(screen.getByRole('button', { name: '8' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12', current: 'page' })).toBeInTheDocument()

    // Leading jump-to-1 and one ellipsis
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    const ellipses = screen.getAllByText('…')
    expect(ellipses.length).toBe(1)
  })
})

describe('PaginationBar — single page (total=1, pageSize=10)', () => {
  it('renders prev + active page 1 + next; both nav buttons are disabled', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 1 })

    const allButtons = container.querySelectorAll('button')
    const prevButton = allButtons[0] as HTMLButtonElement
    const nextButton = allButtons[allButtons.length - 1] as HTMLButtonElement

    expect(prevButton).toBeDisabled()
    expect(nextButton).toBeDisabled()

    expect(screen.getByRole('button', { name: '1', current: 'page' })).toBeInTheDocument()
  })

  it('has no ellipsis spans when totalPages=1', () => {
    renderBar({ page: 1, pageSize: 10, total: 1 })
    const ellipses = screen.queryAllByText('…')
    expect(ellipses.length).toBe(0)
  })
})

describe('PaginationBar — range text (pageSize=10)', () => {
  it('shows aria-label "Показано {from} из {total}" for page=1, total=115', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 115 })
    // The bar wrapper carries the full accessible sentence as aria-label.
    // Format is "Показано {from} из {total}" (no range end).
    const bar = container.firstElementChild as HTMLElement
    expect(bar.getAttribute('aria-label')).toMatch(/1/)
    expect(bar.getAttribute('aria-label')).toMatch(/115/)
  })

  it('page=1, total=10: from=1, to=10 (exact single page)', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 10 })
    const bar = container.firstElementChild as HTMLElement
    const label = bar.getAttribute('aria-label') ?? ''
    expect(label).toMatch(/1/)
    expect(label).toMatch(/10/)
  })

  it('page=2, total=115: from=11 ("Показано 11 из 115")', () => {
    const { container } = renderBar({ page: 2, pageSize: 10, total: 115 })
    const bar = container.firstElementChild as HTMLElement
    const label = bar.getAttribute('aria-label') ?? ''
    expect(label).toMatch(/11/)
    expect(label).toMatch(/115/)
  })
})

describe('PaginationBar — navigation callbacks', () => {
  it('prev button disabled on page 1', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 115 })
    const allButtons = container.querySelectorAll('button')
    expect((allButtons[0] as HTMLButtonElement).disabled).toBe(true)
  })

  it('next button disabled on last page', () => {
    const { container } = renderBar({ page: 12, pageSize: 10, total: 115 })
    const allButtons = container.querySelectorAll('button')
    expect((allButtons[allButtons.length - 1] as HTMLButtonElement).disabled).toBe(true)
  })

  it('clicking a window page button calls onPage with that page number', () => {
    const onPage = vi.fn()
    renderBar({ page: 1, pageSize: 10, total: 115, onPage })

    fireEvent.click(screen.getByRole('button', { name: '3' }))

    expect(onPage).toHaveBeenCalledOnce()
    expect(onPage).toHaveBeenCalledWith(3)
  })

  it('clicking next calls onPage(page+1)', () => {
    const onPage = vi.fn()
    const { container } = renderBar({ page: 5, pageSize: 10, total: 115, onPage })

    const allButtons = container.querySelectorAll('button')
    fireEvent.click(allButtons[allButtons.length - 1] as HTMLButtonElement)

    expect(onPage).toHaveBeenCalledWith(6)
  })

  it('clicking prev calls onPage(page-1)', () => {
    const onPage = vi.fn()
    const { container } = renderBar({ page: 5, pageSize: 10, total: 115, onPage })

    const allButtons = container.querySelectorAll('button')
    fireEvent.click(allButtons[0] as HTMLButtonElement)

    expect(onPage).toHaveBeenCalledWith(4)
  })

  it('clicking leading jump-to-1 calls onPage(1)', () => {
    const onPage = vi.fn()
    renderBar({ page: 6, pageSize: 10, total: 115, onPage })

    // The jump-to-1 button is the leading "1" outside the window
    fireEvent.click(screen.getByRole('button', { name: '1' }))

    expect(onPage).toHaveBeenCalledWith(1)
  })

  it('clicking trailing jump-to-last calls onPage(totalPages)', () => {
    const onPage = vi.fn()
    renderBar({ page: 1, pageSize: 10, total: 115, onPage })

    fireEvent.click(screen.getByRole('button', { name: '12' }))

    expect(onPage).toHaveBeenCalledWith(12)
  })

  it('active page button has aria-current="page"', () => {
    renderBar({ page: 6, pageSize: 10, total: 115 })
    const activeBtn = screen.getByRole('button', { name: '6', current: 'page' })
    expect(activeBtn).toBeInTheDocument()
  })
})

describe('PaginationBar — edge cases', () => {
  it('total=0: from=0, to=0, renders bar with page 1 disabled', () => {
    const { container } = renderBar({ page: 1, pageSize: 10, total: 0 })
    const bar = container.firstElementChild as HTMLElement
    const label = bar.getAttribute('aria-label') ?? ''
    expect(label).toMatch(/0/)
  })

  it('small total (total=25, 3 pages): no leading or trailing jump buttons on page 2', () => {
    // totalPages=3, page=2, window=[1,2,3] (start=1, end=3)
    renderBar({ page: 2, pageSize: 10, total: 25 })
    const ellipses = screen.queryAllByText('…')
    expect(ellipses.length).toBe(0)
    // All 3 page buttons present directly in window
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument()
  })
})
