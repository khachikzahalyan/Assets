import type { Role } from '@/config/roles'

interface RoleIconProps { role: Role | null | undefined; size?: number; className?: string }

/** Custom per-role badge icons (user-provided). Circular dark badge + orange line art. */
export function RoleIcon({ role, size = 20, className }: RoleIconProps) {
  const common = { width: size, height: size, viewBox: '0 0 120 120', xmlns: 'http://www.w3.org/2000/svg', className, 'aria-hidden': true as const }
  switch (role) {
    case 'super_admin':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="60" fill="#1A1D23"/>
          <polyline points="30,75 30,50 45,65 60,42 75,65 90,50 90,75" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="30" y1="75" x2="90" y2="75" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round"/>
        </svg>
      )
    case 'asset_admin':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="60" fill="#1A1D23"/>
          <path d="M60,30 L84,40 L84,62 Q84,78 60,90 Q36,78 36,62 L36,40 Z" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="49" y="51" width="22" height="18" rx="3" fill="none" stroke="#F97316" strokeWidth="2.5"/>
          <polyline points="49,57 60,51 71,57" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="60" y1="51" x2="60" y2="57" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      )
    case 'tech_admin':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="60" fill="#1A1D23"/>
          <rect x="49" y="49" width="22" height="22" rx="3" fill="none" stroke="#F97316" strokeWidth="3"/>
          <line x1="55" y1="49" x2="55" y2="38" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="65" y1="49" x2="65" y2="38" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="55" y1="71" x2="55" y2="82" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="65" y1="71" x2="65" y2="82" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="49" y1="55" x2="38" y2="55" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="49" y1="65" x2="38" y2="65" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="71" y1="55" x2="82" y2="55" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="71" y1="65" x2="82" y2="65" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="60" cy="60" r="4" fill="#F97316"/>
        </svg>
      )
    case 'employee':
      return (
        <svg {...common}>
          <circle cx="60" cy="60" r="60" fill="#1A1D23"/>
          <circle cx="60" cy="48" r="13" fill="none" stroke="#F97316" strokeWidth="3.5"/>
          <path d="M34,88 Q34,68 60,68 Q86,68 86,88" fill="none" stroke="#F97316" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx="80" cy="76" r="10" fill="#1A1D23" stroke="#F97316" strokeWidth="2"/>
          <polyline points="75,76 78,79 85,72" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    default:
      return null
  }
}
