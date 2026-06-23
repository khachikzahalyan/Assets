import { Btn, DIALOG_BACKDROP } from '@/components/ui'

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
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div className="w-[400px] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[85vh] max-md:overflow-y-auto rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-text-primary mb-2">{p.title}</h3>
        <p className="text-[13px] text-text-tertiary mb-4">{p.blockedMessage ?? p.body}</p>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{p.cancelLabel}</Btn>
          {!p.blockedMessage && (
            <Btn variant="danger" size="sm" disabled={!!p.busy} onClick={p.onConfirm}>{p.confirmLabel}</Btn>
          )}
        </div>
      </div>
    </div>
  )
}
