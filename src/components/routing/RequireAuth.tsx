import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { AppLoader } from '@/components/ui/AppLoader'
import { AccessPendingPage } from '@/pages/auth/AccessPendingPage'

/**
 * Layout route guard — wraps the shell tree.
 *
 * status==='loading'    → full-screen branded loader while auth resolves.
 * status==='signed-out' → redirect to /login.
 * status==='no-role'    → inline AccessPending page (authenticated but no role doc).
 * status==='ready'      → render the outlet (the authenticated app).
 */
export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <AppLoader fullScreen />
  }

  if (status === 'signed-out') {
    return <Navigate to="/login" replace />
  }

  if (status === 'no-role') {
    return <AccessPendingPage />
  }

  // status === 'ready'
  return <Outlet />
}
