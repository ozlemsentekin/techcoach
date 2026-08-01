import { cn } from './utils'

export default function DataTable({ children, className }) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-[#e4e8e9] bg-white shadow-[0_4px_16px_rgba(37,61,62,0.06)]',
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
