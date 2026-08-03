import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { EmployeeArchiveError, EmployeeEmailTerminatedError } from '@/domain/employee'
import type { Employee } from '@/domain/employee'
import type { DrawerLinkedAsset, HandoverAsset, PickerStockRow } from '@/components/features/employees'
import type { EmployeeFormSubmit } from '@/components/features/employees/EmployeeFormModal'
import type { Destination } from '@/components/features/employees/DestPicker'
import { destToPatch } from './employeesHelpers'
import { sendAccessEmail } from '@/lib/notifications/sendAccessEmail'
import { ASSET_STATUS } from '@/domain/asset'
import { getSharedSubscriptionRepository } from '@/infra/repositories/factories'
import type { Actor } from '@/domain/asset'
import type { EmployeesDataBag } from './useEmployeesData'

/**
 * Best-effort seat cleanup on termination: remove the fired employee from every
 * subscription's assignedEmployeeIds so their seats free up (audited via
 * updateAssignees). Swallows all failures — notably asset_admin cannot read
 * /subscriptions (rules limit them to super|tech), so for that role the ghost
 * seat stays visible in ManageAssigneesModal where super/tech can release it.
 */
async function releaseSubscriptionSeats(employeeId: string, actor: Actor): Promise<void> {
  try {
    const subRepo = getSharedSubscriptionRepository()
    const subs = await subRepo.listSubscriptions()
    for (const s of subs) {
      if (!s.assignedEmployeeIds.includes(employeeId)) continue
      try {
        await subRepo.updateAssignees(s.id, s.assignedEmployeeIds.filter(id => id !== employeeId), actor)
      } catch { /* per-sub best-effort */ }
    }
  } catch { /* no read access or offline — ghost row remains manually releasable */ }
}

