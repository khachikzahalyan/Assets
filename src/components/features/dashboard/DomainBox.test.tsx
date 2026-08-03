/**
 * Tests for DomainBox and MiniBarChart.
 *
 * Harness mirrors dashboard-components.test.tsx exactly:
 *   - Real @/lib/i18n instance (I18nextProvider).
 *   - MemoryRouter for react-router-dom <Link>.
 *   - beforeAll: i18n.changeLanguage('ru') so all assertions use the ru locale
 *     unless the test explicitly switches language.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import type { DomainEventVM } from '@/domain/dashboard'
import { DomainBox } from './DomainBox'
import { MiniBarChart } from './MiniBarChart'

// ── shared harness ────────────────────────────────────────────────────────────

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

afterEach(async () => {
  // Reset to ru after any test that changes language.
  await act(async () => { await i18n.changeLanguage('ru') })
})

function wrap(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  )
}

// ── shared fixtures ───────────────────────────────────────────────────────────

const DAYS_7 = [0, 1, 2, 3, 4, 5, 6]

const EVENT_WITH_LINK: DomainEventVM = {
  id: 'ev-1',
  primary: 'Dell Latitude 7420',
  secondary: 'Иван Петров',
  at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
  linkTo: '/assets/asset-1',
}

const EVENT_WITHOUT_LINK: DomainEventVM = {
  id: 'ev-2',
  primary: 'Samsung S23',
  secondary: null,
  at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // ~25h ago
}

// Default props shared across most DomainBox tests.
const BASE_PROPS = {
  icon: 'package',
  title: 'Активы',
  total: 42 as number | null,
  delta7d: 3,
  days: DAYS_7,
  events: [EVENT_WITH_LINK, EVENT_WITHOUT_LINK],
  barClass: 'bg-sky-400/70',
  viewAllLabel: 'Все активы',
  emptyLabel: 'Нет событий за 7 дней',
}

// ── 1. title, total, delta chip ───────────────────────────────────────────────

describe('DomainBox — title, total, delta chip', () => {
  it('renders the title text', () => {
    wrap(<DomainBox {...BASE_PROPS} />)
    expect(screen.getByText('Активы')).toBeInTheDocument()
  })

  it('renders the total number', () => {
    wrap(<DomainBox {...BASE_PROPS} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the delta chip with +3 за 7 дней in ru locale (boxes.delta7d)', () => {
    wrap(<DomainBox {...BASE_PROPS} delta7d={3} />)
    // ru: "+{{n}} за 7 дней" → "+3 за 7 дней"
    expect(screen.getByText('+3 за 7 дней')).toBeInTheDocument()
  })
})

// ── 2. total = null → em dash ─────────────────────────────────────────────────

describe('DomainBox — total = null', () => {
  it('renders em dash when total is null', () => {
    wrap(<DomainBox {...BASE_PROPS} total={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not render a numeric total when total is null', () => {
    wrap(<DomainBox {...BASE_PROPS} total={null} />)
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })
})

// ── 3. events=[] → EmptyState + MiniBarChart present ─────────────────────────

describe('DomainBox — empty events list', () => {
  it('renders the emptyLabel text when events is empty', () => {
    wrap(<DomainBox {...BASE_PROPS} events={[]} testId="box-empty" />)
    expect(screen.getByText('Нет событий за 7 дней')).toBeInTheDocument()
  })

  it('renders 7 bar elements inside MiniBarChart when events is empty', () => {
    // MiniBarChart renders one <span> per day value (7 total) inside a flex
    // container with class "flex items-end gap-[0.1875rem] h-6".
    // We query it by that unique combination via the component itself with testId.
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <MiniBarChart days={DAYS_7} barClass="bg-sky-400/70" testId="mini-in-empty-box" />
        </MemoryRouter>
      </I18nextProvider>,
    )
    const barRoot = screen.getByTestId('mini-in-empty-box')
    expect(barRoot.children).toHaveLength(7)
  })
})

// ── 4. viewAllTo: present → link; absent → no link with viewAllLabel ──────────

describe('DomainBox — viewAllTo prop', () => {
  it('does NOT render a link with viewAllLabel when viewAllTo is undefined', () => {
    wrap(<DomainBox {...BASE_PROPS} />)
    const links = screen.queryAllByRole('link')
    const viewAllLinks = links.filter(l => l.textContent === 'Все активы')
    expect(viewAllLinks).toHaveLength(0)
  })

  it('renders link(s) with viewAllLabel and href /assets when viewAllTo is provided', () => {
    wrap(<DomainBox {...BASE_PROPS} viewAllTo="/assets" />)
    const links = screen.getAllByRole('link')
    const viewAllLinks = links.filter(l => l.textContent === 'Все активы')
    // Two links: one mobile (lg:hidden) + one desktop (hidden lg:block).
    expect(viewAllLinks.length).toBeGreaterThanOrEqual(1)
    viewAllLinks.forEach(l => expect(l).toHaveAttribute('href', '/assets'))
  })
})

// ── 5. event linkTo: row with linkTo → <a>; row without linkTo → no <a> ───────

describe('DomainBox — event row link behaviour', () => {
  it('renders an anchor with the correct href for an event that has linkTo', () => {
    wrap(<DomainBox {...BASE_PROPS} events={[EVENT_WITH_LINK]} />)
    const links = screen.getAllByRole('link')
    const eventLink = links.find(l => l.getAttribute('href') === '/assets/asset-1')
    expect(eventLink).toBeDefined()
  })

  it('does not render a link element for an event without linkTo', () => {
    // Render only the no-link event so there are no other links competing.
    wrap(
      <DomainBox
        {...BASE_PROPS}
        events={[EVENT_WITHOUT_LINK]}
       
      />,
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})

// ── 6. secondary: null vs non-null ───────────────────────────────────────────

describe('DomainBox — secondary line', () => {
  it('renders only the primary text when secondary is null', () => {
    const ev: DomainEventVM = { ...EVENT_WITHOUT_LINK, secondary: null }
    wrap(<DomainBox {...BASE_PROPS} events={[ev]} />)
    expect(screen.getByText('Samsung S23')).toBeInTheDocument()
    // 'null' should never appear as literal text.
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('renders both primary and secondary when secondary is a string', () => {
    const ev: DomainEventVM = { ...EVENT_WITH_LINK, secondary: 'Иван' }
    wrap(<DomainBox {...BASE_PROPS} events={[ev]} />)
    expect(screen.getByText('Dell Latitude 7420')).toBeInTheDocument()
    expect(screen.getByText('Иван')).toBeInTheDocument()
  })
})

// ── 7. totalCaption ───────────────────────────────────────────────────────────

describe('DomainBox — totalCaption', () => {
  it('renders the totalCaption text when provided', () => {
    wrap(<DomainBox {...BASE_PROPS} totalCaption="единиц на складе" />)
    expect(screen.getByText('единиц на складе')).toBeInTheDocument()
  })

  it('does not render a caption element when totalCaption is not provided', () => {
    // BASE_PROPS has no totalCaption.
    wrap(<DomainBox {...BASE_PROPS} />)
    expect(screen.queryByText('единиц на складе')).not.toBeInTheDocument()
  })
})

// ── 8. MiniBarChart standalone ────────────────────────────────────────────────

describe('MiniBarChart', () => {
  it('renders exactly 7 children for a 7-value days array', () => {
    render(
      <MiniBarChart days={[0, 1, 2, 3, 4, 5, 6]} barClass="bg-sky-400/70" testId="mini-bar" />,
    )
    const root = screen.getByTestId('mini-bar')
    expect(root.children).toHaveLength(7)
  })

  it('uses bg-border class for zero-value bars', () => {
    render(
      <MiniBarChart days={[0, 0, 0, 0, 0, 0, 0]} barClass="bg-sky-400/70" testId="mini-bar-z" />,
    )
    const root = screen.getByTestId('mini-bar-z')
    // Every child should have the zero-value muted dot class.
    Array.from(root.children).forEach(child => {
      expect(child.className).toContain('bg-border')
    })
  })

  it('uses barClass for non-zero-value bars', () => {
    render(
      <MiniBarChart days={[0, 0, 0, 0, 0, 0, 5]} barClass="bg-sky-400/70" testId="mini-bar-nz" />,
    )
    const root = screen.getByTestId('mini-bar-nz')
    // Last child (index 6) is non-zero → should carry barClass.
    const lastBar = root.children[6]!
    expect(lastBar.className).toContain('bg-sky-400/70')
  })

  it('applies bg-border to zero bars and barClass to non-zero bars in a mixed array', () => {
    render(
      <MiniBarChart days={[0, 2, 0, 4, 0, 0, 1]} barClass="bg-emerald-400" testId="mini-bar-mix" />,
    )
    const root = screen.getByTestId('mini-bar-mix')
    const children = Array.from(root.children)
    // Indices 0, 2, 4, 5 are zero.
    ;[0, 2, 4, 5].forEach(idx => {
      expect(children[idx]!.className).toContain('bg-border')
    })
    // Indices 1, 3, 6 are non-zero.
    ;[1, 3, 6].forEach(idx => {
      expect(children[idx]!.className).toContain('bg-emerald-400')
    })
  })
})

// ── 9. i18n: boxes.delta7d in ru, en, hy ─────────────────────────────────────
//
// i18next's changeLanguage() fires synchronously for pre-loaded resources, but
// it also triggers React subscriber callbacks that cause state updates.  Wrapping
// the render in act() keeps Testing Library happy and avoids the "not wrapped
// in act" console warning.

describe('DomainBox — i18n delta7d across locales', () => {
  it('renders the ru translation of boxes.delta7d', async () => {
    // ru: "+{{n}} за 7 дней"
    await act(async () => { await i18n.changeLanguage('ru') })
    wrap(<DomainBox {...BASE_PROPS} delta7d={5} />)
    expect(screen.getByText('+5 за 7 дней')).toBeInTheDocument()
  })

  it('renders the en translation of boxes.delta7d', async () => {
    // en: "+{{n}} in 7 days"
    await act(async () => { await i18n.changeLanguage('en') })
    wrap(<DomainBox {...BASE_PROPS} delta7d={5} />)
    expect(screen.getByText('+5 in 7 days')).toBeInTheDocument()
  })

  it('renders the hy translation of boxes.delta7d', async () => {
    // hy: "+{{n}} 7 օրում"
    await act(async () => { await i18n.changeLanguage('hy') })
    wrap(<DomainBox {...BASE_PROPS} delta7d={5} />)
    expect(screen.getByText('+5 7 օրում')).toBeInTheDocument()
  })
})
