import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/ui/loading-state'
import { AccessPendingPage } from '@/pages/AccessPendingPage'

/**
 * Layout route guard — wraps the shell tree.
 *
 * status==='loading'    → full-screen skeleton while auth resolves.
 * status==='signed-out' → redirect to /login.
 * status==='no-role'    → inline AccessPending page (authenticated but no role doc).
 * status==='ready'      → render the outlet (the authenticated app).
 */
export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <LoadingState rows={4} />
        </div>
      </div>
    )
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
