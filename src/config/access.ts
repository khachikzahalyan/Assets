import type { Role } from './roles'
import type { RouteId } from './nav'
import { ADMIN_NAV, EMPLOYEE_NAV } from './nav'

/** Flattened route→allowed-roles map, derived from nav config so nav gating and
 *  route access control can never diverge. */
const ROUTE_ROLES: Record<string, Role[]> = (() => {
  const map: Record<string, Role[]> = {}
  for (const group of [...ADMIN_NAV, ...EMPLOYEE_NAV]) {
    for (const item of group.items) map[item.id] = item.allow
  }
  // dashboard is also the admin landing; profile is employee self-service.
  return map
})()

export function routeRoles(routeId: RouteId): Role[] {
  return ROUTE_ROLES[routeId] ?? []
}

export function canAccess(role: Role, routeId: RouteId): boolean {
  return routeRoles(routeId).includes(role)
}
