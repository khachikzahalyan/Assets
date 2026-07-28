import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CardListSkeleton } from './CardListSkeleton'

/**
 * Fill-contract geometry pin (owner rule: skeleton occupies EXACTLY the
 * Zone-2 region — never shorter, never spilling past the card).
 *
 * MobileListRow-based variants: root flex-1 min-h-0 resolves to the region
 * height; every row is an equal flex slot (flex:1 1 0; min-height:0) with
 * overflow hidden so N rows always split the region into N slots.
 * Grid variants (part-device, subscription) are natural-height cards in
 * scrollable areas and must NOT carry the fill contract.
 */
const LIST_VARIANTS = ['asset', 'employee', 'catalog', 'audit', 'key', 'role'] as const

describe('CardListSkeleton fill contract', () => {
  it.each(LIST_VARIANTS)('variant "%s": root fills the region, rows are equal flex slots', variant => {
    const { unmount } = render(<CardListSkeleton rows={10} variant={variant} />)

    const root = screen.getByTestId('card-list-skeleton')
    expect(root.dataset['variant']).toBe(variant)
    expect(root.className).toContain('flex-1')
    expect(root.className).toContain('min-h-0')

    const rowEls = screen.getAllByTestId('card-list-skeleton-row')
    expect(rowEls).toHaveLength(10)
    for (const row of rowEls) {
      // jsdom serializes the '1 1 0' shorthand with a px-suffixed basis
      expect(row.style.flex).toBe('1 1 0px')
      expect(row.style.minHeight).toBe('0')
      expect(row.className).toContain('overflow-hidden')
      // Content stays vertically centered when the slot is taller/shorter than natural
      expect(row.className).toContain('items-center')
    }
    unmount()
  })

  it.each(['part-device', 'subscription'] as const)(
    'grid variant "%s": natural height, no fill contract',
    variant => {
      const { unmount } = render(<CardListSkeleton rows={4} variant={variant} />)

      const root = screen.getByTestId('card-list-skeleton')
      expect(root.className).not.toContain('flex-1')

      for (const row of screen.getAllByTestId('card-list-skeleton-row')) {
        expect(row.style.flex).toBe('')
      }
      unmount()
    },
  )
})
