import {
  LayoutDashboard,
  Package,
  ArrowRightLeft,
  Wrench,
  KeyRound,
  Users,
  Building,
  Network,
  Tags,
  CircleDot,
  ShieldCheck,
  History,
  Settings,
  FileText,
  UserCircle,
  Search,
  Globe,
  ChevronDown,
  ChevronRight,
  Check,
  LogOut,
  Menu,
  X,
  Inbox,
  TriangleAlert,
  RefreshCw,
  Laptop,
  Monitor,
  User,
  HelpCircle,
  Loader2,
  Clock,
  MailCheck,
  Pencil,
  Trash2,
  Plus,
  Lock,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const REGISTRY: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  package: Package,
  'arrow-right-left': ArrowRightLeft,
  wrench: Wrench,
  'key-round': KeyRound,
  users: Users,
  building: Building,
  network: Network,
  tags: Tags,
  'circle-dot': CircleDot,
  'shield-check': ShieldCheck,
  history: History,
  settings: Settings,
  'file-text': FileText,
  'user-circle': UserCircle,
  search: Search,
  globe: Globe,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  check: Check,
  'log-out': LogOut,
  menu: Menu,
  x: X,
  inbox: Inbox,
  'triangle-alert': TriangleAlert,
  'refresh-cw': RefreshCw,
  laptop: Laptop,
  monitor: Monitor,
  user: User,
  'loader-circle': Loader2,
  clock: Clock,
  'mail-check': MailCheck,
  pencil: Pencil,
  'trash-2': Trash2,
  plus: Plus,
  lock: Lock,
}

export interface IconProps {
  name: string
  size?: number
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  const Cmp = REGISTRY[name] ?? HelpCircle
  if (!REGISTRY[name] && import.meta.env.DEV) {
    console.warn(`[Icon] unknown name "${name}" — rendering fallback`)
  }
  return (
    <Cmp
      size={size}
      strokeWidth={1.75}
      aria-hidden
      className={cn('inline-block shrink-0 align-[-2px]', className)}
    />
  )
}
