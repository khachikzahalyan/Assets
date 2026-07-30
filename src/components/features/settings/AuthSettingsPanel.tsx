import { useState, useCallback, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  SectionCard, Btn, Icon, Field, Input, ErrorState, DIALOG_BACKDROP, MODAL_SHEET,
} from '@/components/ui'
import {
  normalizeDomain, isValidDomain,
  type AuthSettingsRepository,
} from '@/domain/settings'

// ─── helpers ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(input: string): boolean {
  return EMAIL_RE.test(input.trim().toLowerCase())
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

// ─── inline dialog markup ────────────────────────────────────────────────────

interface DialogShellProps {
  onBackdropClick: () => void
  children: React.ReactNode
  labelledBy?: string
}

function DialogShell({ onBackdropClick, children, labelledBy }: DialogShellProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onBackdropClick() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBackdropClick])

  return ReactDOM.createPortal(
    <div
      className={DIALOG_BACKDROP}
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={`w-[440px] max-w-[90vw] rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 light:bg-black/10 mb-3" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

// ─── standard (non-empty list) confirm dialog ────────────────────────────────

interface StandardConfirmProps {
  working: string[]
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TFunction<'settings'>
}

function StandardConfirmDialog({ working, saving, onConfirm, onCancel, t }: StandardConfirmProps) {
  return (
    <DialogShell onBackdropClick={onCancel} labelledBy="settings-confirm-title">
      <h3 id="settings-confirm-title" className="text-[15px] font-semibold text-text-primary mb-2">
        {t('confirm.title')}
      </h3>
      <p className="text-[13px] text-text-tertiary mb-4">
        {t('confirm.body', { list: working.join(', ') })}
      </p>
      <div className="flex justify-end gap-2">
        <Btn variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          {t('confirm.cancel')}
        </Btn>
        <Btn variant="primary" size="sm" onClick={onConfirm} disabled={saving}>
          {saving ? t('confirm.saving') : t('confirm.ok')}
        </Btn>
      </div>
    </DialogShell>
  )
}

// ─── danger (empty-list) confirm dialog ──────────────────────────────────────

interface DangerConfirmProps {
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TFunction<'settings'>
}

function DangerConfirmDialog({ saving, onConfirm, onCancel, t }: DangerConfirmProps) {
  const [token, setToken] = useState('')
  const required = t('dangerConfirm.token')
  const tokenMatch = token === required
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // autoFocus via a brief timeout so the dialog has rendered
    const id = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(id)
  }, [])

  return (
    <DialogShell onBackdropClick={onCancel} labelledBy="settings-danger-title">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="triangle-alert" size={16} className="text-[#FDBA74] light:text-amber-700 flex-shrink-0" />
        <h3 id="settings-danger-title" className="text-[15px] font-semibold text-[#FDBA74] light:text-amber-700">
          {t('dangerConfirm.title')}
        </h3>
      </div>
      <p className="text-[13px] text-text-tertiary mb-4">
        {t('dangerConfirm.body')}
      </p>
      <Field label={t('dangerConfirm.tokenLabel')}>
        {/* We use a native input here for the ref + id association */}
        <input
          ref={inputRef}
          id="danger-confirm-token"
          type="text"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder={required}
          autoFocus
          className="w-full h-9 px-3 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[var(--color-focus-ring)] transition-all duration-150 font-mono tracking-tight"
        />
      </Field>
      <div className="flex justify-end gap-2 mt-4">
        <Btn variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          {t('confirm.cancel')}
        </Btn>
        <Btn
          variant="danger"
          size="sm"
          onClick={onConfirm}
          disabled={!tokenMatch || saving}
        >
          {saving ? t('confirm.saving') : t('dangerConfirm.confirmBtn')}
        </Btn>
      </div>
    </DialogShell>
  )
}

// ─── seed admin confirm dialog ────────────────────────────────────────────────

interface SeedConfirmProps {
  working: string[]
  saving: boolean
  onConfirm: () => void
  onCancel: () => void
  t: TFunction<'settings'>
}

function SeedConfirmDialog({ working, saving, onConfirm, onCancel, t }: SeedConfirmProps) {
  return (
    <DialogShell onBackdropClick={onCancel} labelledBy="seed-confirm-title">
      <h3 id="seed-confirm-title" className="text-[15px] font-semibold text-text-primary mb-2">
        {t('seedAdmins.confirmTitle')}
      </h3>
      <p className="text-[13px] text-text-tertiary mb-4">
        {working.length > 0
          ? t('seedAdmins.confirmBody', { list: working.join(', ') })
          : t('seedAdmins.empty')}
      </p>
      <div className="flex justify-end gap-2">
        <Btn variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          {t('confirm.cancel')}
        </Btn>
        <Btn variant="primary" size="sm" onClick={onConfirm} disabled={saving}>
          {saving ? t('confirm.saving') : t('confirm.ok')}
        </Btn>
      </div>
    </DialogShell>
  )
}

// ─── main panel ──────────────────────────────────────────────────────────────

export interface AuthSettingsPanelProps {
  repository: AuthSettingsRepository
}

export function AuthSettingsPanel({ repository }: AuthSettingsPanelProps) {
  const { t } = useTranslation('settings')
  const { user, role } = useAuth()

  // remote-load state
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)

  // ── domain list state ──────────────────────────────────────────────────────
  const [savedDomains, setSavedDomains]     = useState<string[]>([])
  const [workingDomains, setWorkingDomains] = useState<string[]>([])

  // add-row state (domains)
  const [draftDomain, setDraftDomain]         = useState('')
  const [addDomainError, setAddDomainError]   = useState<string | null>(null)

  // save-flow state (domains)
  const [savingDomains, setSavingDomains]             = useState(false)
  const [saveDomainError, setSaveDomainError]         = useState<string | null>(null)
  const [saveDomainSuccess, setSaveDomainSuccess]     = useState(false)
  const [domainDialogOpen, setDomainDialogOpen]       = useState<'standard' | 'danger' | null>(null)

  // ── seed-admin list state ──────────────────────────────────────────────────
  const [savedSeed, setSavedSeed]     = useState<string[]>([])
  const [workingSeed, setWorkingSeed] = useState<string[]>([])

  // add-row state (seed emails)
  const [draftSeed, setDraftSeed]       = useState('')
  const [addSeedError, setAddSeedError] = useState<string | null>(null)

  // save-flow state (seed emails)
  const [savingSeed, setSavingSeed]           = useState(false)
  const [saveSeedError, setSaveSeedError]     = useState<string | null>(null)
  const [saveSeedSuccess, setSaveSeedSuccess] = useState(false)
  const [seedDialogOpen, setSeedDialogOpen]   = useState(false)

  // ── load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const settings = await repository.getAuthSettings()
      setSavedDomains(settings.allowedEmailDomains)
      setWorkingDomains(settings.allowedEmailDomains)
      const seed = settings.seedSuperAdmins ?? []
      setSavedSeed(seed)
      setWorkingSeed(seed)
    } catch {
      setLoadError('error')
    } finally {
      setLoading(false)
    }
  }, [repository])

  useEffect(() => { void load() }, [load])

  // ── domain dirty check ─────────────────────────────────────────────────────

  const savedDomainSet = new Set(savedDomains)
  const domainDirty = workingDomains.length !== savedDomains.length ||
    workingDomains.some(d => !savedDomainSet.has(d))

  // ── seed dirty check ───────────────────────────────────────────────────────

  const savedSeedSet = new Set(savedSeed)
  const seedDirty = workingSeed.length !== savedSeed.length ||
    workingSeed.some(e => !savedSeedSet.has(e))

  // ── domain handlers ────────────────────────────────────────────────────────

  function handleAddDomain() {
    setAddDomainError(null)
    const d = normalizeDomain(draftDomain)
    if (draftDomain.trim() === '' || d === '') {
      setAddDomainError(t('validation.empty'))
      return
    }
    if (!isValidDomain(d)) {
      setAddDomainError(t('validation.invalid'))
      return
    }
    if (workingDomains.some(x => x.toLowerCase() === d.toLowerCase())) {
      setAddDomainError(t('validation.duplicate'))
      return
    }
    setWorkingDomains(prev => [...prev, d])
    setDraftDomain('')
  }

  function handleRemoveDomain(domain: string) {
    setWorkingDomains(prev => prev.filter(x => x !== domain))
  }

  function handleDomainKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddDomain() }
  }

  function openDomainSaveDialog() {
    setSaveDomainError(null)
    setSaveDomainSuccess(false)
    setDomainDialogOpen(workingDomains.length === 0 ? 'danger' : 'standard')
  }

  async function performDomainSave() {
    setSavingDomains(true)
    try {
      const { value } = await repository.updateAllowedDomains(workingDomains, { uid: user.id, role, displayName: user.name })
      setSavedDomains(value.allowedEmailDomains)
      setWorkingDomains(value.allowedEmailDomains)
      setDomainDialogOpen(null)
      setSaveDomainSuccess(true)
    } catch {
      setSaveDomainError(t('saveFailed'))
    } finally {
      setSavingDomains(false)
    }
  }

  // ── seed-admin handlers ────────────────────────────────────────────────────

  function handleAddSeed() {
    setAddSeedError(null)
    const e = normalizeEmail(draftSeed)
    if (!e) {
      setAddSeedError(t('seedAdmins.validation.empty'))
      return
    }
    if (!isValidEmail(e)) {
      setAddSeedError(t('seedAdmins.validation.invalid'))
      return
    }
    if (workingSeed.some(x => x.toLowerCase() === e.toLowerCase())) {
      setAddSeedError(t('seedAdmins.validation.duplicate'))
      return
    }
    setWorkingSeed(prev => [...prev, e])
    setDraftSeed('')
  }

  function handleRemoveSeed(email: string) {
    setWorkingSeed(prev => prev.filter(x => x !== email))
  }

  function handleSeedKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAddSeed() }
  }

  async function performSeedSave() {
    setSavingSeed(true)
    try {
      const { value } = await repository.updateSeedAdmins(workingSeed, { uid: user.id, role, displayName: user.name })
      const next = value.seedSuperAdmins ?? []
      setSavedSeed(next)
      setWorkingSeed(next)
      setSeedDialogOpen(false)
      setSaveSeedSuccess(true)
    } catch {
      setSaveSeedError(t('seedAdmins.saveFailed'))
    } finally {
      setSavingSeed(false)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <SectionCard title={t('auth.title')} icon="shield-check">
        <ErrorState onRetry={load} />
      </SectionCard>
    )
  }

  return (
    <SectionCard title={t('auth.title')} icon="shield-check">
      <div className="space-y-8">

        {/* ── DOMAIN LIST SECTION ────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* subtitle — always real (local i18n, not async) */}
          <p className="text-[13px] text-text-subtle">{t('auth.subtitle')}</p>

          {/* fail-closed banner — only when loaded and list is empty */}
          {!loading && workingDomains.length === 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-orange-900/60 light:border-orange-300 bg-accent/8 light:bg-orange-50"
            >
              <Icon name="triangle-alert" size={15} className="text-[#FDBA74] light:text-amber-700 flex-shrink-0 mt-0.5" />
              <p className="text-[13px] text-[#FDBA74] light:text-amber-700">{t('failClosed.banner')}</p>
            </div>
          )}

          {/* domain list — shimmer rows while loading, real list when loaded */}
          {loading ? (
            <div className="space-y-1.5" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-bg min-h-[36px]">
                  <div className="h-[13px] rounded anim-skeleton" style={{ width: `${40 + i * 12}%` }} />
                  <div className="w-6 h-6 max-md:w-8 max-md:h-8 rounded anim-skeleton flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : workingDomains.length > 0 ? (
            <ul className="space-y-1.5" aria-label={t('auth.domainsListLabel')}>
              {workingDomains.map(domain => (
                <li
                  key={domain}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-bg"
                >
                  <span className="font-mono text-[13px] text-text-primary">{domain}</span>
                  <button
                    type="button"
                    aria-label={t('auth.removeAria', { domain })}
                    onClick={() => handleRemoveDomain(domain)}
                    className="w-6 h-6 max-md:w-8 max-md:h-8 rounded flex items-center justify-center text-text-subtle hover:text-[#FDA4AF] light:hover:text-rose-700 hover:bg-rose-950/40 light:hover:bg-rose-50 transition-colors"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text-subtle italic">{t('auth.empty')}</p>
          )}

          {/* add row — always real; inputs disabled while loading */}
          <div className="space-y-1.5">
            <Field label={t('auth.addLabel')}>
              <div className="flex gap-2" onKeyDown={handleDomainKeyDown}>
                <Input
                  id="auth-add-domain"
                  value={draftDomain}
                  onChange={setDraftDomain}
                  placeholder={t('auth.addPlaceholder')}
                  disabled={loading}
                />
                <Btn variant="secondary" size="sm" onClick={handleAddDomain} disabled={loading}>
                  <Icon name="plus" size={13} />
                  {t('auth.addBtn')}
                </Btn>
              </div>
            </Field>
            {!loading && addDomainError && (
              <p role="alert" className="text-[12px] text-[#FDA4AF] light:text-rose-700">{addDomainError}</p>
            )}
          </div>

          {/* domain save feedback */}
          {saveDomainError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] light:text-rose-700">{saveDomainError}</p>
          )}
          {saveDomainSuccess && !domainDirty && (
            <p className="text-[12px] text-emerald-400 light:text-emerald-700">{t('saved')}</p>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Btn
              variant="primary"
              size="md"
              disabled={loading || !domainDirty || savingDomains}
              onClick={openDomainSaveDialog}
            >
              {savingDomains ? t('saving') : t('auth.saveBtn')}
            </Btn>
          </div>
        </div>

        {/* ── SEED ADMINS SECTION ────────────────────────────────────────── */}
        <div className="space-y-5 pt-2 border-t border-border">
          <div>
            <h3 className="text-[13px] font-semibold text-text-primary mb-1">
              {t('seedAdmins.title')}
            </h3>
            <p className="text-[13px] text-text-subtle">{t('seedAdmins.subtitle')}</p>
          </div>

          {/* seed email list */}
          {loading ? (
            <div className="space-y-1.5" aria-hidden="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-bg min-h-[36px]">
                  <div className="h-[13px] rounded anim-skeleton" style={{ width: `${50 + i * 15}%` }} />
                  <div className="w-6 h-6 max-md:w-8 max-md:h-8 rounded anim-skeleton flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : workingSeed.length > 0 ? (
            <ul className="space-y-1.5" aria-label={t('seedAdmins.listLabel')}>
              {workingSeed.map(email => (
                <li
                  key={email}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-bg"
                >
                  <span className="font-mono text-[13px] text-text-primary">{email}</span>
                  <button
                    type="button"
                    aria-label={t('seedAdmins.removeAria', { email })}
                    onClick={() => handleRemoveSeed(email)}
                    className="w-6 h-6 max-md:w-8 max-md:h-8 rounded flex items-center justify-center text-text-subtle hover:text-[#FDA4AF] light:hover:text-rose-700 hover:bg-rose-950/40 light:hover:bg-rose-50 transition-colors"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-text-subtle italic">{t('seedAdmins.empty')}</p>
          )}

          {/* add seed email row */}
          <div className="space-y-1.5">
            <Field label={t('seedAdmins.addLabel')}>
              <div className="flex gap-2" onKeyDown={handleSeedKeyDown}>
                <Input
                  id="auth-add-seed"
                  value={draftSeed}
                  onChange={setDraftSeed}
                  placeholder={t('seedAdmins.addPlaceholder')}
                  disabled={loading}
                />
                <Btn variant="secondary" size="sm" onClick={handleAddSeed} disabled={loading}>
                  <Icon name="plus" size={13} />
                  {t('seedAdmins.addBtn')}
                </Btn>
              </div>
            </Field>
            {!loading && addSeedError && (
              <p role="alert" className="text-[12px] text-[#FDA4AF] light:text-rose-700">{addSeedError}</p>
            )}
          </div>

          {/* seed save feedback */}
          {saveSeedError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] light:text-rose-700">{saveSeedError}</p>
          )}
          {saveSeedSuccess && !seedDirty && (
            <p className="text-[12px] text-emerald-400 light:text-emerald-700">{t('seedAdmins.saved')}</p>
          )}

          <div className="flex justify-end pt-2 border-t border-border">
            <Btn
              variant="primary"
              size="md"
              disabled={loading || !seedDirty || savingSeed}
              onClick={() => { setSaveSeedError(null); setSaveSeedSuccess(false); setSeedDialogOpen(true) }}
            >
              {savingSeed ? t('saving') : t('seedAdmins.saveBtn')}
            </Btn>
          </div>
        </div>

      </div>

      {/* ── dialogs ─────────────────────────────────────────────────────── */}
      {domainDialogOpen === 'standard' && (
        <StandardConfirmDialog
          working={workingDomains}
          saving={savingDomains}
          onConfirm={performDomainSave}
          onCancel={() => setDomainDialogOpen(null)}
          t={t}
        />
      )}
      {domainDialogOpen === 'danger' && (
        <DangerConfirmDialog
          saving={savingDomains}
          onConfirm={performDomainSave}
          onCancel={() => setDomainDialogOpen(null)}
          t={t}
        />
      )}
      {seedDialogOpen && (
        <SeedConfirmDialog
          working={workingSeed}
          saving={savingSeed}
          onConfirm={performSeedSave}
          onCancel={() => setSeedDialogOpen(false)}
          t={t}
        />
      )}
    </SectionCard>
  )
}
