import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  SectionCard, Btn, Icon, Field, Input, LoadingState, ErrorState,
} from '@/components/ui'
import {
  normalizeDomain, isValidDomain,
  type AuthSettingsRepository,
} from '@/domain/settings'

// ─── inline dialog markup ────────────────────────────────────────────────────

interface DialogShellProps {
  onBackdropClick: () => void
  children: React.ReactNode
}

function DialogShell({ onBackdropClick, children }: DialogShellProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onBackdropClick() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onBackdropClick])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[440px] max-w-[90vw] rounded-lg border border-[#2A2F36] bg-[#1B1F24] p-5"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
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
    <DialogShell onBackdropClick={onCancel}>
      <h3 className="text-[15px] font-semibold text-[#F8FAFC] mb-2">
        {t('confirm.title')}
      </h3>
      <p className="text-[13px] text-[#94A3B8] mb-4">
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
    <DialogShell onBackdropClick={onCancel}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="triangle-alert" size={16} className="text-[#FDBA74] flex-shrink-0" />
        <h3 className="text-[15px] font-semibold text-[#FDBA74]">
          {t('dangerConfirm.title')}
        </h3>
      </div>
      <p className="text-[13px] text-[#94A3B8] mb-4">
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
          className="w-full h-9 px-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 font-mono tracking-tight"
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

  // domain list state
  const [saved, setSaved]     = useState<string[]>([])
  const [working, setWorking] = useState<string[]>([])

  // add-row state
  const [draft, setDraft]         = useState('')
  const [addError, setAddError]   = useState<string | null>(null)

  // save-flow state
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [dialogOpen, setDialogOpen]   = useState<'standard' | 'danger' | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const settings = await repository.getAuthSettings()
      setSaved(settings.allowedEmailDomains)
      setWorking(settings.allowedEmailDomains)
    } catch {
      setLoadError('error')
    } finally {
      setLoading(false)
    }
  }, [repository])

  useEffect(() => { void load() }, [load])

  const dirty = JSON.stringify(working) !== JSON.stringify(saved)

  function handleAdd() {
    setAddError(null)
    const d = normalizeDomain(draft)
    if (!isValidDomain(d)) {
      setAddError(t('validation.invalid'))
      return
    }
    if (working.some(x => x.toLowerCase() === d.toLowerCase())) {
      setAddError(t('validation.duplicate'))
      return
    }
    setWorking(prev => [...prev, d])
    setDraft('')
  }

  function handleRemove(domain: string) {
    setWorking(prev => prev.filter(x => x !== domain))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  function openSaveDialog() {
    setSaveError(null)
    setSaveSuccess(false)
    if (working.length === 0) {
      setDialogOpen('danger')
    } else {
      setDialogOpen('standard')
    }
  }

  async function performSave() {
    setSaving(true)
    try {
      await repository.updateAllowedDomains(working, { uid: user.id, role })
      const readback = await repository.getAuthSettings()
      setSaved(readback.allowedEmailDomains)
      setWorking(readback.allowedEmailDomains)
      setDialogOpen(null)
      setSaveSuccess(true)
    } catch {
      setSaveError(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDialogOpen(null)
  }

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SectionCard title={t('auth.title')} icon="shield-check">
        <LoadingState rows={3} />
      </SectionCard>
    )
  }

  if (loadError) {
    return (
      <SectionCard title={t('auth.title')} icon="shield-check">
        <ErrorState onRetry={load} />
      </SectionCard>
    )
  }

  return (
    <SectionCard title={t('auth.title')} icon="shield-check">
      <div className="space-y-5">
        {/* subtitle */}
        <p className="text-[13px] text-[#64748B]">{t('auth.subtitle')}</p>

        {/* fail-closed banner */}
        {working.length === 0 && (
          <div
            role="alert"
            className="flex items-start gap-2.5 px-4 py-3 rounded-lg border"
            style={{
              borderColor: '#7c2d12',
              background: 'rgba(249,115,22,0.08)',
            }}
          >
            <Icon name="triangle-alert" size={15} className="text-[#FDBA74] flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#FDBA74]">{t('failClosed.banner')}</p>
          </div>
        )}

        {/* domain list */}
        {working.length > 0 ? (
          <ul className="space-y-1.5" aria-label={t('auth.domainsListLabel')}>
            {working.map(domain => (
              <li
                key={domain}
                className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2F36] bg-[#111315]"
              >
                <span className="font-mono text-[13px] text-[#F8FAFC]">{domain}</span>
                <button
                  type="button"
                  aria-label={t('auth.removeAria', { domain })}
                  onClick={() => handleRemove(domain)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#64748B] hover:text-[#FDA4AF] hover:bg-rose-950/40 transition-colors"
                >
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#64748B] italic">{t('auth.empty')}</p>
        )}

        {/* add row */}
        <div className="space-y-1.5">
          <Field label={t('auth.addLabel')}>
            <div
              className="flex gap-2"
              onKeyDown={handleKeyDown}
            >
              <Input
                id="auth-add-domain"
                value={draft}
                onChange={setDraft}
                placeholder={t('auth.addPlaceholder')}
              />
              <Btn variant="secondary" size="sm" onClick={handleAdd}>
                <Icon name="plus" size={13} />
                {t('auth.addBtn')}
              </Btn>
            </div>
          </Field>
          {addError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF]">{addError}</p>
          )}
        </div>

        {/* save error */}
        {saveError && (
          <p role="alert" className="text-[12px] text-[#FDA4AF]">{saveError}</p>
        )}

        {/* save success */}
        {saveSuccess && !dirty && (
          <p className="text-[12px] text-emerald-400">{t('saved')}</p>
        )}

        {/* save button */}
        <div className="flex justify-end pt-2 border-t border-[#2A2F36]">
          <Btn
            variant="primary"
            size="md"
            disabled={!dirty || saving}
            onClick={openSaveDialog}
          >
            {saving ? t('saving') : t('auth.saveBtn')}
          </Btn>
        </div>
      </div>

      {/* dialogs */}
      {dialogOpen === 'standard' && (
        <StandardConfirmDialog
          working={working}
          saving={saving}
          onConfirm={performSave}
          onCancel={handleCancel}
          t={t}
        />
      )}
      {dialogOpen === 'danger' && (
        <DangerConfirmDialog
          saving={saving}
          onConfirm={performSave}
          onCancel={handleCancel}
          t={t}
        />
      )}
    </SectionCard>
  )
}
