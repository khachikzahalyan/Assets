import { BrowserRouter } from 'react-router-dom'
import '@/lib/i18n'
import { AuthProvider } from '@/contexts'
import { AppRoutes } from '@/config/routes'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
