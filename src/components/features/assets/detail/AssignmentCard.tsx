import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch } from '@/domain/asset/transferRules'
import { SectionCard, Icon, Btn } from '@/components/ui'
import { avatarColor, initials } from './detailFormat'
import { TransferPanel } from './TransferPanel'

interface AssignmentCardProps {
  asset: Asset
  refData: AssetReferenceData
  caps: CategoryCapabilities | null
  canAssign: boolean
  busy: boolean
  transferOpen: boolean
  onOpenTransfer: () => void
  onCloseTransfer: () => void
  onCommit: (patch: TransferPatch) => void
}

export function AssignmentCard({
  asset,
  refData,
  caps,
  canAssign,
  busy,
  transferOpen,
  onOpenTransfer,
  onCloseTransfer,
  onCommit,
}: AssignmentCardProps) {
  const { t } = useTranslation('assets')
  const ass = asset.assignment

  // ---------------------------------------------------------------------------
  // Current assignment display
  // ---------------------------------------------------------------------------

  function renderAssignment() {
    if (!ass || ass.mode === 'warehouse') {
      return (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
          <div className="w-9 h-9 rounded-full bg-border text-text-tertiary flex items-center justify-center shrink-0">
            <Icon name="warehouse" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] text-text-primary">{t('detail.assignment.warehouse')}</p>
            <p className="text-[12px] text-text-tertiary">{t('assignee.warehouse')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'employee') {
      const emp = refData.employees.find(e => e.id === ass.employeeId)
      const dept = emp?.departmentId
        ? refData.departments.find(d => d.id === emp.departmentId)
        : undefined
      const empName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '—'
      const subline = [emp?.position, dept?.name].filter(Boolean).join(' · ')
      const ac = avatarColor(ass.employeeId)
      return (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-[13px] font-bold"
            style={{ backgroundColor: ac }}
          >
            {initials(empName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-text-primary truncate">{empName}</p>
            {subline && <p className="text-[12px] text-text-tertiary truncate">{subline}</p>}
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title={t('detail.assignment.active')} />
        </div>
      )
    }

    if (ass.mode === 'department') {
      const dept = refData.departments.find(d => d.id === ass.departmentId)
      return (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
            <Icon name="layout-list" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-text-primary truncate">{dept?.name ?? '—'}</p>
            <p className="text-[12px] text-text-tertiary">{t('detail.location.dept')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'branch') {
      const br = refData.branches.find(b => b.id === ass.branchId)
      return (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-2 ring-1 ring-border">
          <div className="w-9 h-9 rounded-full bg-teal-500/15 text-teal-300 flex items-center justify-center shrink-0">
            <Icon name="git-branch" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-text-primary truncate">{br?.name ?? '—'}</p>
            <p className="text-[12px] text-text-tertiary">{t('detail.location.branch')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'temporary') {
      const kindLabel = ass.tempKind === 'audit'
        ? t('detail.transfer.kindAudit')
        : t('detail.transfer.kindIntern')
      return (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/30">
          <div className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center shrink-0">
            <Icon name="timer" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-text-primary truncate">
              {t('assignee.temp')} — {kindLabel}
            </p>
            {ass.expiresAt && (
              <p className="text-[12px] text-rose-300 font-medium inline-flex items-center gap-1">
                <Icon name="clock" size={10} />
                {ass.expiresAt}
              </p>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <SectionCard
      title={t('detail.assignment.title')}
      icon="user-check"
      iconTone="blue"
      bodyClassName="!p-4 max-md:!p-3.5"
      className="h-full"
      action={
        !transferOpen && canAssign ? (
          <Btn
            variant="primary"
            size="sm"
            onClick={onOpenTransfer}
            disabled={busy}
          >
            {t('detail.assignment.transfer')}
            <Icon name="chevron-right" size={12} />
          </Btn>
        ) : undefined
      }
    >
      {/* Current assignee — always visible (stays put when opening transfer) */}
      {renderAssignment()}

      {transferOpen && (
        <TransferPanel
          asset={asset}
          refData={refData}
          caps={caps}
          busy={busy}
          onCommit={onCommit}
          onCancel={onCloseTransfer}
        />
      )}
    </SectionCard>
  )
}
