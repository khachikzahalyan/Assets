/**
 * TabStrip component unit tests.
 *
 * Covers:
 *  - Renders all tabs with correct labels.
 *  - role="tablist" on container and role="tab" on each button.
 *  - aria-selected is true only on the active tab.
 *  - count=0 renders the badge (0 is a valid display value).
 *  - count=undefined → no badge element rendered.
 *  - onChange fires with the clicked tab id.
 *  - testId passthrough onto the button element.
 *  - icon rendered when icon prop is given.
 *  - ariaControls sets aria-controls and id on the button.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabStrip } from './TabStrip'

// i18n is not used inside TabStrip (labels are pre-translated by the page).
// No need to mock react-i18next.

describe('TabStrip', () => {
  const baseTabs = [
    { id: 'keys' as const, label: 'Ключи'    },
    { id: 'subs' as const, label: 'Подписки' },
  ]

  it('renders all tabs with correct labels', () => {
    render(
      <TabStrip
        tabs={baseTabs}
        active="keys"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('Ключи')).toBeInTheDocument()
    expect(screen.getByText('Подписки')).toBeInTheDocument()
  })

  it('has role="tablist" on container and role="tab" on each button', () => {
    render(
      <TabStrip
        tabs={baseTabs}
        active="keys"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
  })

  it('sets aria-selected=true only on the active tab', () => {
    render(
      <TabStrip
        tabs={baseTabs}
        active="subs"
        onChange={vi.fn()}
      />,
    )
    const tabs = screen.getAllByRole('tab')
    const keysTab = tabs.find(t => t.textContent?.includes('Ключи'))
    const subsTab = tabs.find(t => t.textContent?.includes('Подписки'))
    expect(keysTab).toHaveAttribute('aria-selected', 'false')
    expect(subsTab).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the count badge when count=0 (0 is valid)', () => {
    const tabs = [
      { id: 'a' as const, label: 'Tab A', count: 0 },
    ]
    render(
      <TabStrip
        tabs={tabs}
        active="a"
        onChange={vi.fn()}
      />,
    )
    // The button text includes the label and then the badge with "0"
    const button = screen.getByRole('tab')
    expect(button.textContent).toContain('0')
  })

  it('does not render a count badge when count is undefined', () => {
    const tabs = [
      { id: 'a' as const, label: 'Tab A' },
    ]
    render(
      <TabStrip
        tabs={tabs}
        active="a"
        onChange={vi.fn()}
      />,
    )
    // No tabular-nums span should appear — check no child with tabular-nums class
    const button = screen.getByRole('tab')
    const badge = button.querySelector('.tabular-nums')
    expect(badge).toBeNull()
  })

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn()
    render(
      <TabStrip
        tabs={baseTabs}
        active="keys"
        onChange={onChange}
      />,
    )
    const subsTab = screen.getAllByRole('tab').find(t =>
      t.textContent?.includes('Подписки'),
    )!
    fireEvent.click(subsTab)
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('subs')
  })

  it('passes testId onto the button as data-testid', () => {
    const tabs = [
      { id: 'keys' as const, label: 'Ключи', testId: 'tab-keys' },
    ]
    render(
      <TabStrip
        tabs={tabs}
        active="keys"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('tab-keys')).toBeInTheDocument()
  })

  it('renders the icon when icon prop is given', () => {
    const tabs = [
      { id: 'keys' as const, label: 'Ключи', icon: 'key-round' },
    ]
    render(
      <TabStrip
        tabs={tabs}
        active="keys"
        onChange={vi.fn()}
      />,
    )
    // Icon renders an <svg> (lucide icon) inside the button
    const button = screen.getByRole('tab')
    expect(button.querySelector('svg')).toBeInTheDocument()
  })

  it('sets aria-controls and id on the button when ariaControls is given', () => {
    const tabs = [
      { id: 'specs' as const, label: 'Specs', ariaControls: 'panel-specs' },
    ]
    render(
      <TabStrip
        tabs={tabs}
        active="specs"
        onChange={vi.fn()}
      />,
    )
    const button = screen.getByRole('tab')
    expect(button).toHaveAttribute('aria-controls', 'panel-specs')
    expect(button).toHaveAttribute('id', 'tab-specs')
  })
})
