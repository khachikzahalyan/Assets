import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { AuthSettingsPanel } from './AuthSettingsPanel'
import { InMemoryAuthSettingsRepository } from '@/infra/repositories'
import ruSettings from '@/locales/ru/settings.json'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }),
}))

function makeRepo(domains: string[] = ['acme.com']) {
  return new InMemoryAuthSettingsRepository({ allowedEmailDomains: domains })
}

/** Finds the add-domain input by id (stable regardless of i18n locale). */
function getAddInput() {
  return document.querySelector('#auth-add-domain') as HTMLInputElement
}

/** Finds the remove button for a domain by iterating list items. */
function getRemoveBtn(domain: string) {
  const items = document.querySelectorAll('ul li')
  for (const li of Array.from(items)) {
    if (li.textContent?.includes(domain)) {
      return li.querySelector('button') as HTMLButtonElement
    }
  }
  throw new Error(`Remove button for domain "${domain}" not found`)
}

/** Finds the Save button by querying the primary-variant button in the footer. */
function getSaveBtn() {
  // The Save button is the only primary button outside the dialog
  const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
  // Filter to button with the orange primary class
  return btns.find(b => b.className.includes('bg-[#F97316]') && !document.querySelector('[role="dialog"]')?.contains(b))
    ?? btns.find(b => b.className.includes('bg-[#F97316]'))!
}

/** Finds the Add button (the secondary btn next to the input). */
function getAddBtn() {
  const field = document.querySelector('#auth-add-domain')?.closest('div.flex')
  if (field) {
    return field.querySelector('button') as HTMLButtonElement
  }
  // Fallback: secondary btn in the add-row area
  const btns = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
  return btns.find(b => !b.className.includes('bg-[#F97316]') && !b.closest('[role="dialog"]'))!
}