export function useEmployeesActions(d: EmployeesDataBag) {
  const { t } = useTranslation('employees')
  const { user, role } = useAuth()
  const { showToast } = useToast()

  const actor = { uid: user.id, role, displayName: user.name }

  const {
    repo, assetRepo, asnRepo, defaultLoadAssetCounts, assetCountsProp,
    employees, former, catMap,
    assetCountOf, headOfficeBranchId,
    detailId, setDetailId,
    detailLinkedAssets, setDetailLinkedAssets, setFormOpen, setFormInitial,
    handoverAssets, setHandoverTarget, setHandoverAssets,
    setPickerTarget, setPickerStock,
    setRestoreTarget,
    handoverTarget, pickerTarget, pickerStock, restoreTarget,
    setAssetCounts,
    reload,
  } = d

  function handleCreate() {
    setFormInitial(null)
    setFormOpen(true)
  }

  /** Open the employee form in edit mode (identity fields locked; position /
      phone / department editable) — the only UI path for changing department. */
  function handleEdit(emp: Employee) {
    setFormInitial(emp)
    setFormOpen(true)
  }

  async function handleSaveForm(submit: EmployeeFormSubmit) {
    try {
      if (!submit.id) {
        const id = 'pending_' + crypto.randomUUID()
        await repo.createEmployee(
          {
            id,
            firstName: submit.firstName,
            lastName: submit.lastName,
            email: submit.email,
            phone: submit.phone,
            position: submit.position,
            branchId: headOfficeBranchId,
            departmentId: submit.departmentId,
          },
          actor,
        )
        showToast(t('toast.created'))
        // Best-effort Gmail notification for the newly-added employee (never blocks).
        if (submit.email?.trim()) {
          void sendAccessEmail({
            email: submit.email.trim(),
            name: `${submit.firstName} ${submit.lastName}`.trim(),
            kind: 'employee',
          })
        }
      } else {
        await repo.updateEmployee(
          submit.id,
          {
            email: submit.email,
            position: submit.position,
            phone: submit.phone,
            departmentId: submit.departmentId,
          },
          actor,
        )
        showToast(t('toast.updated'))
      }
      setFormOpen(false)
      await reload()
    } catch (err: unknown) {
      // Fix 2г: terminated-email gate — offer restore flow
      if (err instanceof EmployeeEmailTerminatedError) {
        setFormOpen(false)
        showToast(t('validation.emailTerminated'), { variant: 'error' })
        // Resolve the terminated employee to feed into RestoreConfirmModal
        let emp = employees.find(e => e.id === err.employeeId) ?? former.find(e => e.id === err.employeeId) ?? null
        if (!emp) {
          try { emp = await repo.findByEmail(submit.email) } catch { emp = null }
        }
        if (emp) setRestoreTarget(emp)
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      if (/email already in use/i.test(msg)) {
        showToast(t('validation.emailTaken'), { variant: 'error' })
      } else {
        showToast(t('validation.saveFailed'), { variant: 'error' })
      }
    }
  }

  async function handleOpenDetail(empId: string) {
    setDetailId(empId)
    try {
      const assets = await assetRepo.listAssetsForEmployee(empId)
      const linked: DrawerLinkedAsset[] = assets.map(a => {
        const cat = catMap.get(a.categoryId)
        const catName = cat?.name ?? ''
        const icon = cat?.lucideIcon ?? 'box'
        const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
        return { id: a.id, icon, title, invCode: a.invCode, cat: catName, transferredAt: a.updatedAt }
      })
      setDetailLinkedAssets(linked)
    } catch {
      setDetailLinkedAssets([])
    }
  }

  async function handleArchive(empId: string) {
    if (empId === actor.uid) { showToast(t('guard.self-archive'), { variant: 'error' }); return }
    setDetailId(null)
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    if (assetCountOf(empId) === 0) {
      try {
        await repo.archiveEmployee(empId, actor)
        void releaseSubscriptionSeats(empId, actor)
        showToast(t('toast.archived'))
        await reload()
      } catch (err) {
        if (err instanceof EmployeeArchiveError) { showToast(t(`guard.${err.reason}`), { variant: 'error' }); return }
        showToast(t('validation.saveFailed'), { variant: 'error' })
      }
    } else {
      try {
        const assets = await assetRepo.listAssetsForEmployee(empId)
        const handAssets: HandoverAsset[] = assets.map(a => {
          const cat = catMap.get(a.categoryId)
          const catName = cat?.name ?? ''
          const icon = cat?.lucideIcon ?? 'box'
          const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
          return { id: a.id, icon, title, invCode: a.invCode, sn: a.serial ?? '' }
        })
        setHandoverAssets(handAssets)
        setHandoverTarget(emp)
      } catch {
        setHandoverAssets([])
        setHandoverTarget(emp)
      }
    }
  }

  async function handleHandoverConfirm(rows: { id: string; received: boolean; destination: Destination }[]) {
    if (!handoverTarget) return
    const handById = new Map(handoverAssets.map(a => [a.id, a]))
    try {
      for (const r of rows) {
        if (!r.received) continue
        if (r.destination.kind === 'warehouse') {
          await asnRepo.returnAsset(r.id, actor)
        } else {
          const dest = r.destination
          const patch = destToPatch(dest, employees)
          await assetRepo.changeStatus(r.id, patch.toStatusId, actor, {
            assignment: patch.assignment,
            branchId: patch.branchId,
            deptId: patch.deptId,
          })
          // Best-effort handover email when the asset is redirected to an employee.
          if (dest.kind === 'employee') {
            const recipient = employees.find(e => e.id === dest.id) ?? null
            const email = recipient?.email?.trim()
            if (email) {
              const row = handById.get(r.id)
              void sendAccessEmail({
                email,
                name: dest.label ?? (recipient ? `${recipient.firstName} ${recipient.lastName}`.trim() : ''),
                kind: 'asset',
                assetLabel: row?.title ?? '',
                assetCode: row?.invCode ?? '',
                assetId: r.id,
              })
            }
          }
        }
      }
      await repo.archiveEmployee(handoverTarget.id, actor)
      void releaseSubscriptionSeats(handoverTarget.id, actor)
      showToast(t('toast.handover'))
      setHandoverTarget(null)
      await reload()
    } catch (err) {
      if (err instanceof EmployeeArchiveError) { showToast(t(`guard.${err.reason}`), { variant: 'error' }); return }
      showToast(t('validation.saveFailed'), { variant: 'error' })
    }
  }

  async function handleTransferAssets(assetIds: string[], dest: Destination) {
    const patch = destToPatch(dest, employees)
    // Best-effort handover email: only when transferring TO an employee, one per
    // successfully-transferred asset. Resolve recipient + asset label/code once.
    const recipient = dest.kind === 'employee' ? employees.find(e => e.id === dest.id) ?? null : null
    const recipientEmail = recipient?.email?.trim()
    const recipientName = dest.kind === 'employee'
      ? (dest.label ?? (recipient ? `${recipient.firstName} ${recipient.lastName}`.trim() : ''))
      : ''
    const linkedById = new Map(detailLinkedAssets.map(a => [a.id, a]))
    let okCount = 0
    let failCount = 0
    for (const id of assetIds) {
      try {
        await assetRepo.changeStatus(id, patch.toStatusId, actor, {
          assignment: patch.assignment,
          branchId: patch.branchId,
          deptId: patch.deptId,
        })
        okCount++
        if (recipientEmail) {
          const row = linkedById.get(id)
          void sendAccessEmail({
            email: recipientEmail,
            name: recipientName,
            kind: 'asset',
            assetLabel: row?.title ?? '',
            assetCode: row?.invCode ?? '',
            assetId: id,
          })
        }
      } catch {
        failCount++
      }
    }
    const total = assetIds.length
    if (failCount === 0) {
      showToast(t('transfer.toastDone', { count: okCount }))
    } else if (okCount === 0) {
      showToast(t('transfer.toastFailed'), { variant: 'error' })
    } else {
      showToast(t('transfer.toastPartial', { ok: okCount, total, failed: failCount }), { variant: 'error' })
    }
    if (okCount > 0) {
      if (detailId) await handleOpenDetail(detailId)
      if (!assetCountsProp) {
        const counts = await defaultLoadAssetCounts()
        setAssetCounts(counts)
      }
    }
  }

  function handleRestore(empId: string) {
    setDetailId(null)
    const emp = employees.find(e => e.id === empId) ?? former.find(e => e.id === empId)
    if (!emp) return
    setRestoreTarget(emp)
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return
    try {
      await repo.restoreEmployee(restoreTarget.id, actor)
      showToast(t('toast.restored'))
      setRestoreTarget(null)
      await reload()
    } catch {
      showToast(t('validation.saveFailed'), { variant: 'error' })
    }
  }

  async function handleLinkAssets(empId: string) {
    setDetailId(null)
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    try {
      const assets = await assetRepo.listAssets({ statusId: ASSET_STATUS.warehouse, branchId: emp.branchId ?? 'all' })
      const stock: PickerStockRow[] = assets.map(a => {
        const cat = catMap.get(a.categoryId)
        const catName = cat?.name ?? ''
        const icon = cat?.lucideIcon ?? 'box'
        const group = cat?.group ?? 'devices'
        const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
        return { id: a.id, title, invCode: a.invCode, cat: catName, icon, group }
      })
      setPickerStock(stock)
      setPickerTarget(emp)
    } catch {
      setPickerStock([])
      setPickerTarget(emp)
    }
  }

  async function handleConfirmLink(ids: string[]) {
    if (!pickerTarget) return
    const byId = new Map(pickerStock.map(s => [s.id, s]))
    const recipientEmail = pickerTarget.email?.trim()
    const recipientName = `${pickerTarget.firstName} ${pickerTarget.lastName}`.trim()
    try {
      for (const id of ids) {
        const row = byId.get(id)
        await asnRepo.assign(
          {
            assetId: id,
            mode: 'employee',
            employeeId: pickerTarget.id,
            employeeEmail: pickerTarget.email,
            employeeName: `${pickerTarget.firstName} ${pickerTarget.lastName}`,
            invCode: row?.invCode ?? null,
            deptId: pickerTarget.departmentId,
          },
          actor,
        )
        // Best-effort handover email per linked asset — never blocks the link.
        if (recipientEmail) {
          void sendAccessEmail({
            email: recipientEmail,
            name: recipientName,
            kind: 'asset',
            assetLabel: row?.title ?? '',
            assetCode: row?.invCode ?? '',
            assetId: id,
          })
        }
      }
      showToast(t('toast.linked', { count: ids.length }))
      setPickerTarget(null)
      await reload()
    } catch {
      showToast(t('validation.saveFailed'), { variant: 'error' })
    }
  }

  return {
    handleCreate,
    handleEdit,
    handleSaveForm,
    handleOpenDetail,
    handleArchive,
    handleHandoverConfirm,
    handleTransferAssets,
    handleRestore,
    handleConfirmRestore,
    handleLinkAssets,
    handleConfirmLink,
  }
}

export type EmployeesActionsBag = ReturnType<typeof useEmployeesActions>
