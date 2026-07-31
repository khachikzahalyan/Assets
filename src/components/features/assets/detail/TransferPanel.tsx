import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch, TransferTarget } from '@/domain/asset/transferRules'
import { buildTransferPatch } from '@/domain/asset/transferRules'
import { Icon } from '@/components/ui'
import { DatePicker } from '@/components/ui'
import { SearchSelect } from '@/components/features/assets/create/SearchSelect'
import { ModeTile } from './ModeTile'
import { sendAccessEmail } from '@/lib/notifications/sendAccessEmail'

// ---------------------------------------------------------------------------
// Transfer mode definitions
// ---------------------------------------------------------------------------

interface TransferMode {
  id: string
  icon: string
  labelKey: string
}

const TRANSFER_MODES: TransferMode[] = [
  { id: 'warehouse',  icon: 'warehouse',    labelKey: 'detail.transfer.modeWarehouse'   },
  { id: 'employee',   icon: 'user-round',   labelKey: 'detail.transfer.modeEmployee'    },
  { id: 'branch',     icon: 'git-branch',   labelKey: 'detail.transfer.modeBranch'      },
  { id: 'department', icon: 'layout-list',  labelKey: 'detail.transfer.modeDepartment'  },
  { id: 'temporary',  icon: 'timer',        labelKey: 'detail.transfer.modeTemporary'   },
]

// ---------------------------------------------------------------------------
// Inline mode-specific form (key={mode} causes remount on change → animation)
// ---------------------------------------------------------------------------

