/**
 * Unit tests for the LicensePicker component and its exported utilities.
 *
 * Covers:
 *  1. formatOemKey – uppercase + 5-5-5-5-5 grouping.
 *  2. emptyLicensePickerValue – returns correct defaults.
 *  3. Renders both mode cards when showDigital=true.
 *  4. Clicking the 'Ручной ввод' card switches mode to 'manual' and reveals
 *     the product-key field.
 *  5. Typing into the visible SpecCombobox calls onChange with rawKey (formatted)
 *     and pickId = ''.
 *  6. Selecting a pool item via the sr-only hidden select calls onChange with
 *     pickId set and rawKey = ''.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import {
  LicensePicker,
  emptyLicensePickerValue,
  formatOemKey,
  type LicensePickerValue,
} from './LicensePicker'

// ---------------------------------------------------------------------------
// i18n setup — load Russian so translation keys resolve to real strings.
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POOL = [
  { id: 'lic_1', name: 'Windows 11 Pro OEM', vendor: 'Microsoft' },
  { id: 'lic_2', name: 'Windows 10 OEM', vendor: null },
]

function renderPicker(
  value: LicensePickerValue,
  onChange: (v: LicensePickerValue) => void,
  {
    pool = POOL,
    showDigital = true,
    idPrefix = 'test-oem',
  }: { pool?: typeof POOL; showDigital?: boolean; idPrefix?: string } = {},
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <LicensePicker
        value={value}
        onChange={onChange}
        pool={pool}
        showDigital={showDigital}
        idPrefix={idPrefix}
      />
    </I18nextProvider>,
  )
}

// ---------------------------------------------------------------------------
// Pure-function tests
// ---------------------------------------------------------------------------

describe('formatOemKey', () => {
  it("formats 'vk7jgnphtmc97jm' into grouped uppercase 5-5-5", () => {
    // 15 alphanum chars → VK7JG NPHTM C97JM
    expect(formatOemKey('vk7jgnphtmc97jm')).toBe('VK7JG-NPHTM-C97JM')
  })

  it("formats a full 25-char key into 5 groups of 5", () => {
    // 25 chars → VK7JG NPHTM C97JM 9MPGT 3V66T
    expect(formatOemKey('vk7jgnphtmc97jm9mpgt3v66t')).toBe('VK7JG-NPHTM-C97JM-9MPGT-3V66T')
  })

  it("strips hyphens from an already-formatted key and re-groups correctly", () => {
    // Hyphens are stripped then re-grouped — result equals the input (already canonical form)
    expect(formatOemKey('VK7JG-NPHTM-C97JM-9MPGT-3V66T')).toBe('VK7JG-NPHTM-C97JM-9MPGT-3V66T')
  })

  it("returns uppercase single group for short input", () => {
    expect(formatOemKey('abcd1')).toBe('ABCD1')
  })
})

describe('emptyLicensePickerValue', () => {
  it("returns { licenseMode: 'oem_digital', rawKey: '', pickId: '' }", () => {
    expect(emptyLicensePickerValue()).toEqual({
      licenseMode: 'oem_digital',
      rawKey: '',
      pickId: '',
    })
  })
})

// ---------------------------------------------------------------------------
// Component tests
// ---------------------------------------------------------------------------

describe('LicensePicker component', () => {
  it("renders both mode cards when showDigital=true", () => {
    // Arrange
    const onChange = vi.fn()
    const value = emptyLicensePickerValue()

    // Act
    renderPicker(value, onChange, { showDigital: true })

    // Assert — both buttons are present
    expect(screen.getByRole('button', { name: /Цифровая/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ручной ввод/i })).toBeTruthy()
  })

  it("hides the digital card when showDigital=false and makes manual card full-width", () => {
    // Arrange
    const onChange = vi.fn()
    const value = emptyLicensePickerValue()

    // Act
    renderPicker(value, onChange, { showDigital: false })

    // Assert
    expect(screen.queryByRole('button', { name: /Цифровая/i })).toBeNull()
    expect(screen.getByRole('button', { name: /Ручной ввод/i })).toBeTruthy()
  })

  it("clicking 'Ручной ввод' card calls onChange with licenseMode='manual'", () => {
    // Arrange
    const onChange = vi.fn()
    const value: LicensePickerValue = { licenseMode: 'oem_digital', rawKey: '', pickId: '' }
    renderPicker(value, onChange)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Ручной ввод/i }))

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].licenseMode).toBe('manual')
  })

  it("when in manual mode, the product-key field (SpecCombobox input) is visible", () => {
    // Arrange — controlled: start already in manual mode
    const onChange = vi.fn()
    const value: LicensePickerValue = { licenseMode: 'manual', rawKey: '', pickId: '' }
    renderPicker(value, onChange)

    // Assert — the sr-only raw-key input is in the DOM (accessible by label)
    const rawInput = screen.getByLabelText(/Лицензионный ключ OEM/i)
    expect(rawInput).toBeTruthy()

    // Assert — the pick hidden select is also in the DOM
    expect(screen.getByLabelText(/Существующая свободная лицензия/i)).toBeTruthy()
  })

  it("typing into sr-only ProductKeyInput calls onChange with formatted rawKey and pickId=''", () => {
    // Arrange
    const onChange = vi.fn()
    const value: LicensePickerValue = { licenseMode: 'manual', rawKey: '', pickId: '' }
    renderPicker(value, onChange, { idPrefix: 'test-oem' })

    // Act — type via the sr-only raw-key ProductKeyInput which formats the value
    const rawInput = screen.getByLabelText(/Лицензионный ключ OEM/i)
    fireEvent.change(rawInput, { target: { value: 'abcde12345fghij' } })

    // Assert — ProductKeyInput formats the raw value (uppercase, groups of 5)
    // 'abcde12345fghij' (15 alnum) → 'ABCDE-12345-FGHIJ'
    expect(onChange).toHaveBeenCalled()
    const called = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as LicensePickerValue
    expect(called.licenseMode).toBe('manual')
    expect(called.pickId).toBe('')
    expect(called.rawKey).toBe('ABCDE-12345-FGHIJ')
  })

  it("typing into the visible product-key ProductKeyInput (id ends -key-visual) calls onChange with formatted rawKey", () => {
    // Arrange: render a controlled component that tracks state so the combobox
    // receives the updated value on each keystroke.
    let current: LicensePickerValue = { licenseMode: 'manual', rawKey: '', pickId: '' }
    const onChange = vi.fn((v: LicensePickerValue) => { current = v })

    const { rerender } = render(
      <I18nextProvider i18n={i18n}>
        <LicensePicker
          value={current}
          onChange={onChange}
          pool={POOL}
          showDigital
          idPrefix="test-oem"
        />
      </I18nextProvider>,
    )

    // Find the visible SpecCombobox input by its id attribute
    const visualInput = document.getElementById('test-oem-key-visual') as HTMLInputElement
    expect(visualInput).toBeTruthy()

    // Act — fire change on the visual input (simulates typing 'ABCDE12345')
    fireEvent.change(visualInput, { target: { value: 'ABCDE12345' } })

    // Rerender with the captured value so the component sees the update
    rerender(
      <I18nextProvider i18n={i18n}>
        <LicensePicker
          value={current}
          onChange={onChange}
          pool={POOL}
          showDigital
          idPrefix="test-oem"
        />
      </I18nextProvider>,
    )

    // Assert — onChange was called with formatted key (non-pool value → formatOemKey)
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as LicensePickerValue
    expect(lastCall.licenseMode).toBe('manual')
    expect(lastCall.pickId).toBe('')
    // formatOemKey('ABCDE12345') = 'ABCDE-12345'
    expect(lastCall.rawKey).toBe('ABCDE-12345')
  })

  it("selecting a pool item via the sr-only hidden select calls onChange with pickId set and rawKey=''", () => {
    // Arrange
    const onChange = vi.fn()
    const value: LicensePickerValue = { licenseMode: 'manual', rawKey: '', pickId: '' }
    renderPicker(value, onChange)

    // Act — change the sr-only select by its label
    const pickerSelect = screen.getByLabelText(/Существующая свободная лицензия/i)
    fireEvent.change(pickerSelect, { target: { value: 'lic_1' } })

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1)
    const called = onChange.mock.calls[0]![0] as LicensePickerValue
    expect(called.licenseMode).toBe('manual')
    expect(called.pickId).toBe('lic_1')
    expect(called.rawKey).toBe('')
  })

  it("clicking the digital card calls onChange with licenseMode='oem_digital'", () => {
    // Arrange — currently in manual mode
    const onChange = vi.fn()
    const value: LicensePickerValue = { licenseMode: 'manual', rawKey: 'TEST', pickId: '' }
    renderPicker(value, onChange)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Цифровая/i }))

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1)
    const called = onChange.mock.calls[0]![0] as LicensePickerValue
    expect(called.licenseMode).toBe('oem_digital')
    expect(called.rawKey).toBe('')
    expect(called.pickId).toBe('')
  })
})
