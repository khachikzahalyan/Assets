import { useTranslation } from 'react-i18next'
import { EmployeeModalShell } from './EmployeeModalShell'
import { Btn } from '@/components/ui/btn'
import { Icon } from '@/components/ui/icon'

export interface RestoreConfirmModalProps {
  open: boolean
  emp: { id: string; firstName: string; lastName: string } | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirm restoring an archived employee back to active status.
 * Mirrors Warehouse/prototypes/employees.html lines 2537-2567.
 */
export function RestoreConfirmModal({
  open,
  emp,
  onConfirm,
  onClose,
}: RestoreConfirmModalProps) {
  const { t } = useTranslation('employees')

  if (!open || !emp) return null

  return (
    <EmployeeModalShell open={open} onClose={onClose} width="max-w-md">
      {/* Body */}
      <div className="px-5 pt-5 pb-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-300 flex items-center justify-center shrink-0">
          <Icon name="rotate-ccw" size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[17px] font-bold text-[#F8FAFC] tracking-tight">
            {t('restore.title')}
          </div>
          <div className="text-[14.5px] text-[#F8FAFC] mt-1 leading-relaxed">
            {t('restore.bodyPre') && (
              <>{t('restore.bodyPre')} </>
            )}
            <span className="font-semibold text-[#F8FAFC]">
              {emp.firstName} {emp.lastName}
            </span>{' '}
            {t('restore.bodyPost')}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-1 flex items-center justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onClose}>
          {t('form.cancel')}
        </Btn>
        <Btn
          variant="primary"
          size="sm"
          onClick={onConfirm}
          className="bg-gradient-to-b from-violet-500 to-violet-600 shadow-violet-500/20 hover:shadow-violet-500/30 ring-violet-700/10"
        >
          <Icon name="rotate-ccw" size={14} />
          {t('restore.confirm')}
        </Btn>
      </div>
    </EmployeeModalShell>
  )
}
