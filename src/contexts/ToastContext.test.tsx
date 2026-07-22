import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
  const { showToast } = useToast()
  return (
    <>
      <button onClick={() => showToast('Сотрудник добавлен')}>fire-success</button>
      <button onClick={() => showToast('Ошибка сохранения', { variant: 'error' })}>fire-error</button>
    </>
  )
}

it('shows a success toast with role=status and check icon, then auto-dismisses', () => {
  vi.useFakeTimers()
  render(<ToastProvider><Trigger /></ToastProvider>)
  act(() => { screen.getByText('fire-success').click() })
  const statusEl = screen.getByRole('status')
  expect(statusEl).toHaveTextContent('Сотрудник добавлен')
  // Must NOT have role="alert"
  expect(screen.queryByRole('alert')).toBeNull()
  act(() => { vi.advanceTimersByTime(3100) })
  expect(screen.queryByRole('status')).toBeNull()
  vi.useRealTimers()
})

it('shows an error toast with role=alert and NOT the emerald check', () => {
  vi.useFakeTimers()
  render(<ToastProvider><Trigger /></ToastProvider>)
  act(() => { screen.getByText('fire-error').click() })
  const alertEl = screen.getByRole('alert')
  expect(alertEl).toHaveTextContent('Ошибка сохранения')
  // Must NOT render a success/status role
  expect(screen.queryByRole('status')).toBeNull()
  // The icon container must use rose tones, not emerald
  expect(alertEl.innerHTML).not.toMatch(/bg-emerald/)
  expect(alertEl.innerHTML).toMatch(/bg-rose/)
  act(() => { vi.advanceTimersByTime(3100) })
  expect(screen.queryByRole('alert')).toBeNull()
  vi.useRealTimers()
})
