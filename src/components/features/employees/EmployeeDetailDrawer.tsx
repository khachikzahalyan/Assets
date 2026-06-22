import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Drawer } from '@/components/ui/Drawer'
import { Btn } from '@/components/ui/btn'
import { Icon } from '@/components/ui/icon'
import { Chip } from '@/components/ui/chip'
import { EmployeeAvatar } from './EmployeeAvatar'
import { formatLocalPhone, formatDateRu } from './employeeFormat'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrawerLinkedAsset {
  id: string
  icon: string
  title: string
  invCode: string
  cat: string
  /** ISO date string of when the asset was transferred to this employee */
  transferredAt: string
}

export interface EmployeeDetailDrawerProps {
  open: boolean
  emp: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    position: string | null
    departmentId: string | null
    branchId: string | null
    status: 'active' | 'terminated'
    createdAt: string
  } | null
  /** Branch display name resolved by the parent page */
  branchName: string
  /** Department display name resolved by the parent page */
  departmentName: string
  linkedAssets: DrawerLinkedAsset[]
  onClose: () => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onLinkAssets: (id: string) => void
}

// ── Local helpers ─────────────────────────────────────────────────────────────

/** Canonical icon tint map — unique hue per meaningful icon name. */
const ICON_TINT: Record<string, string> = {
  cpu: 'text-[#F97316]',
  'memory-stick': 'text-emerald-300',
  'hard-drive': 'text-sky-300',
  fan: 'text-cyan-300',
  plug: 'text-amber-300',
  'battery-medium': 'text-rose-300',
  microchip: 'text-violet-300',
  users: 'text-blue-400',
  'map-pin': 'text-emerald-400',
  wrench: 'text-amber-400',
  'key-round': 'text-violet-400',
  'scan-line': 'text-cyan-400',
  history: 'text-sky-400',
  'file-text': 'text-teal-400',
  package: 'text-fuchsia-400',
  boxes: 'text-indigo-400',
  'building-2': 'text-lime-400',
  building: 'text-lime-400',
  mail: 'text-rose-400',
  phone: 'text-teal-400',
  'user-circle': 'text-blue-400',
}

function iconTint(name: string): string {
  return ICON_TINT[name] ?? 'text-[#64748B]'
}

// ── EmployeePropRow ───────────────────────────────────────────────────────────

interface EmployeePropRowProps {
  icon: string
  label: string
  value: React.ReactNode
  mono?: boolean
  copyValue?: string
}

