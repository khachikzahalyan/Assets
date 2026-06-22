import { BrowserRouter } from 'react-router-dom'
import '@/lib/i18n'
import { AuthProvider } from '@/contexts'
import { ToastProvider } from '@/contexts/ToastContext'
import { AppRoutes } from '@/config/routes'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
