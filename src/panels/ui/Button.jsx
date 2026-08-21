import { cn } from './utils'

const variants = {
  primary:
    'bg-gradient-to-br from-[#f07b31] to-[#cc682a] text-white shadow-[0_12px_30px_rgba(240,123,49,0.28)] hover:brightness-105 active:brightness-95',
  secondary: 'border border-panel-border bg-panel-surface text-panel-text hover:bg-panel-surface-soft',
  ghost: 'text-panel-text-muted hover:bg-panel-surface-soft hover:text-panel-text',
}

const sizes = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  icon: 'h-9 w-9 p-0',
}

export default function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-w-0 max-w-full shrink-0 items-center justify-center gap-2 rounded-xl text-center font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