function EmployeePropRow({ icon, label, value, mono = false, copyValue }: EmployeePropRowProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    if (!copyValue) return
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (_) {
      // clipboard not available in test env — silently ignore
    }
  }

  const inner = (
    <>
      <Icon name={icon} size={13} className={`${iconTint(icon)} shrink-0 mt-px`} />
      <dt className="text-[12.5px] font-semibold uppercase tracking-[0.07em] text-[#64748B] w-[72px] shrink-0 leading-none">
        {label}
      </dt>
      <dd
        className={`flex-1 min-w-0 text-[14.5px] text-[#F8FAFC] font-medium truncate text-left leading-none${mono ? ' font-mono tabular-nums' : ''}`}
      >
        {value}
      </dd>
      {copyValue !== undefined && (
        <span
          className={`shrink-0 transition-opacity duration-100 ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {copied ? (
            <Icon name="check" size={12} className="text-emerald-500" />
          ) : (
            <Icon name="copy" size={12} className="text-[#64748B]" />
          )}
        </span>
      )}
    </>
  )

  if (copyValue !== undefined) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="group w-full flex items-center gap-x-3 px-4 py-[9px] text-left hover:bg-[#111315] transition-colors duration-100 rounded-md"
      >
        {inner}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-x-3 px-4 py-[9px]">
      {inner}
    </div>
  )
}

// ── EmployeeDetailDrawer ──────────────────────────────────────────────────────

/**
 * Right-side drawer showing employee profile + linked assets, with a
 * status-dependent footer action. Mirrors prototype lines 2628-2814.
 *
 * The drawer CONTENT is rendered as children of the <Drawer> primitive — no
 * re-implementation of portal/backdrop.
 */
export function EmployeeDetailDrawer({
  open,
  emp,
  branchName,
  departmentName,
  linkedAssets,
  onClose,
  onArchive,
  onRestore,
  onLinkAssets,
}: EmployeeDetailDrawerProps) {
  const { t } = useTranslation('employees')
  const { t: tCommon } = useTranslation('common')

  if (!open || !emp) return null

  const isActive = emp.status === 'active'

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={`${emp.firstName} ${emp.lastName}`}>
      {/* ──────────────────────────────────────────────
          HEADER — pinned. Avatar, name, status, joined-at, close.
          ────────────────────────────────────────────── */}
      <header className="px-5 pt-5 pb-4 flex items-start gap-4 border-b border-[#2A2F36] shrink-0">
        {/* Avatar with status dot */}
        <div className="relative shrink-0">
          <EmployeeAvatar
            firstName={emp.firstName}
            lastName={emp.lastName}
            id={emp.id}
            size="lg"
          />
          {/* Status dot — bottom-right corner */}
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-[#2A2F36] ${
              isActive ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
            title={t(`status.${emp.status}`)}
          />
        </div>

        {/* Name + status chip + joined date */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h2 className="text-[17px] font-bold text-[#F8FAFC] tracking-[-0.01em] truncate leading-tight">
            {emp.firstName} {emp.lastName}
          </h2>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Chip color={isActive ? 'green' : 'violet'} dot>
              {t(`status.${emp.status}`)}
            </Chip>
            <span className="text-[#64748B] text-[13px] select-none">·</span>
            <span
              className="inline-flex items-center gap-[5px] text-[13px] text-[#64748B] tabular-nums"
              title={t('table.employee')}
            >
              <Icon name="calendar-plus" size={11} className="text-[#64748B] shrink-0" />
              {formatDateRu(new Date(emp.createdAt))}
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('actions.close')}
          title={tCommon('actions.close')}
          className="w-7 h-7 rounded-md text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#22272E] flex items-center justify-center transition-colors shrink-0 mt-0.5"
        >
          <Icon name="x" size={15} />
        </button>
      </header>

      {/* ──────────────────────────────────────────────
          QUICK FACTS — pinned. Branch / Dept+Position / Gmail / Phone.
          ────────────────────────────────────────────── */}
      <div className="py-1.5 border-b border-[#2A2F36] shrink-0">
        <dl>
          <EmployeePropRow
            icon="building-2"
            label={t('table.branch')}
            value={branchName || '—'}
          />
          <EmployeePropRow
            icon="users"
            label={t('filter.department')}
            value={
              <>
                <span>{departmentName || '—'}</span>
                {emp.position && (
                  <>
                    <span className="text-[#64748B] mx-1.5 font-normal select-none">·</span>
                    <span className="text-[#94A3B8] font-normal">{emp.position}</span>
                  </>
                )}
              </>
            }
          />
          <EmployeePropRow
            icon="mail"
            label={t('table.gmail')}
            value={emp.email || '—'}
            {...(emp.email ? { copyValue: emp.email } : {})}
          />
          <EmployeePropRow
            icon="phone"
            label={t('table.phone')}
            mono
            value={emp.phone ? formatLocalPhone(emp.phone) : '—'}
            {...(emp.phone ? { copyValue: formatLocalPhone(emp.phone) } : {})}
          />
        </dl>
      </div>

      {/* ──────────────────────────────────────────────
          SECTION BAR — pinned. Assets title + count + link CTA.
          ────────────────────────────────────────────── */}
      <div className="px-5 h-11 flex items-center justify-between border-b border-[#2A2F36] shrink-0">
        <h3 className="flex items-center text-[13px] font-semibold text-[#94A3B8] tracking-[0.06em] uppercase">
          {t('detail.assets')}
          <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#22272E] text-[#94A3B8] text-[12.5px] font-semibold tabular-nums">
            {linkedAssets.length}
          </span>
        </h3>
        {isActive && (
          <button
            type="button"
            onClick={() => onLinkAssets(emp.id)}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[14px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15 transition-colors"
          >
            <Icon name="link-2" size={12} />
            {t('detail.linkAsset')}
          </button>
        )}
      </div>

      {/* ──────────────────────────────────────────────
          SCROLLABLE REGION — asset list.
          flex-1 min-h-0 is required so overflow engages.
          ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
        {linkedAssets.length === 0 ? (
          <div className="text-[14.5px] text-[#64748B] italic px-3 py-6 rounded-lg border border-dashed border-[#2A2F36] text-center">
            {t('detail.noAssets')}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {linkedAssets.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#2A2F36]/60 bg-[#1B1F24] hover:border-[#3A4048]/80 hover:bg-[#111315]/60 transition-colors duration-150"
              >
                <span className="w-8 h-8 rounded-lg bg-[#22272E] flex items-center justify-center text-[#94A3B8] shrink-0">
                  <Icon name={a.icon} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14.5px] font-semibold text-[#F8FAFC] truncate">
                      {a.title}
                    </span>
                    <span className="inline-flex items-center px-1.5 h-5 rounded bg-[#22272E] text-[#94A3B8] font-mono text-[12.5px] tabular-nums shrink-0">
                      {a.invCode}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#94A3B8] mt-0.5 flex items-center gap-1">
                    <span>{a.cat}</span>
                    <span className="text-[#64748B]">·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Icon name="arrow-right-left" size={10} className="text-[#64748B]" />
                      <span className="tabular-nums">
                        {formatDateRu(new Date(a.transferredAt))}
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ──────────────────────────────────────────────
          FOOTER — pinned. Status-dependent primary action.
          ────────────────────────────────────────────── */}
      {isActive && (
        <footer className="px-5 py-3 bg-[#111315]/60 border-t border-[#2A2F36] flex items-center justify-end gap-2 shrink-0">
          <Btn variant="danger" onClick={() => onArchive(emp.id)}>
            <Icon name="package" size={14} />
            {t('detail.handover')}
          </Btn>
        </footer>
      )}
      {!isActive && (
        <footer className="px-5 py-3 bg-[#111315]/60 border-t border-[#2A2F36] flex items-center justify-end gap-2 shrink-0">
          <Btn variant="secondary" onClick={() => onRestore(emp.id)}>
            <Icon name="rotate-ccw" size={14} />
            {t('detail.restore')}
          </Btn>
        </footer>
      )}
    </Drawer>
  )
}
