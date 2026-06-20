import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState, Field, Select, Input,
} from '@/components/ui'
import type { User, UserRepository, AssignRoleInput, UserListQuery } from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
import type { Role } from '@/config/roles'
import { ROLE_IDS } from '@/config/roles'
import { createDefaultUserRepository } from '@/infra/repositories'

export interface RolesPageProps { repository?: UserRepository }

// ─── Change-role dialog ────────────────────────────────────────────────────────
interface ChangeDialogProps {
  target: User
  isSelf: boolean
  onClose: () => void
  onChanged: (u: User) => void
  repo: UserRepository
  actor: { uid: string; role: Role }
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

  const roleOptions = ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`) }))
  const emailMissing = selectedRole === 'employee' && empMode === 'create' && !target.email?.trim()
  const unchanged = selectedRole === (target.role ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole || unchanged) return
    setSubmitting(true)
    setError(null)
    try {
      const input: AssignRoleInput = { uid: target.id, role: selectedRole }
      if (selectedRole === 'employee') {
        input.employee = empMode === 'create'
          ? { mode: 'create', create: { firstName, lastName, email: target.email ?? '' } }
          : { mode: 'link' }
      }
      const r = await repo.assignRole(input, actor)
      onChanged(r.value)
    } catch (err) {
      if (err instanceof RoleLockoutError) setError(t(`guard.${err.reason}`))
      else setError(t('toast.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="change-role-title"
        className="w-full max-w-md bg-[#1B1F24] border border-[#2A2F36] rounded-xl shadow-2xl p-6 space-y-5 mx-4"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="change-role-title" className="text-[15px] font-bold text-[#F8FAFC]">{t('dialog.title')}</h2>
          <button type="button" aria-label={t('actions.close', { ns: 'common' })} onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] transition-colors">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111315] rounded-lg border border-[#2A2F36]">
          <Icon name="user" size={16} className="text-[#64748B] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#F8FAFC] truncate">{target.displayName || target.email}</p>
            <p className="text-[11.5px] text-[#64748B] truncate">{target.email}</p>
          </div>
          {isSelf && <span className="ml-auto text-[11px] text-[#F97316]">{t('you')}</span>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="change-role-select"
              className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
              {t('dialog.role')}
            </label>
            <Select id="change-role-select" value={selectedRole}
              onChange={(v) => setSelectedRole(v as Role)} options={roleOptions}
              placeholder={t('dialog.role')} />
          </div>

          {selectedRole === 'employee' && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('dialog.employeeMode')}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEmpMode('link')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'link' ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'}`}>
                  {t('dialog.link')}
                </button>
                <button type="button" onClick={() => setEmpMode('create')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'create' ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'}`}>
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
                  {emailMissing && <p role="alert" className="text-[12px] text-amber-400">{t('dialog.emailRequired')}</p>}
                </div>
              )}
            </div>
          )}

          <p className="text-[12px] text-[#94A3B8]">{t('dialog.confirm')}</p>
          {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('dialog.cancel')}</Btn>
            <Btn type="submit" variant="primary" disabled={!selectedRole || unchanged || submitting || emailMissing}>
              {t('dialog.submit')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function RolesPage({ repository }: RolesPageProps) {
  const { t } = useTranslation('roles')
  const { t: tNav } = useTranslation('nav')
  const { user, role } = useAuth()

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'no-role' | 'terminated'>('all')
  const [search, setSearch] = useState('')
  const [dialogUser, setDialogUser] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q: UserListQuery = {}
      const all = await repo.listUsers(q)
      setUsers(all)
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

  function handleChanged(updated: User) {
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    setDialogUser(null)
  }

  const roleFilterOptions = [
    { value: 'all', label: t('filter.all') },
    ...ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`) })),
    { value: 'no-role', label: t('role.none') },
  ]
  const statusFilterOptions = [
    { value: 'all', label: t('filter.all') },
    { value: 'active', label: t('status.active') },
    { value: 'no-role', label: t('status.no-role') },
    { value: 'terminated', label: t('status.terminated') },
  ]

  function roleLabel(r: Role | null): string { return r ? tNav(`roles.${r}`) : t('role.none') }

  function renderBody() {
    if (loading) return <LoadingState rows={6} />
    if (error) return <ErrorState onRetry={load} />
    if (filtered.length === 0) return <EmptyState icon="shield-check" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2F36]">
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.user')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.email')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.role')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.status')}</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === user.id
              return (
                <tr key={u.id} className={`border-b border-[#2A2F36] last:border-0 transition-colors ${isSelf ? 'bg-[#F97316]/5' : 'hover:bg-[#22272E]'}`}>
                  <td className="py-3 px-3">
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#22272E] border border-[#2A2F36] text-[#64748B] inline-flex items-center justify-center flex-shrink-0">
                        <Icon name="user" size={13} />
                      </span>
                      <span className="text-[13px] font-medium text-[#F8FAFC] truncate max-w-[160px]">{u.displayName || u.email}</span>
                      {isSelf && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F97316]/15 text-[#F97316] flex-shrink-0">{t('you')}</span>}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[13px] text-[#94A3B8]">{u.email}</td>
                  <td className="py-3 px-3 text-[13px] text-[#F8FAFC]">{roleLabel(u.role)}</td>
                  <td className="py-3 px-3 text-[13px] text-[#94A3B8]">{t(`status.${u.status}`)}</td>
                  <td className="py-3 px-3 text-right">
                    <Btn size="sm" variant="secondary" onClick={() => setDialogUser(u)}>
                      <Icon name="shield-check" size={13} />
                      {t('change')}
                    </Btn>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="shield-check" title={t('title')} description={t('subtitle')}
        {...(!loading ? { count: filtered.length } : {})} />

      <SectionCard noHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <label htmlFor="roles-search" className="sr-only">{t('search')}</label>
              <Input id="roles-search" value={search} onChange={setSearch} placeholder={t('search')} />
            </div>
            <div className="w-[160px]">
              <label htmlFor="roles-role-filter" className="sr-only">{t('filter.role')}</label>
              <Select id="roles-role-filter" value={roleFilter}
                onChange={(v) => setRoleFilter(v as Role | 'no-role' | 'all')} options={roleFilterOptions} />
            </div>
            <div className="w-[160px]">
              <label htmlFor="roles-status-filter" className="sr-only">{t('filter.status')}</label>
              <Select id="roles-status-filter" value={statusFilter}
                onChange={(v) => setStatusFilter(v as 'all' | 'active' | 'no-role' | 'terminated')} options={statusFilterOptions} />
            </div>
          </div>
          {renderBody()}
        </div>
      </SectionCard>

      {dialogUser && (
        <ChangeRoleDialog
          target={dialogUser}
          isSelf={dialogUser.id === user.id}
          onClose={() => setDialogUser(null)}
          onChanged={handleChanged}
          repo={repo}
          actor={{ uid: user.id, role }}
        />
      )}
    </div>
  )
}
