import { Icon } from '@/components/ui/icon'

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 light:bg-rose-50 light:border-rose-200"
    >
      <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] light:text-rose-700 mt-0.5 flex-shrink-0" />
      <p className="text-[12.5px] text-[#FDA4AF] light:text-rose-700">{message}</p>
    </div>
  )
}
