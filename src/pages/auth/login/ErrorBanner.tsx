import { Icon } from '@/components/ui/icon'

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
      style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.28)' }}
    >
      <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] mt-0.5 flex-shrink-0" />
      <p className="text-[12.5px] text-[#FDA4AF]">{message}</p>
    </div>
  )
}
