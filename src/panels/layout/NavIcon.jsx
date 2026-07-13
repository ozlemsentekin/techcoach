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
  ClipboardList,
  FileCheck2,
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
  ClipboardList,
  FileCheck2,
}

export default function NavIcon({ name, size = 20, className }) {
  const Icon = ICONS[name] || Sparkles
  return <Icon size={size} className={className} aria-hidden="true" />
}
