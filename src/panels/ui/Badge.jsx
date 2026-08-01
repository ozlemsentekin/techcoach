import { cn } from './utils'

const tones = {
  blue: 'border-panel-blue/25 bg-panel-blue-soft text-panel-blue',
  lilac: 'border-panel-lilac/25 bg-panel-lilac-soft text-panel-lilac',
  sage: 'border-panel-sage/25 bg-panel-sage-soft text-panel-sage',
  slate: 'border-panel-slate/25 bg-panel-slate-soft text-panel-slate',
  accent: 'border-panel-accent/25 bg-panel-accent-soft text-panel-accent',
  warm: 'border-panel-warm/25 bg-panel-accent-soft text-panel-warm',
  neutral: 'border-panel-border bg-panel-bg text-panel-text-muted',
}

export default function Badge({ className, tone = 'neutral', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
