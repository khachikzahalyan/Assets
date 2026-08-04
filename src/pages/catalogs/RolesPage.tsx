import { useMemo, useState, useCallback, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import {
  ListCard, ListPageShell,
  Btn, Icon, EmptyState, TableSkeleton, ErrorState, Field, Select, Input,
  SelectMini,
  CardListSkeleton, DataTable, SearchInput,
  MobileListPlaceholders,
  DIALOG_BACKDROP, MODAL_SHEET,
} from '@/components/ui'
import type { SelectMiniOption } from '@/components/ui/SelectMini'
import type { DataTableColumn } from '@/components/ui'
import type { User, UserRepository, AssignRoleInput, UserListQuery } from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
import type { Role } from '@/config/roles'
import { ROLE_IDS } from '@/config/roles'
import { RoleIcon } from '@/components/ui/RoleIcon'
import { createDefaultUserRepository } from '@/infra/repositories'
import { RoleRowMobile } from '@/components/features/users'
import { CatalogPagination } from '@/components/features/catalogs'
import { sendAccessEmail } from '@/lib/notifications/sendAccessEmail'

const PAGE_SIZE = 10

/** Status → dot color, shared by the filter chips and the table status cell. */
const STATUS_DOT: Record<string, string> = {
  active: '#22C55E',
  invited: '#38BDF8',
  'no-role': '#F59E0B',
  terminated: '#F43F5E',
}

export interface RolesPageProps { repository?: UserRepository }

// ─── Change-role dialog ────────────────────────────────────────────────────────
interface ChangeDialogProps {
  target: User
  isSelf: boolean
  onClose: () => void
  onChanged: (u: User) => void
  repo: UserRepository
  actor: { uid: string; role: Role; displayName?: string }
}

function ChangeRoleDialog({ target, isSelf, onClose, onChanged, repo, actor }: ChangeDialogProps) {
  const { t } = useTranslation('roles')
  const { t: tNav } = useTranslation('nav')
  const [selectedRole, setSelectedRole] = useState<Role | ''>(target.role ?? '')
  const [empMode, setEmpMode] = useState<'link' | 'create'>('link')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invited = an /employees person with no account yet. The role is pre-assigned
  // to the employee record (applied at first sign-in) — no account to mutate, and
  // the employee link/create sub-flow is moot (the HR record already exists).
  const isInvited = target.status === 'invited'
  const roleOptions = ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`), icon: <RoleIcon role={id} size={20} /> }))
  const emailMissing = !isInvited && selectedRole === 'employee' && empMode === 'create' && !target.email?.trim()
  const unchanged = selectedRole === (target.role ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole || unchanged) return
    setSubmitting(true)
    setError(null)
    // Best-effort Gmail notification once the grant persists (never blocks/reverts).
    const fireAccessEmail = () => {
      const to = target.email?.trim()
      if (!to) return
      void sendAccessEmail({
        email: to,
        name: target.displayName?.trim() || to,
        kind: 'role',
        roleLabel: tNav(`roles.${selectedRole}`),
        role: selectedRole,
      })
    }
    try {
      if (isInvited) {
        if (!repo.preassignRole) throw new Error('preassignRole not supported')
        const r = await repo.preassignRole(target.id, selectedRole, actor)
        fireAccessEmail()
        onChanged(r.value)
        return
      }
      const input: AssignRoleInput = { uid: target.id, role: selectedRole }
      if (selectedRole === 'employee') {
        input.employee = empMode === 'create'
          ? { mode: 'create', create: { firstName, lastName, email: target.email ?? '' } }
          : { mode: 'link' }
      }
      const r = await repo.assignRole(input, actor)
      fireAccessEmail()
      onChanged(r.value)
    } catch (err) {
      if (err instanceof RoleLockoutError) setError(t(`guard.${err.reason}`))
      else setError(t('toast.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return ReactDOM.createPortal(
    <div
      role="presentation"
      className={cn(DIALOG_BACKDROP, 'backdrop-blur-sm')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="change-role-title"
        className={`w-full max-w-md bg-surface border border-border rounded-xl max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[92dvh] max-md:overflow-y-auto shadow-2xl p-6 space-y-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 light:bg-black/10 mb-3 -mt-3" />
        <header className="flex items-center justify-between gap-3">
          <h2 id="change-role-title" className="text-15 font-bold text-text-primary">{t('dialog.title')}</h2>
          <button type="button" aria-label={t('actions.close', { ns: 'common' })} onClick={onClose}
            className="text-text-subtle hover:text-text-primary transition-colors">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border">
          {/* Avatar = the target's current role badge (owner request — same
              per-role icon used in the list + filter); generic tile only when
              the user has no role yet. */}
          {target.role ? (
            <RoleIcon role={target.role} size={30} className="shrink-0" />
          ) : (
            <span className="w-[1.875rem] h-[1.875rem] rounded-full inline-flex items-center justify-center flex-shrink-0 bg-surface-2 border border-border text-text-subtle">
              <Icon name="user" size={14} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-13 font-medium text-text-primary truncate">{target.displayName || target.email}</p>
            <p className="text-11.5 text-text-subtle truncate">{target.email}</p>
          </div>
          {isSelf && <span className="ml-auto text-11 text-accent">{t('you')}</span>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="change-role-select"
              className="block mb-1 text-11 uppercase tracking-[0.06em] font-semibold text-text-subtle">
              {t('dialog.role')}
            </label>
            <Select id="change-role-select" value={selectedRole}
              onChange={(v) => setSelectedRole(v as Role)} options={roleOptions}
              placeholder={t('dialog.role')} />
          </div>

          {!isInvited && selectedRole === 'employee' && (
            <div className="space-y-3">
              <p className="text-11 uppercase tracking-[0.06em] font-semibold text-text-subtle">{t('dialog.employeeMode')}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEmpMode('link')}
                  className={`flex-1 min-h-[2.25rem] py-1.5 px-2 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'link' ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg border-border text-text-tertiary hover:border-border-strong'}`}>
                  {t('dialog.link')}
                </button>
                <button type="button" onClick={() => setEmpMode('create')}
                  className={`flex-1 min-h-[2.25rem] py-1.5 px-2 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'create' ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg border-border text-text-tertiary hover:border-border-strong'}`}>
                  {t('dialog.create')}
                </button>
              </div>
              {empMode === 'create' && (
                <div className="space-y-3">
                  <Field label={t('dialog.firstName')} required>
                    <Input id="change-first-name" value={firstName} onChange={setFirstName} placeholder={t('dialog.firstName')} />
                  </Field>
                  <Field label={t('dialog.lastName')} required>
                    <Input id="change-last-name" value={lastName} onChange={setLastName} placeholder={t('dialog.lastName')} />
                  </Field>
                  {emailMissing && <p role="alert" className="text-12 text-amber-400 light:text-amber-700">{t('dialog.emailRequired')}</p>}
                </div>
              )}
            </div>
          )}

          <p className="text-12 text-text-tertiary">{t('dialog.confirm')}</p>
          {error && <p role="alert" className="text-12.5 text-rose-400 light:text-rose-700">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('dialog.cancel')}</Btn>
            <Btn type="submit" variant="primary" disabled={!selectedRole || unchanged || submitting || emailMissing}>
              {t('dialog.submit')}
            </Btn>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function RolesPage({ repository }: RolesPageProps) {
  const { t } = useTranslation('roles')
  const { t: tNav } = useTranslation('nav')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()

  const defaultRepo = useMemo<UserRepository>(
    () => createDefaultUserRepository(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | 'no-role' | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'no-role' | 'terminated' | 'invited'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogUser, setDialogUser] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q: UserListQuery = {}
      // Real accounts + INVITED employees (people added on /employees who have
      // never signed in) — so a role can be granted before first sign-in.
      const [accounts, invited] = await Promise.all([
        repo.listUsers(q),
        repo.listInvitedEmployees ? repo.listInvitedEmployees() : Promise.resolve([] as User[]),
      ])
      setUsers([...accounts, ...invited])
    } catch { setError(t('toast.failed')) }
    finally { setLoading(false) }
  }, [repo, t])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return users.filter(u => {
      if (roleFilter === 'no-role' && u.role !== null) return false
      if (roleFilter !== 'all' && roleFilter !== 'no-role' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (s && !(`${u.displayName} ${u.email}`.toLowerCase().includes(s))) return false
      return true
    })
  }, [users, roleFilter, statusFilter, search])

  // Reset page to 1 when filters or search change
  useEffect(() => { setPage(1) }, [roleFilter, statusFilter, search])

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  function handleChanged(updated: User) {
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    setDialogUser(null)
  }

  // Per-role option icons: each real role gets its own unique RoleIcon badge
  // (owner request — the same badge used in the list rows and the dialog), while
  // the synthetic 'all'/'no-role' entries keep a plain lucide glyph.
  const roleFilterOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all'), icon: 'users' },
    ...ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`), iconNode: <RoleIcon role={id} size={18} /> })),
    { value: 'no-role', label: t('role.none'), icon: 'user-circle' },
  ]
  // Status dots (owner request): active = green, no-role = amber, terminated = red
  const statusFilterOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'active', label: t('status.active'), dotColor: '#22C55E' },
    { value: 'invited', label: t('status.invited'), dotColor: '#38BDF8' },
    { value: 'no-role', label: t('status.no-role'), dotColor: '#F59E0B' },
    { value: 'terminated', label: t('status.terminated'), dotColor: '#F43F5E' },
  ]

  function roleLabel(r: Role | null): string { return r ? tNav(`roles.${r}`) : t('role.none') }

  const gridTemplate = 'minmax(11.25rem,2fr) minmax(8.75rem,1.5fr) minmax(7.5rem,1.3fr) minmax(6.25rem,1fr) 10rem'

  function renderBody() {
    // Loading: search/filters render as-is (local/static); only the body shimmers
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="role" />
      : <TableSkeleton
          rows={PAGE_SIZE}
          columns={5}
          gridTemplate={gridTemplate}
          lastColAction
          headers={[t('col.user'), t('col.email'), t('col.role'), t('col.status'), '']}
        />
    if (error) return <ErrorState onRetry={load} />
    if (filtered.length === 0) return <EmptyState icon="shield-check" title={t('empty.title')} description={t('empty.desc')} />

    if (isMobile) {
      const placeholderCount = Math.max(0, PAGE_SIZE - pageRows.length)
      return (
        <div className="flex flex-col flex-1 min-h-0">
          {pageRows.map(u => (
            <RoleRowMobile
              key={u.id}
              u={u}
              isSelf={u.id === user.id}
              youLabel={t('you')}
              changeLabel={t('change')}
              onChangeRole={() => setDialogUser(u)}
              outerStyle={{ flexGrow: 1, flexShrink: 0 }}
            />
          ))}
          <MobileListPlaceholders count={placeholderCount} dataTestId="role-row-placeholder" />
        </div>
      )
    }

    // Desktop DataTable with fill contract
    const dtColumns: DataTableColumn<User>[] = [
      {
        key: 'user',
        header: t('col.user'),
        width: 'minmax(11.25rem,2fr)',
        cell: (u) => {
          const isSelf = u.id === user.id
          return (
            <span className="flex items-center gap-2 min-w-0">
              {/* Avatar = the role badge itself (owner request); generic tile only when no role */}
              {u.role ? (
                <RoleIcon role={u.role} size={28} className="shrink-0" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-surface-2 border border-border text-text-subtle inline-flex items-center justify-center flex-shrink-0">
                  <Icon name="user" size={13} />
                </span>
              )}
              <span className="text-13 font-medium text-text-primary truncate min-w-0 flex-1">{u.displayName || u.email}</span>
              {isSelf && <span className="text-10.5 px-1.5 py-0.5 rounded bg-accent/15 text-accent flex-shrink-0">{t('you')}</span>}
            </span>
          )
        },
      },
      {
        key: 'email',
        header: t('col.email'),
        width: 'minmax(8.75rem,1.5fr)',
        cell: (u) => <span className="text-13 text-text-tertiary">{u.email}</span>,
      },
      {
        key: 'role',
        header: t('col.role'),
        width: 'minmax(7.5rem,1.3fr)',
        cell: (u) => (
          <span className="text-13 text-text-primary">{roleLabel(u.role)}</span>
        ),
      },
      {
        key: 'status',
        header: t('col.status'),
        width: 'minmax(6.25rem,1fr)',
        cell: (u) => (
          <span className="inline-flex items-center gap-1.5 text-13 text-text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_DOT[u.status] ?? '#64748B' }} />
            {t(`status.${u.status}`)}
          </span>
        ),
      },
      {
        key: 'action',
        header: '',
        width: '10rem',
        align: 'right',
        cell: (u) => (
          <Btn size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => setDialogUser(u)}>
            <Icon name="shield-check" size={13} />
            {t('change')}
          </Btn>
        ),
      },
    ]

    return (
      <DataTable<User>
        columns={dtColumns}
        rows={pageRows}
        getRowKey={(u) => u.id}
        rowClassName={(u) => cn(u.id === user.id ? 'bg-accent/5' : '')}
        aria-label={t('title')}
        minRows={PAGE_SIZE}
        fillHeight
      />
    )
  }

  return (
    <>
      {/* No page header on either breakpoint (owner request) — the card starts
          directly with the filter bar. */}
      <ListPageShell flushMobile>
        {/* Floating-card model: NO flushMobile on the card — keeps rounded-lg radius
            on mobile; 10px side gutters; the .app-shell-content-flush flex chain
            stretches the card to the BottomNav top ('roles' is in AppShell FLUSH_ROUTES). */}
        <ListCard
          className="max-md:mx-2.5"
          toolbar={
            /* Zone 1: search + filters — static content rendered immediately,
               no shimmer (owner rule: only async data shimmers). */
            <>
              {/* Desktop: search (flex-1) + both chips on one line. Mobile: search
                  takes the full first line (min-w-full forces the wrap), and the two
                  chips share the second line 50/50 — a balanced, aligned pair instead
                  of the lopsided search+role / status-alone wrap. */}
              <div className="flex items-center gap-2 flex-wrap px-5 py-3 max-md:px-3 max-md:py-2.5 max-md:gap-1.5">
                <SearchInput
                  id="roles-search"
                  value={search}
                  onChange={setSearch}
                  placeholder={t('search')}
                  aria-label={t('search')}
                  containerClassName="flex-1 min-w-[11.25rem] max-md:min-w-full"
                />
                <div className="flex items-center gap-2 max-md:w-full max-md:gap-1.5">
                  <SelectMini
                    id="roles-role-filter"
                    label={t('filter.role')}
                    leadingIcon="shield-check"
                    value={roleFilter}
                    onChange={v => setRoleFilter(v as Role | 'no-role' | 'all')}
                    options={roleFilterOptions}
                    className="max-md:flex-1 max-md:justify-between"
                  />
                  <SelectMini
                    id="roles-status-filter"
                    label={t('filter.status')}
                    leadingIcon="circle-dot"
                    value={statusFilter}
                    onChange={v => setStatusFilter(v as 'all' | 'active' | 'no-role' | 'terminated')}
                    options={statusFilterOptions}
                    className="max-md:flex-1 max-md:justify-between"
                  />
                </div>
              </div>
              <div className="border-t border-border" />
            </>
          }
          pagination={
            /* Always mounted — total=0 during load renders disabled prev/next,
               preventing layout shift (EmployeesPage / BranchesPage precedent). */
            <CatalogPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={loading ? 0 : filtered.length}
              onPage={setPage}
            />
          }
        >
          {/* Zone 2: flex-1 min-h-0 flex-col scroller — edge-to-edge on BOTH
              breakpoints like /assets (no inner padding: the table's first column
              carries paddingLeft:20, MobileListRow carries its own 14px). */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {renderBody()}
          </div>
        </ListCard>
      </ListPageShell>

      {dialogUser && (
        <ChangeRoleDialog
          target={dialogUser}
          isSelf={dialogUser.id === user.id}
          onClose={() => setDialogUser(null)}
          onChanged={handleChanged}
          repo={repo}
          actor={{ uid: user.id, role, displayName: user.name }}
        />
      )}
    </>
  )
}