interface ModeFormProps {
  mode: string
  refData: AssetReferenceData
  caps: CategoryCapabilities | null
  employeeId: string; setEmployeeId: (v: string) => void
  branchId: string;   setBranchId: (v: string) => void
  departmentId: string; setDepartmentId: (v: string) => void
  tempKind: string;   setTempKind: (v: string) => void
  returnDate: string; setReturnDate: (v: string) => void
  workMode: 'office' | 'remote'; setWorkMode: (v: 'office' | 'remote') => void
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function TransferModeForm({
  mode, refData, caps,
  employeeId, setEmployeeId,
  branchId, setBranchId,
  departmentId, setDepartmentId,
  tempKind, setTempKind,
  returnDate, setReturnDate,
  workMode, setWorkMode,
}: ModeFormProps) {
  const { t } = useTranslation('assets')

  return (
    <div className="anim-mode-in space-y-2">

      {mode === 'employee' && (
        <div className="mt-2 space-y-2">
          <div>
            <SearchSelect
              value={employeeId}
              onChange={setEmployeeId}
              placeholder={t('detail.transfer.employeePlaceholder')}
              searchPlaceholder={t('placeholders.recipientSearch')}
              ariaLabel={t('detail.transfer.employeeLabel')}
              title={t('detail.transfer.employeeLabel')}
              options={refData.employees
                .filter(e => !e.former)
                .map(e => {
                  const deptName = e.departmentId
                    ? refData.departments.find(d => d.id === e.departmentId)?.name
                    : undefined
                  const meta = [e.position, deptName].filter(Boolean).join(' · ')
                  return {
                    value: e.id,
                    label: [e.firstName, e.lastName].filter(Boolean).join(' '),
                    ...(meta ? { meta } : {}),
                  }
                })}
            />
          </div>
          {caps?.isLaptop && (
            <div>
              <label className="block text-12 uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1.5">
                {t('detail.transfer.workModeLabel')}
              </label>
              {/* Segmented control: inset p-1 pocket so the active pill floats with
                  its own radius. Mode colors follow the app palette: office =
                  emerald (location/branch tone), remote = cyan (the same tone as
                  the «УДАЛЁННЫЙ» badge on asset rows). */}
              <div className="flex gap-1 p-1 bg-bg border border-border rounded-[10px]">
                {(['office', 'remote'] as const).map(wm => (
                  <button
                    key={wm}
                    type="button"
                    onClick={() => setWorkMode(wm)}
                    aria-pressed={workMode === wm}
                    className={`flex-1 h-8 max-md:h-9 rounded-[7px] inline-flex items-center justify-center gap-1.5 text-13 font-semibold transition-colors
                      ${workMode === wm
                        ? wm === 'office'
                          ? 'bg-emerald-500/15 text-emerald-300 light:text-emerald-700 ring-1 ring-inset ring-emerald-500/30'
                          : 'bg-cyan-500/15 text-cyan-300 light:text-cyan-700 ring-1 ring-inset ring-cyan-500/30'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
                      }`}
                  >
                    <Icon name={wm === 'office' ? 'building-2' : 'house'} size={13} aria-hidden="true" />
                    {wm === 'office' ? t('detail.transfer.workModeOffice') : t('detail.transfer.workModeRemote')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'branch' && (
        <div className="mt-2">
          <SearchSelect
            value={branchId}
            onChange={setBranchId}
            placeholder={t('detail.transfer.branchPlaceholder')}
            searchPlaceholder={t('placeholders.recipientSearch')}
            ariaLabel={t('detail.transfer.branchLabel')}
            title={t('detail.transfer.branchLabel')}
            options={refData.branches.map(b => ({ value: b.id, label: b.name }))}
          />
        </div>
      )}

      {mode === 'department' && (
        <div className="mt-2">
          <SearchSelect
            value={departmentId}
            onChange={setDepartmentId}
            placeholder={t('detail.transfer.departmentPlaceholder')}
            searchPlaceholder={t('placeholders.recipientSearch')}
            ariaLabel={t('detail.transfer.departmentLabel')}
            title={t('detail.transfer.departmentLabel')}
            options={refData.departments.map(d => ({ value: d.id, label: d.name }))}
          />
        </div>
      )}

      {mode === 'temporary' && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-12 uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
                {t('detail.transfer.kindLabel')}
              </label>
              <SearchSelect
                value={tempKind}
                onChange={setTempKind}
                placeholder={t('detail.transfer.kindPlaceholder')}
                searchPlaceholder={t('placeholders.recipientSearch')}
                ariaLabel={t('detail.transfer.kindLabel')}
                title={t('detail.transfer.kindLabel')}
                options={[
                  { value: 'audit', label: t('detail.transfer.kindAudit') },
                  { value: 'intern', label: t('detail.transfer.kindIntern') },
                ]}
              />
            </div>
            <div>
              <label htmlFor="transfer-return-date" className="block text-12 uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
                {t('detail.transfer.returnDateLabel')}
              </label>
              <DatePicker
                id="transfer-return-date"
                value={returnDate}
                onChange={setReturnDate}
                placeholder={t('detail.transfer.returnDatePlaceholder')}
              />
            </div>
          </div>
          {/* Work mode is intentionally omitted for temporary transfers — it is
              always «Основной» (office), set automatically in handleCommit. */}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TransferPanel
// ---------------------------------------------------------------------------

export interface TransferPanelProps {
  asset: Asset
  refData: AssetReferenceData
  caps: CategoryCapabilities | null
  busy: boolean
  onCommit: (patch: TransferPatch) => void
  onCancel: () => void
  /**
   * When true the panel is rendered inline/always-visible on mobile
   * (AssignmentCardMobile). «Отмена» resets the picker selection to null
   * instead of calling onCancel (which would close the panel on desktop).
   * Also removes the border-t / mt-2 wrapper padding.
   * Desktop panels never set this — only AssignmentCardMobile.
   */
  mobileInline?: boolean
}

export function TransferPanel({ asset: _asset, refData, caps, busy, onCommit, onCancel, mobileInline = false }: TransferPanelProps) {
  const { t } = useTranslation('assets')
  const todayStr = todayISO()

  const [mode, setMode]             = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [branchId, setBranchId]     = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [tempKind, setTempKind]     = useState('')
  const [returnDate, setReturnDate] = useState(todayStr)
  const [workMode, setWorkMode]     = useState<'office' | 'remote'>('office')

  // Validate whether the current selection is ready to commit
  const isValid = (() => {
    if (!mode) return false
    if (mode === 'warehouse')  return true
    if (mode === 'employee')   return !!employeeId
    if (mode === 'branch')     return !!branchId
    if (mode === 'department') return !!departmentId
    if (mode === 'temporary')  return !!tempKind && !!returnDate
    return false
  })()

  function handleCommit() {
    if (!isValid || busy) return
    let target: TransferTarget
    if (mode === 'warehouse') {
      target = { mode: 'warehouse' }
    } else if (mode === 'employee') {
      target = { mode: 'employee', employeeId, ...(caps?.isLaptop ? { workMode } : {}) }
    } else if (mode === 'branch') {
      target = { mode: 'branch', branchId }
    } else if (mode === 'department') {
      target = { mode: 'department', departmentId }
    } else if (mode === 'temporary') {
      target = {
        mode: 'temporary',
        tempKind: tempKind as 'audit' | 'intern',
        expiresAt: returnDate,
        ...(caps?.isLaptop ? { workMode } : {}),
      }
    } else {
      return
    }

    // Resolve employee's dept if available. EmployeeRow's field is `departmentId`
    // (NOT `deptId`) — the old cast read a non-existent field and always yielded
    // null, so every employee transfer silently wrote deptId: null onto the asset.
    const empRow = mode === 'employee'
      ? refData.employees.find(e => e.id === employeeId)
      : undefined
    const employeeDeptId = empRow?.departmentId ?? null

    const patch = buildTransferPatch(target, employeeDeptId)
    onCommit(patch)

    // Best-effort: notify the receiving employee by email (never blocks the transfer).
    if (mode === 'employee' && empRow?.email?.trim()) {
      const label = [_asset.brand, _asset.model].filter(Boolean).join(' ').trim() || _asset.invCode
      void sendAccessEmail({
        email: empRow.email.trim(),
        name: `${empRow.firstName ?? ''} ${empRow.lastName ?? ''}`.trim() || empRow.email.trim(),
        kind: 'asset',
        assetLabel: label,
        assetCode: _asset.invCode,
        assetId: _asset.id,
      })
    }
  }

  // Reset per-mode target fields when mode changes
  function handleModeChange(newMode: string) {
    setMode(newMode)
    setEmployeeId('')
    setBranchId('')
    setDepartmentId('')
    setTempKind('')
    setReturnDate(todayStr)
    setWorkMode('office')
  }

  // Mobile-inline only: «Отмена» resets target selection without closing the panel
  function handleReset() {
    setMode(null)
    setEmployeeId('')
    setBranchId('')
    setDepartmentId('')
    setTempKind('')
    setReturnDate(todayStr)
    setWorkMode('office')
  }

  return (
    <div className={`anim-fade-slide-in ${mobileInline ? '' : 'mt-2 border-t border-border pt-2'}`}>
      {/* Divider header — desktop only (side-dividers). Mobile hides it entirely. */}
      {!mobileInline && (
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-surface-2" />
          <span className="text-12 text-text-tertiary uppercase tracking-widest whitespace-nowrap">
            {t('detail.transfer.title')}
          </span>
          <div className="flex-1 h-px bg-surface-2" />
        </div>
      )}

      {/* Mode tiles row — 5 tiles in one row on all sizes; tighter gap on desktop-mobile */}
      <div className={`grid grid-cols-5 ${mobileInline ? 'gap-1 mb-[0.8125rem]' : 'gap-1.5 max-md:gap-1'}`}>
        {TRANSFER_MODES.map(m => (
          <ModeTile
            key={m.id}
            icon={m.icon}
            label={t(m.labelKey)}
            selected={mode === m.id}
            onClick={() => handleModeChange(m.id)}
          />
        ))}
      </div>

      {/* Per-mode form — reserved slot prevents right-column jump when mode is picked */}
      <div className="lg:min-h-[64px]">
        {mode && (
          <TransferModeForm
            key={mode}
            mode={mode}
            refData={refData}
            caps={caps}
            employeeId={employeeId} setEmployeeId={setEmployeeId}
            branchId={branchId}     setBranchId={setBranchId}
            departmentId={departmentId} setDepartmentId={setDepartmentId}
            tempKind={tempKind}     setTempKind={setTempKind}
            returnDate={returnDate} setReturnDate={setReturnDate}
            workMode={workMode}     setWorkMode={setWorkMode}
          />
        )}
      </div>

      {/* Footer: Cancel + Commit */}
      <div className={`flex pt-0.5 ${mobileInline ? 'mt-0 gap-2.5' : 'mt-2 gap-2'}`}>
        <button
          type="button"
          onClick={mobileInline ? handleReset : onCancel}
          disabled={busy}
          className={`flex items-center justify-center border border-border text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50
            ${mobileInline
              ? 'flex-none px-4 py-2 rounded-lg text-13 font-semibold'
              : 'flex-1 py-1.5 max-md:py-2 rounded-xl text-14 font-medium'
            }`}
        >
          {t('detail.transfer.cancel')}
        </button>
        <button
          type="button"
          onClick={handleCommit}
          disabled={!isValid || busy}
          className={`flex-1 flex items-center justify-center gap-1.5 bg-accent text-white hover:bg-accent-hover disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-sm
            ${mobileInline
              ? 'py-2 rounded-lg text-13 font-semibold'
              : 'py-1.5 max-md:py-2 rounded-xl text-14'
            }`}
        >
          {busy
            ? <Icon name="loader-circle" size={14} className="animate-spin" />
            : <Icon name="send" size={13} />
          }
          {t('detail.transfer.commit')}
        </button>
      </div>
    </div>
  )
}
