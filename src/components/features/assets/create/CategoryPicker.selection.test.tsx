import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { CategoryPicker } from './CategoryPicker'
import type { CategoryRow } from '@/domain/asset'

/**
 * Desktop selection regression: the portal dropdown must carry ref={portalRef}
 * so useDismissOnOutside treats a press INSIDE it as "inside". Without the ref a
 * real browser's mousedown (which precedes the click) was seen as an outside
 * press and closed the dropdown before the option's onClick fired — so no
 * category could ever be picked manually. jsdom's fireEvent.click (click only,
 * no mousedown) masked this, which is why prior tests passed. This test drives
 * the true mousedown → click sequence.
 */

const CATS: CategoryRow[] = [
  { id: 'c_ap', name: 'Точка доступа', group: 'network', categoryGroupId: 'g_net', lucideIcon: 'wifi' },
  { id: 'c_fw', name: 'Файрвол', group: 'network', categoryGroupId: 'g_net', lucideIcon: 'shield' },
]

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderPicker() {
  const onChange = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <CategoryPicker categories={CATS} value="" onChange={onChange} categoryGroupId="g_net" />
    </I18nextProvider>,
  )
  return onChange
}

describe('CategoryPicker — desktop selection', () => {
  it('a mousedown on an option does NOT dismiss the dropdown, and the click selects', () => {
    const onChange = renderPicker()

    // Open the dropdown via the combobox trigger.
    fireEvent.click(screen.getByRole('combobox'))
    const option = screen.getByText('Файрвол')

    // Real browser order: mousedown fires first. With the portalRef missing this
    // closed the dropdown (outside-press) and the option vanished before onClick.
    fireEvent.mouseDown(option)
    expect(screen.getByText('Файрвол')).toBeInTheDocument() // dropdown still open

    fireEvent.click(option)
    expect(onChange).toHaveBeenCalledWith('c_fw')
  })
})
