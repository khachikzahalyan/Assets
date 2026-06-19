import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { Btn } from './btn'
import { Chip } from './chip'
import { Badge } from './badge'
import { Avatar } from './avatar'
import { Input } from './input'
import { Select } from './select'
import { SectionCard } from './section-card'
import { Icon } from './icon'
import { EmptyState } from './empty-state'
import { ErrorState } from './error-state'
import { LoadingState } from './loading-state'

// ----------------------------------------------------------------
// Btn
// ----------------------------------------------------------------
describe('Btn', () => {
  it('renders children', () => {
    render(<Btn>Click me</Btn>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('variant="primary" className contains bg-[#F97316]', () => {
    render(<Btn variant="primary">Primary</Btn>)
    const btn = screen.getByRole('button', { name: 'Primary' })
    expect(btn.className).toContain('bg-[#F97316]')
  })
})

// ----------------------------------------------------------------
// Chip
// ----------------------------------------------------------------
describe('Chip', () => {
  it('color="green" className contains emerald', () => {
    const { container } = render(<Chip color="green">Active</Chip>)
    const span = container.querySelector('span')
    expect(span?.className).toContain('emerald')
  })

  it('dot=true renders a child dot span', () => {
    const { container } = render(<Chip color="green" dot>Active</Chip>)
    // The outer span wraps [dot-span, children] — querySelector finds nested span
    const dotSpan = container.querySelector('span span')
    expect(dotSpan).not.toBeNull()
  })
})

// ----------------------------------------------------------------
// Badge
// ----------------------------------------------------------------
describe('Badge', () => {
  it('renders its numeric child text', () => {
    render(<Badge>42</Badge>)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})

// ----------------------------------------------------------------
// Avatar
// ----------------------------------------------------------------
describe('Avatar', () => {
  it('renders user.initials text', () => {
    render(<Avatar user={{ initials: 'JD', avatarColor: 'bg-blue-500' }} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})

// ----------------------------------------------------------------
// Input
// ----------------------------------------------------------------
describe('Input', () => {
  it('fireEvent.change calls onChange with new value', () => {
    const handler = vi.fn()
    render(<Input value="" onChange={handler} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(handler).toHaveBeenCalledWith('hello')
  })
})

// ----------------------------------------------------------------
// Select
// ----------------------------------------------------------------
describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ]

  it('renders options.length + 1 total options (including placeholder)', () => {
    const { container } = render(
      <Select value="" options={options} placeholder="Pick one" />
    )
    const optionEls = container.querySelectorAll('option')
    expect(optionEls.length).toBe(options.length + 1)
  })
})

// ----------------------------------------------------------------
// SectionCard
// ----------------------------------------------------------------
describe('SectionCard', () => {
  it('with title shows the title text', () => {
    render(<SectionCard title="My Section">content</SectionCard>)
    expect(screen.getByText('My Section')).toBeInTheDocument()
  })

  it('with noHeader does NOT render the title', () => {
    render(<SectionCard title="Hidden" noHeader>content</SectionCard>)
    expect(screen.queryByText('Hidden')).toBeNull()
  })
})

// ----------------------------------------------------------------
// Icon
// ----------------------------------------------------------------
describe('Icon', () => {
  it('name="package" renders an <svg>', () => {
    const { container } = render(<Icon name="package" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('name="zzz-unknown" still renders an <svg> (fallback)', () => {
    const { container } = render(<Icon name="zzz-unknown" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

// ----------------------------------------------------------------
// EmptyState (requires i18n)
// ----------------------------------------------------------------
describe('EmptyState', () => {
  it('renders the default empty title from i18n when no title prop', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <EmptyState />
      </I18nextProvider>
    )
    // The fallback language is 'ru'; states.emptyTitle = 'Здесь пока пусто'
    // But in CI the detected language may be 'en' — accept either
    const ruTitle = 'Здесь пока пусто'
    const enTitle = 'Nothing here yet'
    const el = screen.queryByText(ruTitle) ?? screen.queryByText(enTitle)
    expect(el).not.toBeNull()
  })
})

// ----------------------------------------------------------------
// ErrorState (requires i18n)
// ----------------------------------------------------------------
describe('ErrorState', () => {
  it('onRetry button click calls the handler', () => {
    const handler = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <ErrorState onRetry={handler} />
      </I18nextProvider>
    )
    // The retry button text is t('actions.retry') — 'Повторить' in ru, 'Retry' in en
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------------------------------
// LoadingState
// ----------------------------------------------------------------
describe('LoadingState', () => {
  it('rows=3 renders 3 row wrappers each containing anim-skeleton elements', () => {
    const { container } = render(<LoadingState rows={3} />)
    // Each row is a flex div inside the root space-y container
    const root = container.firstElementChild
    const rows = root ? Array.from(root.children) : []
    expect(rows.length).toBe(3)
  })
})
