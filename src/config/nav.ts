import type { Role } from './roles'

/** Shared allow list: "My assets" is visible to ALL roles — admins can personally hold assets. */
export const MY_ASSETS_ALLOW: Role[] = ['super_admin', 'asset_admin', 'tech_admin', 'employee']

export type RouteId =
  | 'dashboard' | 'assets' | 'licenses' | 'parts'
  | 'employees' | 'branches' | 'departments' | 'categories' | 'roles'
  | 'audit' | 'settings' | 'my-assets' | 'my-acts' | 'profile'
  | 'scan'

export interface NavItem {
  id: RouteId
  labelKey: string
  icon: string
  allow: Role[]
}

/**
 * accent — hex color for the group's visual accent (icon tint, active bg/border).
 * null for the employee nav group which has no group header and no accent.
 * These are design-palette constants; they do NOT change with light/dark mode —
 * the Sidebar renders them at reduced alpha so they work on either background.
 */
export interface NavGroup {
  id: string
  labelKey: string | null
  /** Design accent hex for this group. null = employee group (no accent, uses orange). */
  accent: string | null
  items: NavItem[]
}

/**
 * Nav accent — owner decision 2026-08-06: no per-group palette, every group
 * uses the brand orange (--color-accent #F97316). The per-group shape is kept
 * so a future palette change stays a one-line-per-group edit; values are
 * consumed as inline CSS custom properties with computed alpha variants.
 */
export const NAV_GROUP_ACCENTS = {
  main:     '#F97316',
  ops:      '#F97316',
  org:      '#F97316',
  catalogs: '#F97316',
  system:   '#F97316',
} as const

export const ADMIN_NAV: NavGroup[] = [
  { id: 'main', labelKey: 'groups.main', accent: NAV_GROUP_ACCENTS.main, items: [
    { id: 'dashboard', labelKey: 'items.dashboard', icon: 'layout-dashboard', allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'my-assets', labelKey: 'items.my-assets', icon: 'backpack', allow: MY_ASSETS_ALLOW },
  ]},
  { id: 'ops', labelKey: 'groups.ops', accent: NAV_GROUP_ACCENTS.ops, items: [
    { id: 'assets',      labelKey: 'items.assets',      icon: 'package',          allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'licenses',    labelKey: 'items.licenses',    icon: 'key-round',        allow: ['super_admin', 'tech_admin'] },
    { id: 'parts',       labelKey: 'items.parts',       icon: 'cpu',              allow: ['super_admin', 'asset_admin', 'tech_admin'] },
  ]},
  { id: 'org', labelKey: 'groups.org', accent: NAV_GROUP_ACCENTS.org, items: [
    { id: 'employees',   labelKey: 'items.employees',   icon: 'users',   allow: ['super_admin', 'asset_admin'] },
    { id: 'branches',    labelKey: 'items.branches',    icon: 'building', allow: ['super_admin', 'asset_admin'] },
    { id: 'departments', labelKey: 'items.departments', icon: 'network', allow: ['super_admin', 'asset_admin'] },
  ]},
  { id: 'catalogs', labelKey: 'groups.catalogs', accent: NAV_GROUP_ACCENTS.catalogs, items: [
    { id: 'categories', labelKey: 'items.categories', icon: 'tags',         allow: ['super_admin'] },
    { id: 'roles',      labelKey: 'items.roles',      icon: 'shield-check', allow: ['super_admin'] },
  ]},
  { id: 'system', labelKey: 'groups.system', accent: NAV_GROUP_ACCENTS.system, items: [
    { id: 'scan',     labelKey: 'items.scan',     icon: 'scan-line', allow: ['super_admin', 'asset_admin', 'tech_admin'] },
    { id: 'audit',    labelKey: 'items.audit',    icon: 'history',   allow: ['super_admin'] },
    { id: 'settings', labelKey: 'items.settings', icon: 'settings',  allow: ['super_admin'] },
  ]},
]

export const EMPLOYEE_NAV: NavGroup[] = [
  { id: 'employee', labelKey: null, accent: null, items: [
    { id: 'my-assets', labelKey: 'items.my-assets', icon: 'backpack',    allow: MY_ASSETS_ALLOW },
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
