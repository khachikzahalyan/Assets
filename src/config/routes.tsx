import { lazy, Suspense, type ComponentType } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/common'
import { AppLoader } from '@/components/ui'
import { RequireAuth, RoleGate, RouteChunkFallback } from '@/components/routing'
import { routeRoles } from './access'

/**
 * Route-level code splitting: every page is a lazy chunk, downloaded on first
 * navigation to its route. Without this the whole app (all 21 pages + Firebase
 * SDK) shipped as ONE ~2.5 MB chunk that every page had to parse up front.
 *
 * Pages use named exports, so each import maps the name onto `default`.
 */
function lazyPage<K extends string>(
  loader: () => Promise<Record<K, ComponentType>>,
  name: K,
) {
  return lazy(() => loader().then(m => ({ default: m[name] })))
}

const DashboardPage      = lazyPage(() => import('@/pages/dashboard/DashboardPage'), 'DashboardPage')
const LoginPage          = lazyPage(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const PendingUsersPage   = lazyPage(() => import('@/pages/auth/PendingUsersPage'), 'PendingUsersPage')
const AssetsPage         = lazyPage(() => import('@/pages/assets/AssetsPage'), 'AssetsPage')
const AssetCreatePage    = lazyPage(() => import('@/pages/assets/AssetCreatePage'), 'AssetCreatePage')
const AssetDetailPage    = lazyPage(() => import('@/pages/assets/AssetDetailPage'), 'AssetDetailPage')
const EmployeesPage      = lazyPage(() => import('@/pages/employees/EmployeesPage'), 'EmployeesPage')
const EmployeeCreatePage = lazyPage(() => import('@/pages/employees/EmployeeCreatePage'), 'EmployeeCreatePage')
const EmployeeDetailPage = lazyPage(() => import('@/pages/employees/EmployeeDetailPage'), 'EmployeeDetailPage')
const MyAssetsPage       = lazyPage(() => import('@/pages/self-service/MyAssetsPage'), 'MyAssetsPage')
const MyActsPage         = lazyPage(() => import('@/pages/self-service/MyActsPage'), 'MyActsPage')
const ProfilePage        = lazyPage(() => import('@/pages/self-service/ProfilePage'), 'ProfilePage')
const BranchesPage       = lazyPage(() => import('@/pages/catalogs/BranchesPage'), 'BranchesPage')
const DepartmentsPage    = lazyPage(() => import('@/pages/catalogs/DepartmentsPage'), 'DepartmentsPage')
const CategoriesPage     = lazyPage(() => import('@/pages/catalogs/CategoriesPage'), 'CategoriesPage')
const RolesPage          = lazyPage(() => import('@/pages/catalogs/RolesPage'), 'RolesPage')
const SettingsPage       = lazyPage(() => import('@/pages/settings/SettingsPage'), 'SettingsPage')
const AuditPage          = lazyPage(() => import('@/pages/audit/AuditPage'), 'AuditPage')
const LicensesPage       = lazyPage(() => import('@/pages/licenses/LicensesPage'), 'LicensesPage')
const PartsPage          = lazyPage(() => import('@/pages/parts/PartsPage'), 'PartsPage')
const PartsReceivePage   = lazyPage(() => import('@/pages/parts/PartsReceivePage'), 'PartsReceivePage')
const ScanPage           = lazyPage(() => import('@/pages/scan/ScanPage'), 'ScanPage')
const ImportPage         = lazyPage(() => import('@/pages/import/ImportPage'), 'ImportPage')

/** Shell layout wrapper — renders the persistent AppShell around routed content.
    Suspense sits INSIDE the shell so the chrome stays mounted between
    navigations, but its fallback is a fullscreen overlay (RouteChunkFallback):
    while a page chunk downloads the user sees ONLY the centered AMS loader —
    identical to the auth loader — never a second loader inside the shell. */
function ShellLayout() {
  return (
    <AppShell>
      <Suspense fallback={<RouteChunkFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  )
}

/**
 * The AMS route table.
 *
 * Guard nesting:
 *   /login          — public, no guards
 *   everything else — <RequireAuth> (layout route)
 *     → <ShellLayout> (layout route providing AppShell)
 *       → index redirect to /dashboard
 *       → /dashboard wrapped in <RoleGate roles={routeRoles('dashboard')}>
 *       → /<routeId> stub routes each wrapped in <RoleGate roles={routeRoles(id)}>
 *       → * redirect to /dashboard (RoleGate on /dashboard handles the role bounce)
 *
 * Cross-redirect behaviour:
 *   - employee hits /dashboard → RoleGate checks routeRoles('dashboard') = [super_admin, asset_admin, tech_admin]
 *     → 'employee' not in list → Navigate to /my-assets
 *   - admin hits /my-assets → RoleGate checks routeRoles('my-assets') = [employee]
 *     → admin not in list → Navigate to /dashboard
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<AppLoader fullScreen />}>
            <LoginPage />
          </Suspense>
        }
      />

      {/* ── Authenticated ── */}
      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/dashboard"
            element={
              <RoleGate roles={routeRoles('dashboard')}>
                <DashboardPage />
              </RoleGate>
            }
          />

          <Route
            path="/assets"
            element={
              <RoleGate roles={routeRoles('assets')}>
                <AssetsPage />
              </RoleGate>
            }
          />

          <Route
            path="/assets/new"
            element={
              <RoleGate roles={['super_admin', 'asset_admin']}>
                <AssetCreatePage />
              </RoleGate>
            }
          />

          <Route
            path="/assets/:id"
            element={
              <RoleGate roles={routeRoles('assets')}>
                <AssetDetailPage />
              </RoleGate>
            }
          />

          <Route path="/employees" element={
            <RoleGate roles={routeRoles('employees')}><EmployeesPage /></RoleGate>
          } />
          <Route path="/employees/new" element={
            <RoleGate roles={['super_admin', 'asset_admin']}><EmployeeCreatePage /></RoleGate>
          } />
          <Route path="/employees/:id" element={
            <RoleGate roles={routeRoles('employees')}><EmployeeDetailPage /></RoleGate>
          } />
          <Route path="/branches" element={
            <RoleGate roles={routeRoles('branches')}><BranchesPage /></RoleGate>
          } />
          <Route path="/departments" element={
            <RoleGate roles={routeRoles('departments')}><DepartmentsPage /></RoleGate>
          } />
          <Route path="/categories" element={
            <RoleGate roles={routeRoles('categories')}><CategoriesPage /></RoleGate>
          } />
          <Route path="/roles" element={
            <RoleGate roles={routeRoles('roles')}><RolesPage /></RoleGate>
          } />
          <Route path="/audit" element={
            <RoleGate roles={routeRoles('audit')}><AuditPage /></RoleGate>
          } />
          <Route path="/my-assets" element={
            <RoleGate roles={routeRoles('my-assets')}><MyAssetsPage /></RoleGate>
          } />
          <Route path="/my-acts" element={
            <RoleGate roles={routeRoles('my-acts')}><MyActsPage /></RoleGate>
          } />
          <Route path="/profile" element={
            <RoleGate roles={routeRoles('profile')}><ProfilePage /></RoleGate>
          } />
          <Route path="/pending-users" element={
            <RoleGate roles={routeRoles('pending-users')}><PendingUsersPage /></RoleGate>
          } />
          <Route path="/licenses" element={
            <RoleGate roles={routeRoles('licenses')}><LicensesPage /></RoleGate>
          } />
          <Route
            path="/scan"
            element={
              <RoleGate roles={routeRoles('scan')}>
                <ScanPage />
              </RoleGate>
            }
          />
          <Route path="/settings" element={
            <RoleGate roles={routeRoles('settings')}><SettingsPage /></RoleGate>
          } />
          <Route path="/parts" element={
            <RoleGate roles={routeRoles('parts')}><PartsPage /></RoleGate>
          } />
          <Route path="/parts/new" element={
            <RoleGate roles={routeRoles('parts')}><PartsReceivePage /></RoleGate>
          } />
          <Route path="/import" element={
            <RoleGate roles={['super_admin', 'asset_admin']}><ImportPage /></RoleGate>
          } />

          {/* Unknown paths fall to /dashboard; RoleGate there handles role bounce */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
