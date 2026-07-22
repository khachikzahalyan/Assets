import {
  EmployeeFormModal,
  EmployeeDetailDrawer,
  HandoverModal,
  AssetPickerSheet,
  RestoreConfirmModal,
} from '@/components/features/employees'
import type { EmployeeFormSubmit } from '@/components/features/employees/EmployeeFormModal'
import type { EmployeesDataBag } from './useEmployeesData'
import type { EmployeesActionsBag } from './useEmployeesActions'

interface EmployeesModalsProps {
  data: EmployeesDataBag
  actions: EmployeesActionsBag
  currentUserId: string
}

export function EmployeesModals({ data, actions, currentUserId }: EmployeesModalsProps) {
  const {
    formOpen, setFormOpen,
    formInitial,
    detailId, setDetailId,
    detailLinkedAssets,
    handoverTarget, setHandoverTarget,
    handoverAssets,
    pickerTarget, setPickerTarget,
    pickerStock,
    restoreTarget, setRestoreTarget,
    employees, former,
    branches, departments,
    branchMap, deptMap,
  } = data

  // ── Derived emp shapes for modals ─────────────────────────────────────────
  const detailEmp = detailId
    ? (employees.find(e => e.id === detailId) ?? former.find(e => e.id === detailId) ?? null)
    : null
  const detailBranchName = detailEmp?.branchId ? (branchMap.get(detailEmp.branchId) ?? '—') : '—'
  const detailDeptName   = detailEmp?.departmentId ? (deptMap.get(detailEmp.departmentId) ?? '—') : '—'

  const handoverEmpShape = handoverTarget ? {
    id: handoverTarget.id,
    firstName: handoverTarget.firstName,
    lastName: handoverTarget.lastName,
    position: handoverTarget.position,
    departmentName: handoverTarget.departmentId ? (deptMap.get(handoverTarget.departmentId) ?? null) : null,
  } : null

  const pickerEmpShape = pickerTarget ? {
    id: pickerTarget.id,
    firstName: pickerTarget.firstName,
    lastName: pickerTarget.lastName,
    position: pickerTarget.position,
    departmentName: pickerTarget.departmentId ? (deptMap.get(pickerTarget.departmentId) ?? null) : null,
    branchName: pickerTarget.branchId ? (branchMap.get(pickerTarget.branchId) ?? null) : null,
  } : null

  const handoverEmployees = employees
    .filter(e => e.status === 'active')
    .map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, status: e.status }))

  return (
    <>
      <EmployeeFormModal
        open={formOpen}
        initial={formInitial}
        departments={departments}
        onSave={(submit: EmployeeFormSubmit) => { void actions.handleSaveForm(submit) }}
        onClose={() => setFormOpen(false)}
      />

      <EmployeeDetailDrawer
        open={!!detailId}
        emp={detailEmp}
        branchName={detailBranchName}
        departmentName={detailDeptName}
        linkedAssets={detailLinkedAssets}
        onClose={() => setDetailId(null)}
        onEdit={() => { if (detailEmp) actions.handleEdit(detailEmp) }}
        onArchive={id => { void actions.handleArchive(id) }}
        onRestore={id => { actions.handleRestore(id) }}
        onLinkAssets={id => { void actions.handleLinkAssets(id) }}
        employees={handoverEmployees}
        departments={departments}
        branches={branches}
        onTransferAssets={actions.handleTransferAssets}
        currentUserId={currentUserId}
      />

      <HandoverModal
        open={!!handoverTarget}
        emp={handoverEmpShape}
        assets={handoverAssets}
        employees={handoverEmployees}
        departments={departments}
        branches={branches}
        onConfirm={rows => { void actions.handleHandoverConfirm(rows) }}
        onClose={() => setHandoverTarget(null)}
      />

      <AssetPickerSheet
        open={!!pickerTarget}
        emp={pickerEmpShape}
        stock={pickerStock}
        onConfirm={ids => { void actions.handleConfirmLink(ids) }}
        onClose={() => setPickerTarget(null)}
      />

      <RestoreConfirmModal
        open={!!restoreTarget}
        emp={restoreTarget}
        onConfirm={() => { void actions.handleConfirmRestore() }}
        onClose={() => setRestoreTarget(null)}
      />
    </>
  )
}
