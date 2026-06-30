import { Icon } from '@/components/ui'

interface ModeTileProps {
  icon: string
  label: string
  selected: boolean
  onClick: () => void
}

export function ModeTile({ icon, label, selected, onClick }: ModeTileProps) {
  // Round icon style — prototype detail «КОМУ ПЕРЕДАТЬ» (compact to avoid page scroll).
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="group flex flex-col items-center gap-1 py-0.5 rounded-xl transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150
          ${selected
            ? 'bg-accent ring-2 ring-accent/40 ring-offset-2 ring-offset-surface shadow-[0_4px_14px_rgba(249,115,22,0.35)]'
            : 'bg-surface-2 border border-border group-hover:border-accent/40'}`}
      >
        <Icon
          name={icon}
          size={18}
          className={`transition-colors duration-150 ${selected ? 'text-white' : 'text-text-tertiary group-hover:text-accent-light'}`}
        />
      </div>
      <span
        className={`text-[12px] leading-tight text-center transition-colors duration-150 ${selected ? 'text-text-primary font-semibold' : 'text-text-tertiary group-hover:text-text-primary'}`}
      >
        {label}
      </span>
    </button>
  )
}
