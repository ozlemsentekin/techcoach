import {
  Home,
  CalendarRange,
  ListChecks,
  TrendingUp,
  NotebookPen,
  AlertCircle,
  Sparkles,
  Settings,
  MessageCircle,
  MoreHorizontal,
  LogOut,
  X,
  ShieldCheck,
  Users,
} from 'lucide-react'

const ICONS = {
  Home,
  CalendarRange,
  ListChecks,
  TrendingUp,
  NotebookPen,
  AlertCircle,
  Sparkles,
  Settings,
  MessageCircle,
  MoreHorizontal,
  LogOut,
  X,
  ShieldCheck,
  Users,
}

export default function NavIcon({ name, size = 20, className }) {
  const Icon = ICONS[name] || Sparkles
  return <Icon size={size} className={className} aria-hidden="true" />
}
