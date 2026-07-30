import { BrowserRouter } from 'react-router-dom'
import '@/lib/i18n'
import { AuthProvider } from '@/contexts'
import type { Role } from '@/config/roles'
import { ToastProvider } from '@/contexts/ToastContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AppRoutes } from '@/config/routes'

// E2E/dev seam: VITE_E2E_ROLE activates the mock auth path (same seam tests
// use via initialRole). Unset in production — real Firebase auth runs.
const E2E_ROLE = import.meta.env.VITE_E2E_ROLE as Role | undefined

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider {...(E2E_ROLE ? { initialRole: E2E_ROLE } : {})}>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
