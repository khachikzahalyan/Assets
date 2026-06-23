import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch, TransferTarget } from '@/domain/asset/transferRules'
import { buildTransferPatch } from '@/domain/asset/transferRules'
import { Icon, Btn, Select } from '@/components/ui'
import { DatePicker } from '@/components/features/assets/create/DatePicker'
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

// Per-mode context banner config (dark-adapted from prototype)
interface BannerConfig {
  icon: string
  labelKey: string
  hintKey: string
  softBg: string
  softText: string
  ring: string
}

const MODE_CONTEXT_BANNER: Record<string, BannerConfig> = {
  warehouse:  {
    icon: 'warehouse',   labelKey: 'detail.transfer.bannerWarehouseLabel',  hintKey: 'detail.transfer.bannerWarehouseHint',
    softBg: 'bg-[#22272E]',     softText: 'text-[#94A3B8]',  ring: 'ring-[#2A2F36]',
  },
  employee:   {
    icon: 'user-round',  labelKey: 'detail.transfer.bannerEmployeeLabel',   hintKey: 'detail.transfer.bannerEmployeeHint',
    softBg: 'bg-violet-500/10', softText: 'text-violet-300', ring: 'ring-violet-500/30',
  },
  branch:     {
    icon: 'git-branch',  labelKey: 'detail.transfer.bannerBranchLabel',     hintKey: 'detail.transfer.bannerBranchHint',
    softBg: 'bg-[#F97316]/10',  softText: 'text-[#FB923C]',  ring: 'ring-[#F97316]/30',
  },
  department: {
    icon: 'layout-list', labelKey: 'detail.transfer.bannerDepartmentLabel', hintKey: 'detail.transfer.bannerDepartmentHint',
    softBg: 'bg-amber-500/10',  softText: 'text-amber-300',  ring: 'ring-amber-500/30',
  },
  temporary:  {
    icon: 'timer',       labelKey: 'detail.transfer.bannerTemporaryLabel',  hintKey: 'detail.transfer.bannerTemporaryHint',
    softBg: 'bg-rose-500/10',   softText: 'text-rose-300',   ring: 'ring-rose-500/30',
  },
}

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
  const banner = MODE_CONTEXT_BANNER[mode]

  return (
    <div className="anim-mode-in space-y-2">
      {/* Context banner */}
      {banner && (
        <div className={`flex items-start gap-2.5 px-3 py-2 rounded-xl ${banner.softBg} ring-1 ${banner.ring} mt-3`}>
          <Icon name={banner.icon} size={14} className={`${banner.softText} mt-0.5 shrink-0`} />
          <div className="flex flex-col min-w-0">
            <span className={`text-[13px] font-semibold ${banner.softText}`}>{t(banner.labelKey)}</span>
            <span className={`text-[12.5px] ${banner.softText} opacity-80`}>{t(banner.hintKey)}</span>
          </div>
        </div>
      )}

      {mode === 'warehouse' && (
        <p className="text-[13px] text-sky-300 px-1">{t('detail.transfer.warehouseHint')}</p>
      )}

      {mode === 'employee' && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
              {t('detail.transfer.employeeLabel')}
            </label>
            <Select
              value={employeeId}
              onChange={setEmployeeId}
              placeholder={t('detail.transfer.employeePlaceholder')}
              options={refData.employees.map(e => ({
                value: e.id,
                label: [e.firstName, e.lastName].filter(Boolean).join(' '),
              }))}
            />
          </div>
          {caps?.isLaptop && (
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
                {t('detail.transfer.workModeLabel')}
              </label>
              <div className="flex items-center gap-1 h-8 max-md:h-11 bg-[#111315] border border-[#2A2F36] rounded-lg overflow-hidden">
                {(['office', 'remote'] as const).map((wm, i) => (
                  <button
                    key={wm}
                    type="button"
                    onClick={() => setWorkMode(wm)}
                    className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-[#2A2F36]' : ''}
                      ${workMode === wm
                        ? 'bg-[#F97316] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#22272E]'
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
        <div className="mt-3">
          <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
            {t('detail.transfer.branchLabel')}
          </label>
          <Select
            value={branchId}
            onChange={setBranchId}
            placeholder={t('detail.transfer.branchPlaceholder')}
            options={refData.branches.map(b => ({ value: b.id, label: b.name }))}
          />
        </div>
      )}

      {mode === 'department' && (
        <div className="mt-3">
          <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
            {t('detail.transfer.departmentLabel')}
          </label>
          <Select
            value={departmentId}
            onChange={setDepartmentId}
            placeholder={t('detail.transfer.departmentPlaceholder')}
            options={refData.departments.map(d => ({ value: d.id, label: d.name }))}
          />
        </div>
      )}

      {mode === 'temporary' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
                {t('detail.transfer.kindLabel')}
              </label>
              <Select
                value={tempKind}
                onChange={setTempKind}
                placeholder={t('detail.transfer.kindPlaceholder')}
                options={[
                  { value: 'audit', label: t('detail.transfer.kindAudit') },
                  { value: 'intern', label: t('detail.transfer.kindIntern') },
                ]}
              />
            </div>
            <div>
              <label htmlFor="transfer-return-date" className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
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
          {caps?.isLaptop && (
            <div>
              <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
                {t('detail.transfer.workModeLabel')}
              </label>
              <div className="flex items-center gap-1 h-8 max-md:h-11 bg-[#111315] border border-[#2A2F36] rounded-lg overflow-hidden">
                {(['office', 'remote'] as const).map((wm, i) => (
                  <button
                    key={wm}
                    type="button"
                    onClick={() => setWorkMode(wm)}
                    className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-[#2A2F36]' : ''}
                      ${workMode === wm
                        ? 'bg-[#F97316] text-white'
                        : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#22272E]'
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
}

export function TransferPanel({ asset: _asset, refData, caps, busy, onCommit, onCancel }: TransferPanelProps) {
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

  return (
    <div className="mt-3 border-t border-[#2A2F36] pt-3 anim-fade-slide-in">
      {/* Divider header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-[#22272E]" />
        <span className="text-[12px] text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">
          {t('detail.transfer.title')}
        </span>
        <div className="flex-1 h-px bg-[#22272E]" />
      </div>

      {/* Mode tiles row */}
      <div className="grid grid-cols-5 gap-2 max-md:grid-cols-3">
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

      {/* Per-mode form — key forces remount on mode change for animation */}
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

      {/* Footer: Cancel + Commit */}
      <div className="mt-4 flex gap-2 pt-1">
        <Btn
          variant="ghost"
          className="flex-1 py-2.5 border border-[#2A2F36] rounded-xl"
          onClick={onCancel}
          disabled={busy}
        >
          {t('detail.transfer.cancel')}
        </Btn>
        <button
          type="button"
          onClick={handleCommit}
          disabled={!isValid || busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[14px] bg-[#F97316] text-white hover:bg-[#EA580C] disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-sm"
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
