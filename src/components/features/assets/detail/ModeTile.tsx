import { Icon } from '@/components/ui'

interface ModeTileProps {
  icon: string
  label: string
  selected: boolean
  onClick: () => void
}

export function ModeTile({ icon, label, selected, onClick }: ModeTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 py-2 rounded-xl transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div
        className={`mode-tile-icon relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150
          ${selected
            ? 'bg-accent shadow-[0_4px_14px_rgba(249,115,22,0.35)] ring-2 ring-accent/40 ring-offset-2 ring-offset-surface'
            : 'bg-surface-2 border border-border group-hover:border-accent/40'
          }`}
      >
        <Icon
          name={icon}
          size={17}
          className={`transition-colors duration-150 ${
            selected
              ? 'text-white'
              : 'text-text-tertiary group-hover:text-accent-light'
          }`}
        />
      </div>
      <span
        className={`mode-tile-label text-[12.5px] leading-tight text-center transition-colors duration-150
          ${selected
            ? 'text-text-primary font-semibold'
            : 'text-text-tertiary group-hover:text-text-primary'
          }`}
      >
        {label}
      </span>
    </button>
  )
}
