import {
  Sunrise,
  BookOpen,
  ListChecks,
  RotateCcw,
  NotebookPen,
  CheckSquare,
  PenLine,
  FileCheck2,
  RefreshCcw,
  CalendarClock,
  Coffee,
  Utensils,
  Sun,
  Users,
  Dumbbell,
  Music,
  Moon,
  Star,
  Sparkles,
} from 'lucide-react'

const ICONS = {
  Sunrise,
  BookOpen,
  ListChecks,
  RotateCcw,
  NotebookPen,
  CheckSquare,
  PenLine,
  FileCheck2,
  RefreshCcw,
  CalendarClock,
  Coffee,
  Utensils,
  Sun,
  Users,
  Dumbbell,
  Music,
  Moon,
  Star,
}

export default function TaskTypeIcon({ name, size = 18, className }) {
  const Icon = ICONS[name] || Sparkles
  return <Icon size={size} className={className} aria-hidden="true" />
}
