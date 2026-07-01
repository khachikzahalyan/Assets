import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch, TransferTarget } from '@/domain/asset/transferRules'
import { buildTransferPatch } from '@/domain/asset/transferRules'
import { Icon } from '@/components/ui'
import { DatePicker } from '@/components/features/assets/create/DatePicker'
import { SearchSelect } from '@/components/features/assets/create/SearchSelect'
import { ModeTile } from './ModeTile'

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
              options={refData.employees.map(e => ({
                value: e.id,
                label: [e.firstName, e.lastName].filter(Boolean).join(' '),
              }))}
            />
          </div>
          {caps?.isLaptop && (
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
                {t('detail.transfer.workModeLabel')}
              </label>
              <div className="flex items-center gap-1 h-8 max-md:h-9 bg-bg border border-border rounded-lg overflow-hidden">
                {(['office', 'remote'] as const).map((wm, i) => (
                  <button
                    key={wm}
                    type="button"
                    onClick={() => setWorkMode(wm)}
                    className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''}
                      ${workMode === wm
                        ? 'bg-accent text-white'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'
                      }`}
                  >
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
              <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
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
              <label htmlFor="transfer-return-date" className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
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

    // Resolve employee's dept if available
    const empRow = mode === 'employee'
      ? refData.employees.find(e => e.id === employeeId)
      : undefined
    const employeeDeptId = (empRow as { deptId?: string | null } | undefined)?.deptId ?? null

    const patch = buildTransferPatch(target, employeeDeptId)
    onCommit(patch)
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
          <span className="text-[12px] text-text-tertiary uppercase tracking-widest whitespace-nowrap">
            {t('detail.transfer.title')}
          </span>
          <div className="flex-1 h-px bg-surface-2" />
        </div>
      )}

      {/* Mode tiles row — 5 tiles in one row on all sizes; tighter gap on desktop-mobile */}
      <div className={`grid grid-cols-5 ${mobileInline ? 'gap-1 mb-[13px]' : 'gap-1.5 max-md:gap-1'}`}>
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
      <div className={`flex pt-0.5 ${mobileInline ? 'mt-0 gap-[10px]' : 'mt-2 gap-2'}`}>
        <button
          type="button"
          onClick={mobileInline ? handleReset : onCancel}
          disabled={busy}
          className={`flex items-center justify-center border border-border text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50
            ${mobileInline
              ? 'flex-none px-4 py-2 rounded-lg text-[13px] font-semibold'
              : 'flex-1 py-1.5 max-md:py-2 rounded-xl text-[14px] font-medium'
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
              ? 'py-2 rounded-lg text-[13px] font-semibold'
              : 'py-1.5 max-md:py-2 rounded-xl text-[14px]'
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
