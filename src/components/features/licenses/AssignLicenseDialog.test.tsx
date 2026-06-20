/**
 * AssignLicenseDialog component tests.
 *
 * Covers scope-based validation: device requires assetId, employee requires employeeId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssignLicenseDialog } from './AssignLicenseDialog'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

function renderDialog(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <AssignLicenseDialog
        open
        licenseId="lic_1"
        submitting={false}
        submitError={null}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </I18nextProvider>,
  )
}

/** Get the Save button (last primary button in the dialog). */
function getSaveBtn() {
  const buttons = screen.getAllByRole('button')
  return buttons[buttons.length - 1]!
}

describe('AssignLicenseDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  it('does not render when closed', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AssignLicenseDialog
          open={false}
          licenseId="lic_1"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(container.firstChild).toBeNull()
  })

  // ── scope=employee ─────────────────────────────────────────────────────────

  it('blocks submit and shows employeeRequires validation when employeeId is empty', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderDialog(onSubmit)
    // Default scope is 'employee'

    // Act — click save without filling employeeId
    fireEvent.click(getSaveBtn())

    // Assert — validation message shown, onSubmit not called
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Укажите сотрудника')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with { to: "employee", employeeId } when employee scope filled', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderDialog(onSubmit)
    // Default scope is employee

    // Act — fill the employeeId field and submit
    const idInput = screen.getByPlaceholderText('#id')
    fireEvent.change(idInput, { target: { value: 'emp-42' } })
    fireEvent.click(getSaveBtn())

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ to: 'employee', employeeId: 'emp-42' })
  })

  // ── scope=device ───────────────────────────────────────────────────────────

  it('blocks submit and shows deviceRequiresAsset validation when assetId is empty', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderDialog(onSubmit)

    // Act — change scope to 'device'
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'device' } })

    // Click save without filling assetId
    fireEvent.click(getSaveBtn())

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Для назначения на устройство укажите актив')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with { to: "device", assetId } when device scope and assetId filled', () => {
    // Arrange
    const onSubmit = vi.fn()
    renderDialog(onSubmit)

    // Act — change scope to 'device', fill assetId
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'device' } })
    const idInput = screen.getByPlaceholderText('#id')
    fireEvent.change(idInput, { target: { value: 'asset-99' } })
    fireEvent.click(getSaveBtn())

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({ to: 'device', assetId: 'asset-99' })
  })
})
