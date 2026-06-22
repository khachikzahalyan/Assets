import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
  const { showToast } = useToast()
  return <button onClick={() => showToast('Сотрудник добавлен')}>fire</button>
}

it('shows a toast then auto-dismisses', () => {
  vi.useFakeTimers()
  render(<ToastProvider><Trigger /></ToastProvider>)
  act(() => { screen.getByText('fire').click() })
  expect(screen.getByRole('status')).toHaveTextContent('Сотрудник добавлен')
  act(() => { vi.advanceTimersByTime(3100) })
  expect(screen.queryByRole('status')).toBeNull()
  vi.useRealTimers()
})
