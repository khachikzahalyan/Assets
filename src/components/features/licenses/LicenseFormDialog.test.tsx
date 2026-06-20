/**
 * LicenseFormDialog component tests.
 *
 * Covers: workstation create (name required, onSubmit payload), masked preview.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { LicenseFormDialog } from './LicenseFormDialog'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

function renderWorkstationDialog(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <LicenseFormDialog
        open
        kind="workstation"
        submitting={false}
        submitError={null}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </I18nextProvider>,
  )
}

/** Get the Save button (last button in the dialog footer). */
function getSaveBtn() {
  const buttons = screen.getAllByRole('button')
  return buttons[buttons.length - 1]!
}

describe('LicenseFormDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('does not render when closed', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <LicenseFormDialog
          open={false}
          kind="workstation"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })

  // ── Name required validation ───────────────────────────────────────────────

  it('blocks submit when name is empty and shows required validation', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderWorkstationDialog(onSubmit)

    // Act — click save without filling name
    fireEvent.click(getSaveBtn())

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // ── Workstation create happy path ─────────────────────────────────────────

  it('calls onSubmit with name when workstation form filled', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderWorkstationDialog(onSubmit)

    // Act — fill the name field (first textbox) and submit
    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0]!, { target: { value: 'Microsoft Office 365' } })
    fireEvent.click(getSaveBtn())

    // Assert — onSubmit called with name; kind=workstation
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Microsoft Office 365', kind: 'workstation' }),
    )
  })

  it('trims whitespace from name before calling onSubmit', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderWorkstationDialog(onSubmit)

    // Act
    const textboxes = screen.getAllByRole('textbox')
    fireEvent.change(textboxes[0]!, { target: { value: '  Office 365  ' } })
    fireEvent.click(getSaveBtn())

    // Assert
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Office 365' }),
    )
  })

  // ── Server type i18n ──────────────────────────────────────────────────────

  it('server type Select renders i18n-resolved labels, not raw enum strings', () => {
    // Arrange — expected label is whatever the active locale resolves for 'serverType.Server'
    const expectedLabel = i18n.t('serverType.Server', { ns: 'licenses' })

    render(
      <I18nextProvider i18n={i18n}>
        <LicenseFormDialog
          open
          kind="server"
          submitting={false}
          submitError={null}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )

    // Act — the server type <select> contains <option> elements rendered from serverTypeOptions
    const typeSelect = document.getElementById('lic-server-type') as HTMLSelectElement
    expect(typeSelect).not.toBeNull()

    // Assert — the first option text equals the locale-resolved value (ru: "Серверная")
    const optionTexts = Array.from(typeSelect.options).map(o => o.text)
    expect(optionTexts).toContain(expectedLabel)

    // Assert — the raw enum string 'Server' is NOT used as an option label
    // (in the ru locale the label is 'Серверная', not 'Server')
    expect(expectedLabel).not.toBe('Server')
  })

  // ── Masked key preview ────────────────────────────────────────────────────

  it('shows a masked preview when a rawKey is typed that does NOT equal the raw input', () => {
    // Arrange
    const RAW_KEY = 'XCVF-7TR5-9HJK-5592'
    renderWorkstationDialog()

    // Act — find the "Лицензионный ключ" input (mono textbox) and type a raw key
    // The raw key field is after the name, vendor, and type fields.
    const textboxes = screen.getAllByRole('textbox')
    // Find by iterating — the raw key field is the last mono textbox before submit
    const rawKeyInput = textboxes[textboxes.length - 1]!
    fireEvent.change(rawKeyInput, { target: { value: RAW_KEY } })

    // Assert — the preview shows some masked form containing '*'
    // "Превью: ****-****-****-5592" should be visible
    const preview = screen.getByText(/Превью:/i)
    expect(preview).toBeInTheDocument()
    expect(preview.textContent).toContain('*')

    // Assert — the raw key itself does NOT appear in the preview text
    expect(preview.textContent).not.toBe(`Превью: ${RAW_KEY}`)
    expect(preview.textContent).not.toContain('XCVF')
    expect(preview.textContent).not.toContain('7TR5')
  })
})