describe('AuthSettingsPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  // 1. renders the current domain after load
  it('renders the current domain after load', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    expect(await screen.findByText('acme.com')).toBeInTheDocument()
  })

  // 2. add a valid domain → appears; Save becomes enabled (dirty)
  it('adds a valid domain and enables Save', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')

    fireEvent.change(getAddInput(), { target: { value: 'beta.io' } })
    fireEvent.click(getAddBtn())

    await waitFor(() => expect(screen.getByText('beta.io')).toBeInTheDocument())
    expect(getSaveBtn()).not.toBeDisabled()
  })

  // 3. invalid domain → inline error alert; list unchanged
  it('shows validation error for an invalid domain and does not add it', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')

    fireEvent.change(getAddInput(), { target: { value: 'nope' } })
    fireEvent.click(getAddBtn())

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]')
      expect(alerts.length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('nope')).not.toBeInTheDocument()
  })

  // 4. duplicate domain → inline duplicate error; list unchanged (still only 1 item)
  it('shows duplicate error and does not add a duplicate', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // Add same domain in uppercase
    fireEvent.change(getAddInput(), { target: { value: 'ACME.com' } })
    fireEvent.click(getAddBtn())

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]')
      expect(alerts.length).toBeGreaterThan(0)
    })
    // Still exactly one domain row
    const listItems = document.querySelectorAll('ul li')
    expect(listItems.length).toBe(1)
  })

  // 5. remove the only domain → fail-closed banner appears
  it('shows fail-closed banner when all domains are removed', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')

    fireEvent.click(getRemoveBtn('acme.com'))

    await waitFor(() => {
      // fail-closed banner has role="alert"
      const banners = document.querySelectorAll('[role="alert"]')
      expect(banners.length).toBeGreaterThan(0)
      // The list should be gone
      expect(screen.queryByText('acme.com')).not.toBeInTheDocument()
    })
  })

  // 6. non-empty Save → standard confirm (no token input); confirm → repo called; panel cleans up
  it('shows standard confirm dialog for non-empty save and commits', async () => {
    const repo = makeRepo()
    const updateSpy = vi.spyOn(repo, 'updateAllowedDomains')
    render(<MemoryRouter><AuthSettingsPanel repository={repo} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // Make it dirty by adding a domain
    fireEvent.change(getAddInput(), { target: { value: 'beta.io' } })
    fireEvent.click(getAddBtn())
    await screen.findByText('beta.io')

    // Open dialog
    fireEvent.click(getSaveBtn())

    // Standard confirm dialog — no token input
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeInTheDocument()
    })
    expect(document.querySelector('#danger-confirm-token')).not.toBeInTheDocument()

    // Click the confirm (last button in dialog)
    const dialogEl = document.querySelector('[role="dialog"]')!
    const dialogBtns = Array.from(dialogEl.querySelectorAll('button')) as HTMLButtonElement[]
    // The last button is the primary confirm
    const lastBtn = dialogBtns[dialogBtns.length - 1]!
    fireEvent.click(lastBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['acme.com', 'beta.io']),
        expect.objectContaining({ uid: 'u_super', role: 'super_admin' }),
      )
    })

    // Dialog closes and Save is disabled
    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument()
    })
    expect(getSaveBtn()).toBeDisabled()
  })

  // 7. empty-list Save → danger confirm with token; disabled until correct token typed; confirm → repo([])
  it('danger confirm: disabled until correct token typed, then calls repo with []', async () => {
    const repo = makeRepo()
    const updateSpy = vi.spyOn(repo, 'updateAllowedDomains')
    render(<MemoryRouter><AuthSettingsPanel repository={repo} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // Remove the only domain
    fireEvent.click(getRemoveBtn('acme.com'))
    await waitFor(() => expect(screen.queryByText('acme.com')).not.toBeInTheDocument())

    // Click Save — should open danger dialog
    fireEvent.click(getSaveBtn())

    // Danger dialog has the token input
    await waitFor(() => {
      expect(document.querySelector('#danger-confirm-token')).toBeInTheDocument()
    })

    const dialogEl = document.querySelector('[role="dialog"]')!
    const dialogBtns = Array.from(dialogEl.querySelectorAll('button')) as HTMLButtonElement[]
    const confirmBtn = dialogBtns[dialogBtns.length - 1]!

    // Confirm button is disabled initially
    expect(confirmBtn).toBeDisabled()

    // Wrong token → still disabled
    const tokenInput = document.querySelector('#danger-confirm-token') as HTMLInputElement
    fireEvent.change(tokenInput, { target: { value: 'WRONG' } })
    expect(confirmBtn).toBeDisabled()

    // Type the resolved token value from the ru locale (e.g. "DISABLE").
    // Importing from the JSON keeps this test in sync if the token ever changes.
    const tokenValue = ruSettings.dangerConfirm.token
    fireEvent.change(tokenInput, { target: { value: tokenValue } })

    await waitFor(() => expect(confirmBtn).not.toBeDisabled())

    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ uid: 'u_super', role: 'super_admin' }),
      )
    })
  })

  // 8. Save is disabled when not dirty
  it('Save is disabled in the initial (clean) state', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')
    expect(getSaveBtn()).toBeDisabled()
  })

  // 9. cancelling the standard confirm dialog does NOT call updateAllowedDomains
  //    and leaves working list unchanged
  it('cancelling standard confirm does not call repo and leaves list unchanged', async () => {
    const repo = makeRepo()
    const updateSpy = vi.spyOn(repo, 'updateAllowedDomains')
    render(<MemoryRouter><AuthSettingsPanel repository={repo} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // arrange: make it dirty by adding a domain
    fireEvent.change(getAddInput(), { target: { value: 'beta.io' } })
    fireEvent.click(getAddBtn())
    await screen.findByText('beta.io')

    // act: open dialog then click Cancel
    fireEvent.click(getSaveBtn())
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeInTheDocument())

    const dialogEl = document.querySelector('[role="dialog"]')!
    const dialogBtns = Array.from(dialogEl.querySelectorAll('button')) as HTMLButtonElement[]
    // The first button in dialog is Cancel (secondary)
    const cancelBtn = dialogBtns[0]!
    fireEvent.click(cancelBtn)

    // assert: dialog closed, repo NOT called, working list still shows both domains
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument())
    expect(updateSpy).not.toHaveBeenCalled()
    expect(screen.getByText('acme.com')).toBeInTheDocument()
    expect(screen.getByText('beta.io')).toBeInTheDocument()
    // Save is still enabled (still dirty)
    expect(getSaveBtn()).not.toBeDisabled()
  })

  // 10. normalization on add: raw URL-like input is stripped to the bare host
  it('normalizes a URL-style input to the bare hostname before adding', async () => {
    render(<MemoryRouter><AuthSettingsPanel repository={makeRepo()} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // arrange: type a URL with scheme + www prefix + path
    fireEvent.change(getAddInput(), { target: { value: 'HTTPS://WWW.Beta.IO/login' } })
    fireEvent.click(getAddBtn())

    // assert: normalized form 'beta.io' appears; raw form does not
    await waitFor(() => expect(screen.getByText('beta.io')).toBeInTheDocument())
    expect(screen.queryByText('HTTPS://WWW.Beta.IO/login')).not.toBeInTheDocument()
    expect(screen.queryByText('www.beta.io')).not.toBeInTheDocument()
  })

  // 11. removing one of two domains keeps the other; no fail-closed banner
  it('removing one of two domains keeps the remaining domain and shows no fail-closed banner', async () => {
    const repo = makeRepo(['acme.com', 'beta.io'])
    render(<MemoryRouter><AuthSettingsPanel repository={repo} /></MemoryRouter>)
    await screen.findByText('acme.com')
    await screen.findByText('beta.io')

    // act: remove acme.com
    fireEvent.click(getRemoveBtn('acme.com'))

    // assert: acme.com gone, beta.io remains, no fail-closed banner
    await waitFor(() => expect(screen.queryByText('acme.com')).not.toBeInTheDocument())
    expect(screen.getByText('beta.io')).toBeInTheDocument()
    // fail-closed banner only appears when list is completely empty
    const banners = document.querySelectorAll('[role="alert"]')
    expect(banners.length).toBe(0)
  })

  // 12. after a successful non-empty save, Save is DISABLED and the persisted list is shown
  it('after successful non-empty save Save is disabled and persisted list is shown', async () => {
    const repo = makeRepo(['acme.com'])
    const updateSpy = vi.spyOn(repo, 'updateAllowedDomains')
    render(<MemoryRouter><AuthSettingsPanel repository={repo} /></MemoryRouter>)
    await screen.findByText('acme.com')

    // arrange: make it dirty
    fireEvent.change(getAddInput(), { target: { value: 'beta.io' } })
    fireEvent.click(getAddBtn())
    await screen.findByText('beta.io')
    expect(getSaveBtn()).not.toBeDisabled()

    // act: open dialog and confirm
    fireEvent.click(getSaveBtn())
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeInTheDocument())
    const dialogEl = document.querySelector('[role="dialog"]')!
    const dialogBtns = Array.from(dialogEl.querySelectorAll('button')) as HTMLButtonElement[]
    const confirmBtn = dialogBtns[dialogBtns.length - 1]!
    fireEvent.click(confirmBtn)

    // assert: repo was called, Save goes back to disabled (clean state)
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        expect.arrayContaining(['acme.com', 'beta.io']),
        expect.objectContaining({ uid: 'u_super', role: 'super_admin' }),
      ),
    )
    await waitFor(() => expect(getSaveBtn()).toBeDisabled())
    // Both domains are visible (persisted value reflected in working list)
    expect(screen.getByText('acme.com')).toBeInTheDocument()
    expect(screen.getByText('beta.io')).toBeInTheDocument()
  })
})
