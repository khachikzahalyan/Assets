import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/common'
import { DashboardPage, StubPage, LoginPage, AssetsPage, AssetCreatePage, AssetDetailPage } from '@/pages'
import { RequireAuth, RoleGate } from '@/components/routing'
import { PHASE_STUB_ROUTES } from './nav'
import { routeRoles } from './access'

/** Shell layout wrapper — renders the persistent AppShell around routed content. */
function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
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
      <Route path="/login" element={<LoginPage />} />

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

          {PHASE_STUB_ROUTES.map((id) => (
            <Route
              key={id}
              path={`/${id}`}
              element={
                <RoleGate roles={routeRoles(id)}>
                  <StubPage routeId={id} />
                </RoleGate>
              }
            />
          ))}

          {/* Unknown paths fall to /dashboard; RoleGate there handles role bounce */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
