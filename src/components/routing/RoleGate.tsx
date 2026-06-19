import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { defaultRouteForRole } from '@/config/nav'
import type { Role } from '@/config/roles'

export interface RoleGateProps {
  roles: Role[]
  children: ReactNode
}

/**
 * Renders children when the current user's role is in the allow-list.
 * Otherwise redirects to the default route for the user's actual role.
 *
 * Must only be rendered inside <RequireAuth> (status==='ready' is guaranteed).
 */
export function RoleGate({ roles, children }: RoleGateProps) {
  const { role } = useAuth()

  if (roles.includes(role)) {
    return <>{children}</>
  }

  // defaultRouteForRole returns a bare RouteId (no leading slash) — template literal ensures correct path
  return <Navigate to={`/${defaultRouteForRole(role)}`} replace />
}
