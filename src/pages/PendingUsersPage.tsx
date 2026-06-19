import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState, Field, Select,
} from '@/components/ui'
import type { PendingUser, UserRepository, AssignRoleInput } from '@/domain/user'
import type { Role } from '@/config/roles'
import { ROLE_IDS } from '@/config/roles'
import { createDefaultUserRepository } from '@/infra/repositories'
import { Input } from '@/components/ui'

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

  return (
    /* Backdrop */
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-dialog-title"
        className="w-full max-w-md bg-[#1B1F24] border border-[#2A2F36] rounded-xl shadow-2xl p-6 space-y-5 mx-4"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="assign-dialog-title" className="text-[15px] font-bold text-[#F8FAFC]">
            {t('dialog.title')}
          </h2>
          <button
            type="button"
            aria-label={t('dialog.cancel')}
            onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] transition-colors"
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111315] rounded-lg border border-[#2A2F36]">
          <Icon name="user" size={16} className="text-[#64748B] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#F8FAFC] truncate">{pendingUser.displayName || pendingUser.email}</p>
            <p className="text-[11.5px] text-[#64748B] truncate">{pendingUser.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role select */}
          <div>
            <label
              htmlFor="assign-role-select"
              className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]"
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
              <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                {t('dialog.employeeMode')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEmpMode('link')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'link'
                      ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'
                  }`}
                >
                  {t('dialog.link')}
                </button>
                <button
                  type="button"
                  onClick={() => setEmpMode('create')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'create'
                      ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'
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
                      className="w-full h-9 px-3 text-sm bg-[#0D1117] border border-[#2A2F36] rounded-lg text-[#64748B] cursor-default"
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
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
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
    if (loading) return <LoadingState rows={6} />
    if (error)   return <ErrorState onRetry={load} />
    if (pendingUsers.length === 0) {
      return (
        <EmptyState
          icon="user-plus"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2F36]">
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                {t('col.user')}
              </th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                {t('col.email')}
              </th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                {t('col.signedIn')}
              </th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map(pu => (
              <tr
                key={pu.id}
                className="border-b border-[#2A2F36] last:border-0 hover:bg-[#22272E] transition-colors"
              >
                <td className="py-3 px-3">
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#22272E] border border-[#2A2F36] text-[#64748B] inline-flex items-center justify-center flex-shrink-0">
                      <Icon name="user" size={13} />
                    </span>
                    <span className="text-[13px] font-medium text-[#F8FAFC] truncate max-w-[160px]">
                      {pu.displayName || pu.email}
                    </span>
                  </span>
                </td>
                <td className="py-3 px-3 text-[13px] text-[#94A3B8]">{pu.email}</td>
                <td className="py-3 px-3 text-[13px] text-[#64748B]">{formatDate(pu.createdAt)}</td>
                <td className="py-3 px-3 text-right">
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => setDialogUser(pu)}
                  >
                    <Icon name="user-plus" size={13} />
                    {t('assign')}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="user-plus"
        title={t('title')}
        description={t('subtitle')}
        {...(!loading ? { count: pendingUsers.length } : {})}
      />

      <SectionCard noHeader>
        <div className="space-y-4">
          {renderBody()}
        </div>
      </SectionCard>

      {dialogUser && (
        <AssignDialog
          pendingUser={dialogUser}
          onClose={() => setDialogUser(null)}
          onAssigned={handleAssigned}
          repo={repo}
          actor={{ uid: user.id, role }}
        />
      )}
    </div>
  )
}
