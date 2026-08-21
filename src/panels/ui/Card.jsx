import { cn } from './utils'

export function Card({ className, ...props }) {
  return <div className={cn('panel-card min-w-0', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('border-b border-panel-border px-4 py-3', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h2 className={cn('text-sm font-semibold uppercase tracking-wide text-panel-text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-4', className)} {...props} />
}
