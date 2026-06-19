import { Btn } from '@/components/ui'

export interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  blockedMessage?: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteDialog(p: ConfirmDeleteDialogProps) {
  if (!p.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={p.onCancel}>
      <div className="w-[400px] rounded-lg border border-[#2A2F36] bg-[#1B1F24] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-[#F8FAFC] mb-2">{p.title}</h3>
        <p className="text-[13px] text-[#94A3B8] mb-4">{p.blockedMessage ?? p.body}</p>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{p.cancelLabel}</Btn>
          {!p.blockedMessage && (
            <Btn variant="danger" size="sm" disabled={p.busy} onClick={p.onConfirm}>{p.confirmLabel}</Btn>
          )}
        </div>
      </div>
    </div>
  )
}
