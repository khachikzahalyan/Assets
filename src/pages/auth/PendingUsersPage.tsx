import { useMemo, useState, useCallback, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  ListCard, ListPageShell,
  Btn, Icon, EmptyState, TableSkeleton, ErrorState, Field, Select, Input,
  CardListSkeleton, DataTable,
  MobileListPlaceholders,
  DIALOG_BACKDROP, MODAL_SHEET,
} from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { PendingUser, UserRepository, AssignRoleInput } from '@/domain/user'
import type { Role } from '@/config/roles'
import { ROLE_IDS } from '@/config/roles'
import { createDefaultUserRepository } from '@/infra/repositories'
import { PendingUserRowMobile } from '@/components/features/users'
import { CatalogPagination } from '@/components/features/catalogs'

const PAGE_SIZE = 10

export interface PendingUsersPageProps {
  repository?: UserRepository
}

// ─── Assign-role dialog ───────────────────────────────────────────────────────

interface AssignDialogProps {
  pendingUser: PendingUser
  onClose: () => void
  onAssigned: (uid: string) => void
  repo: UserRepository
  actor: { uid: string; role: Role }
}

function AssignDialog({ pendingUser, onClose, onAssigned, repo, actor }: AssignDialogProps) {
  const { t } = useTranslation('pending-users')
  const { t: tNav } = useTranslation('nav')

  const [selectedRole, setSelectedRole] = useState<Role | ''>('')
  const [empMode, setEmpMode] = useState<'link' | 'create'>('link')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions = ROLE_IDS.map(id => ({
    value: id,
    label: tNav(`roles.${id}`),
  }))

  // Guard: employee+create requires a non-empty email on the pending user
  const emailMissing =
    selectedRole === 'employee' &&
    empMode === 'create' &&
    !pendingUser.email?.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole) return
    setSubmitting(true)
    setError(null)
    try {
      const input: AssignRoleInput = { uid: pendingUser.id, role: selectedRole }
      if (selectedRole === 'employee') {
        if (empMode === 'create') {
          input.employee = {
            mode: 'create',
            create: { firstName, lastName, email: pendingUser.email },
          }
        } else {
          input.employee = { mode: 'link' }
        }
      }
      await repo.assignRole(input, actor)
      onAssigned(pendingUser.id)
    } catch {
      setError(t('toast.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return ReactDOM.createPortal(
    /* Backdrop */
    <div
      role="presentation"
      className={`${DIALOG_BACKDROP} backdrop-blur-sm`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-dialog-title"
        className={`w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6 space-y-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 -mt-3" />
        <header className="flex items-center justify-between gap-3">
          <h2 id="assign-dialog-title" className="text-[15px] font-bold text-text-primary">
            {t('dialog.title')}
          </h2>
          <button
            type="button"
            aria-label={t('dialog.cancel')}
            onClick={onClose}
            className="text-text-subtle hover:text-text-primary transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-bg rounded-lg border border-border">
          <Icon name="user" size={16} className="text-text-subtle flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text-primary truncate">{pendingUser.displayName || pendingUser.email}</p>
            <p className="text-[11.5px] text-text-subtle truncate">{pendingUser.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role select */}
          <div>
            <label
              htmlFor="assign-role-select"
              className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle"
            >
              {t('dialog.role')}
            </label>
            <Select
              id="assign-role-select"
              value={selectedRole}
              onChange={(v) => setSelectedRole(v as Role)}
              options={roleOptions}
              placeholder={t('dialog.role')}
            />
          </div>

          {/* Employee mode — only when role === 'employee' */}
          {selectedRole === 'employee' && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('dialog.employeeMode')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEmpMode('link')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'link'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg border-border text-text-tertiary hover:border-border-strong'
                  }`}
                >
                  {t('dialog.link')}
                </button>
                <button
                  type="button"
                  onClick={() => setEmpMode('create')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'create'
                      ? 'bg-accent/10 border-accent text-accent'
                      : 'bg-bg border-border text-text-tertiary hover:border-border-strong'
                  }`}
                >
                  {t('dialog.create')}
                </button>
              </div>

              {empMode === 'create' && (
                <div className="space-y-3">
                  <Field label={t('dialog.firstName')} required>
                    <Input
                      id="assign-first-name"
                      value={firstName}
                      onChange={setFirstName}
                      placeholder={t('dialog.firstName')}
                    />
                  </Field>
                  <Field label={t('dialog.lastName')} required>
                    <Input
                      id="assign-last-name"
                      value={lastName}
                      onChange={setLastName}
                      placeholder={t('dialog.lastName')}
                    />
                  </Field>
                  <Field label={t('col.email')}>
                    <input
                      type="email"
                      value={pendingUser.email}
                      readOnly
                      className="w-full h-9 px-3 text-sm bg-[#0D1117] border border-border rounded-lg text-text-subtle cursor-default"
                    />
                  </Field>
                  {emailMissing && (
                    <p role="alert" className="text-[12px] text-amber-400">
                      {t('dialog.emailRequired')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              {t('dialog.cancel')}
            </Btn>
            <Btn
              type="submit"
              variant="primary"
              disabled={!selectedRole || submitting || emailMissing}
            >
              {t('dialog.submit')}
            </Btn>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const gridTemplate = 'minmax(180px,2fr) minmax(140px,1.5fr) minmax(140px,1.5fr) 160px'

export function PendingUsersPage({ repository }: PendingUsersPageProps) {
  const { t } = useTranslation('pending-users')
  const { user, role } = useAuth()

  // Lazy default repo — test callers inject their own
  const defaultRepo = useMemo<UserRepository>(
    () => createDefaultUserRepository(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const isMobile = useIsMobile()

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const [dialogUser, setDialogUser]     = useState<PendingUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const users = await repo.listPendingUsers()
      setPendingUsers(users)
    } catch {
      setError(t('toast.failed'))
    } finally {
      setLoading(false)
    }
  }, [repo, t])

  useEffect(() => {
    void load()
  }, [load])

  // Filter by search term (name or email)
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return pendingUsers
    return pendingUsers.filter(u =>
      `${u.displayName ?? ''} ${u.email ?? ''}`.toLowerCase().includes(s),
    )
  }, [pendingUsers, search])

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [search])

  const pageRows = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )

  function handleAssigned(uid: string) {
    setPendingUsers(prev => prev.filter(u => u.id !== uid))
    setDialogUser(null)
  }

  function formatDate(createdAt: string | null): string {
    if (!createdAt) return '—'
    try {
      return new Date(createdAt).toLocaleString()
    } catch {
      return '—'
    }
  }

  function renderBody() {
    // Loading: toolbar renders as-is (static); only the body shimmers
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="pending-user" />
      : <TableSkeleton
          rows={PAGE_SIZE}
          columns={4}
          gridTemplate={gridTemplate}
          lastColAction
        />

    if (error) return <ErrorState onRetry={load} />

    if (filtered.length === 0) {
      return (
        <EmptyState
          icon="user-plus"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }

    if (isMobile) {
      const placeholderCount = Math.max(0, PAGE_SIZE - pageRows.length)
      return (
        <div className="flex flex-col flex-1 min-h-0">
          {pageRows.map(pu => (
            <PendingUserRowMobile
              key={pu.id}
              pu={pu}
              formattedDate={formatDate(pu.createdAt)}
              onAssign={() => setDialogUser(pu)}
              outerStyle={{ flexGrow: 1, flexShrink: 0 }}
            />
          ))}
          <MobileListPlaceholders count={placeholderCount} dataTestId="pending-user-placeholder" />
        </div>
      )
    }

    /* Desktop DataTable with fill contract */
    const dtColumns: DataTableColumn<PendingUser>[] = [
      {
        key: 'user',
        header: t('col.user'),
        width: 'minmax(180px,2fr)',
        cell: (pu) => (
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-surface-2 border border-border text-text-subtle inline-flex items-center justify-center flex-shrink-0">
              <Icon name="user" size={13} />
            </span>
            <span className="text-[13px] font-medium text-text-primary truncate max-w-[160px]">
              {pu.displayName || pu.email}
            </span>
          </span>
        ),
      },
      {
        key: 'email',
        header: t('col.email'),
        width: 'minmax(140px,1.5fr)',
        cell: (pu) => (
          <span className="text-[13px] text-text-tertiary">{pu.email}</span>
        ),
      },
      {
        key: 'signedIn',
        header: t('col.signedIn'),
        width: 'minmax(140px,1.5fr)',
        cell: (pu) => (
          <span className="text-[13px] text-text-subtle">{formatDate(pu.createdAt)}</span>
        ),
      },
      {
        key: 'action',
        header: '',
        width: '160px',
        align: 'right',
        cell: (pu) => (
          <Btn size="sm" variant="primary" className="whitespace-nowrap" onClick={() => setDialogUser(pu)}>
            <Icon name="user-plus" size={13} />
            {t('assign')}
          </Btn>
        ),
      },
    ]

    return (
      <DataTable<PendingUser>
        columns={dtColumns}
        rows={pageRows}
        getRowKey={(pu) => pu.id}
        aria-label={t('title')}
        minRows={PAGE_SIZE}
        fillHeight
      />
    )
  }

  return (
    <>
      {/* No page header (same pattern as /roles — card starts directly with toolbar). */}
      <ListPageShell flushMobile>
        {/* Floating-card model: NO flushMobile on the card — keeps rounded-lg radius
            on mobile; 10px side gutters; the .app-shell-content-flush flex chain
            stretches the card to the BottomNav top ('pending-users' is in AppShell FLUSH_ROUTES). */}
        <ListCard
          className="max-md:mx-[10px]"
          toolbar={
            /* Zone 1: search — static content rendered immediately, no shimmer. */
            <>
              <div className="flex items-center gap-2 flex-wrap px-5 py-3 max-md:px-3 max-md:py-2.5">
                <div className="relative flex-1 min-w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none">
                    <Icon name="search" size={13} />
                  </span>
                  <input
                    id="pending-users-search"
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('col.user')}
                    aria-label={t('col.user')}
                    className="w-full h-9 pl-8 pr-3 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
                  />
                </div>
              </div>
              <div className="border-t border-border" />
            </>
          }
          pagination={
            /* Always mounted — total=0 during load renders disabled prev/next,
               preventing layout shift (RolesPage / EmployeesPage precedent). */
            <CatalogPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={loading ? 0 : filtered.length}
              onPage={setPage}
            />
          }
        >
          {/* Zone 2: flex-1 min-h-0 flex-col scroller — edge-to-edge on BOTH
              breakpoints (no inner padding: the table's first column carries
              paddingLeft:20, MobileListRow carries its own 14px). */}
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            {renderBody()}
          </div>
        </ListCard>
      </ListPageShell>

      {dialogUser && (
        <AssignDialog
          pendingUser={dialogUser}
          onClose={() => setDialogUser(null)}
          onAssigned={handleAssigned}
          repo={repo}
          actor={{ uid: user.id, role }}
        />
      )}
    </>
  )
}
