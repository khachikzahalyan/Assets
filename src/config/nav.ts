import type { Role } from './roles'

export type RouteId =
  | 'dashboard' | 'assets' | 'licenses' | 'parts'
  | 'employees' | 'branches' | 'departments' | 'categories' | 'roles'
  | 'audit' | 'settings' | 'my-assets' | 'my-acts' | 'profile' | 'pending-users'
  | 'scan'

export interface NavItem {
  id: RouteId
  labelKey: string
  icon: string
  allow: Role[]
}

export interface NavGroup {
  id: string
  labelKey: string | null
  items: NavItem[]
}

export const ADMIN_NAV: NavGroup[] = [
  { id: 'main', labelKey: 'groups.main', items: [
    { id: 'dashboard', labelKey: 'items.dashboard', icon: 'layout-dashboard', allow: ['super_admin', 'asset_admin', 'tech_admin'] },
  ]},
  { id: 'ops', labelKey: 'groups.ops', items: [
    { id: 'assets',      labelKey: 'items.assets',      icon: 'package',          allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'licenses',    labelKey: 'items.licenses',    icon: 'key-round',        allow: ['super_admin', 'tech_admin'] },
    { id: 'parts',       labelKey: 'items.parts',       icon: 'cpu',              allow: ['super_admin', 'asset_admin', 'tech_admin'] },
  ]},
  { id: 'org', labelKey: 'groups.org', items: [
    { id: 'employees',   labelKey: 'items.employees',   icon: 'users',   allow: ['super_admin', 'asset_admin'] },
    { id: 'branches',    labelKey: 'items.branches',    icon: 'building', allow: ['super_admin', 'asset_admin'] },
    { id: 'departments', labelKey: 'items.departments', icon: 'network', allow: ['super_admin', 'asset_admin'] },
  ]},
  { id: 'catalogs', labelKey: 'groups.catalogs', items: [
    { id: 'categories', labelKey: 'items.categories', icon: 'tags',         allow: ['super_admin'] },
    { id: 'roles',      labelKey: 'items.roles',      icon: 'shield-check', allow: ['super_admin'] },
  ]},
  { id: 'system', labelKey: 'groups.system', items: [
    { id: 'scan',          labelKey: 'items.scan',          icon: 'scan-line', allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'pending-users', labelKey: 'items.pending-users', icon: 'user-plus', allow: ['super_admin'] },
    { id: 'audit',    labelKey: 'items.audit',    icon: 'history',  allow: ['super_admin'] },
    { id: 'settings', labelKey: 'items.settings', icon: 'settings', allow: ['super_admin'] },
  ]},
]

export const EMPLOYEE_NAV: NavGroup[] = [
  { id: 'employee', labelKey: null, items: [
    { id: 'my-assets', labelKey: 'items.my-assets', icon: 'package',     allow: ['employee'] },
    { id: 'my-acts',   labelKey: 'items.my-acts',   icon: 'file-text',   allow: ['employee'] },
    { id: 'profile',   labelKey: 'items.profile',   icon: 'user-circle', allow: ['employee'] },
  ]},
]

/**
 * Role-filtered navigation. NOTE: this is UX only — it hides items a role
 * cannot use. It is NOT a security control. Real enforcement is Firestore
 * rules + route guards (later plans).
 */
export function navForRole(role: Role): NavGroup[] {
  if (role === 'employee') return EMPLOYEE_NAV
  return ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter((it) => it.allow.includes(role)) }))
    .filter((g) => g.items.length > 0)
}

/**
 * Returns the default landing RouteId for a given role.
 * INVARIANT: returns a bare RouteId with NO leading slash — callers must prepend '/'.
 */
export function defaultRouteForRole(role: Role): RouteId {
  return role === 'employee' ? 'my-assets' : 'dashboard'
}

/**
 * Priority order for the mobile bottom tab bar (admin roles).
 * The first ≤5 items from this list that the role is allowed to see
 * become the tab bar items.
 */
const ADMIN_MOBILE_ORDER: readonly RouteId[] = [
  'dashboard', 'assets', 'employees', 'scan', 'settings', 'licenses', 'parts',
]

/**
 * Returns the primary navigation items for the mobile bottom tab bar.
 * - Admin roles: up to 5 items from ADMIN_MOBILE_ORDER, filtered by role permission.
 * - Employee role: the full employee nav (3 items).
 *
 * Results per role:
 *   super_admin  → dashboard, assets, employees, scan, settings
 *   asset_admin  → dashboard, assets, employees, scan, parts
 *   tech_admin   → dashboard, assets, scan, licenses, parts
 *   employee     → my-assets, my-acts, profile
 */
export function mobilePrimaryNav(role: Role): NavItem[] {
  const groups = navForRole(role)
  const all: NavItem[] = groups.flatMap((g) => g.items)
  if (role === 'employee') return all
  return ADMIN_MOBILE_ORDER
    .map((id) => all.find((it) => it.id === id))
    .filter((it): it is NavItem => it != null)
    .slice(0, 5)
}
