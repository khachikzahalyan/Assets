import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetDetailSkeleton } from './AssetDetailSkeleton'

// The detail tab labels (Тех. характеристики / История / Документы) are static
// known chrome (P2) — the skeleton renders the REAL DetailTabs instead of shimmer
// bars, so the strip has no layout shift when the real page mounts.
describe('AssetDetailSkeleton — real tab labels during loading', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('renders the real DetailTabs labels (specs/history/docs) while loading', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton />
      </I18nextProvider>,
    )
    // Both breakpoint branches mount the real DetailTabs → each label appears twice.
    expect(screen.getAllByText(i18n.t('assets:detail.tabs.specs')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(i18n.t('assets:detail.tabs.history')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(i18n.t('assets:detail.tabs.docs')).length).toBeGreaterThan(0)
  })

  it('marks the default specs tab as active (aria-selected)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton />
      </I18nextProvider>,
    )
    // The skeleton branches are aria-hidden, so role queries skip them — query the
    // tab elements by attribute instead and assert the specs tab is the active one.
    const specsLabel = i18n.t('assets:detail.tabs.specs')
    const activeSpecsTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]'))
      .filter(el => (el.textContent ?? '').includes(specsLabel))
    expect(activeSpecsTabs.length).toBeGreaterThan(0)
  })
})

// Finding 2: spec-less categories (furniture etc.) render only 2 tabs on the real
// page with History active — the skeleton mirrors that when hasSpecs={false} so
// there is no visible tab jump.
describe('AssetDetailSkeleton — no-specs (2-tab) variant', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('renders NO specs tab and marks history active when hasSpecs=false', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton hasSpecs={false} />
      </I18nextProvider>,
    )
    const specsLabel   = i18n.t('assets:detail.tabs.specs')
    const historyLabel = i18n.t('assets:detail.tabs.history')
    const docsLabel    = i18n.t('assets:detail.tabs.docs')

    // Specs tab absent; history + docs present (2 tabs).
    expect(screen.queryByText(specsLabel)).not.toBeInTheDocument()
    expect(screen.getAllByText(historyLabel).length).toBeGreaterThan(0)
    expect(screen.getAllByText(docsLabel).length).toBeGreaterThan(0)

    // History tab is the active one.
    const activeHistoryTabs = Array.from(document.querySelectorAll('[role="tab"][aria-selected="true"]'))
      .filter(el => (el.textContent ?? '').includes(historyLabel))
    expect(activeHistoryTabs.length).toBeGreaterThan(0)
  })

  it('falls back to the 3-tab specs variant when hasSpecs is undefined', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton />
      </I18nextProvider>,
    )
    expect(screen.getAllByText(i18n.t('assets:detail.tabs.specs')).length).toBeGreaterThan(0)
  })
})

// Finding 1: the real mobile view renders the 3 bottom-section cards (Назначение /
// Местонахождение / Ремонт) ONLY on the «Тех. характеристики» tab. A spec-less asset
// is normalized to the История tab → ZERO bottom cards. The skeleton must gate the
// trio on showSpecs so the no-specs mobile skeleton shows nothing below the history body.
describe('AssetDetailSkeleton — mobile bottom sections gated on specs', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('renders the mobile bottom-section cards by default (specs variant)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton />
      </I18nextProvider>,
    )
    expect(screen.getByTestId('skeleton-mobile-bottom-sections')).toBeInTheDocument()
  })

  it('omits the mobile bottom-section cards when hasSpecs=false (history variant)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton hasSpecs={false} />
      </I18nextProvider>,
    )
    expect(screen.queryByTestId('skeleton-mobile-bottom-sections')).not.toBeInTheDocument()
  })
})

// FIX 1: the real mobile no-specs history is <HistoryCard mobileBare /> → SectionCard
// noHeader → NO header row (icon + «ИСТОРИЯ» title + record count). The skeleton must
// mirror mobileBare exactly: section chrome > a single p-3.5 body (created-line +
// event rows), with ZERO header block. A previous skeleton rendered an extra header
// (flex justify-between px-3.5 py-3 border-b) that the real render never has.
describe('AssetDetailSkeleton — mobile no-specs history mirrors mobileBare (no header)', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('renders the mobile history body with no header block (single p-3.5 body only)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton hasSpecs={false} />
      </I18nextProvider>,
    )
    const body = screen.getByTestId('skeleton-mobile-history-body')
    // mobileBare → SectionCard noHeader → section has exactly ONE direct child (the body).
    expect(body.children.length).toBe(1)
    // That single child is the p-3.5 body wrapper (not a header/py-3/border-b block).
    const only = body.children[0] as HTMLElement
    expect(only.className).toContain('p-3.5')
    // No header-style row present inside the whole card (the removed block used py-3 border-b).
    expect(body.querySelector('.py-3.border-b')).toBeNull()
  })
})

// FIX 2: the real desktop TechSpecsCard always renders a parts-note FOOTER after the
// license block (bare=false, partsNote default true, onOpenParts supplied on desktop).
// Its note text + «Открыть Запчасти» button label are static t() strings, so the
// skeleton renders them REAL (P2) to avoid the panel growing when data arrives.
describe('AssetDetailSkeleton — desktop specs parts-note footer rendered real', () => {
  beforeAll(async () => { await i18n.changeLanguage('ru') })

  it('renders the real parts-note text and «Открыть Запчасти» button in the specs variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton hasSpecs />
      </I18nextProvider>,
    )
    // Static note text and button label appear (real, not shimmer).
    expect(screen.getAllByText(i18n.t('assets:detail.parts.note')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(i18n.t('assets:detail.parts.openParts')).length).toBeGreaterThan(0)
  })

  it('omits the parts-note footer in the no-specs (history) variant', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AssetDetailSkeleton hasSpecs={false} />
      </I18nextProvider>,
    )
    expect(screen.queryByText(i18n.t('assets:detail.parts.note'))).not.toBeInTheDocument()
    expect(screen.queryByText(i18n.t('assets:detail.parts.openParts'))).not.toBeInTheDocument()
  })
})
