import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import Badge from '../../ui/Badge'
import { cn } from '../../ui/utils'

function ResourceBookAvatar({ book, variant }) {
  if (book?.imageUrl) {
    return (
      <img loading="lazy" decoding="async"
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="h-9 w-9 shrink-0 rounded-lg border border-panel-border object-cover"
      />
    )
  }

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        variant === 'student' ? 'bg-student-theme-soft text-student-theme-text' : 'bg-panel-warm-soft text-panel-warm',
      )}
    >
      <BookOpen size={15} aria-hidden="true" />
    </span>
  )
}

export default function ResourceBookSelect({ resourceBooks, value, onChange, disabled, placeholder, variant = 'student' }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const hoverClass = variant === 'student' ? 'hover:bg-student-theme-soft' : 'hover:bg-panel-warm-soft/70'
  const hoverTextClass = variant === 'student' ? 'hover:text-student-theme-text' : 'hover:text-panel-warm'

  useEffect(() => {
    if (!open) return undefined

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected = resourceBooks?.find((book) => book.id === value) || null

  const selectOption = (bookId) => {
    onChange(bookId)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-14 w-full items-center justify-between gap-2 rounded-xl border border-panel-border bg-panel-surface p-3 text-left text-sm text-panel-text disabled:opacity-60"
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <ResourceBookAvatar book={selected} variant={variant} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {selected.publisherName ? (
                <Badge tone="lilac" className="w-fit max-w-full truncate">
                  {selected.publisherName}
                </Badge>
              ) : null}
              <span className="block min-w-0 truncate font-medium">{selected.name}</span>
            </span>
          </span>
        ) : (
          <span className="truncate text-panel-text-muted">{placeholder}</span>
        )}
        <ChevronDown size={16} className="shrink-0 text-panel-text-muted" />
      </button>

      {open && !disabled ? (
        <div className="panel-card relative z-10 mt-1 max-h-64 w-full overflow-y-auto bg-panel-surface p-1">
          <button
            type="button"
            onClick={() => selectOption('')}
            className={cn('flex w-full items-center rounded-lg px-2 py-2 text-left text-sm text-panel-text-muted', hoverClass, hoverTextClass)}
          >
            {placeholder}
          </button>
          {resourceBooks?.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => selectOption(book.id)}
              className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm', hoverClass)}
            >
              <ResourceBookAvatar book={book} variant={variant} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {book.publisherName ? (
                  <Badge tone="lilac" className="w-fit max-w-full truncate">
                    {book.publisherName}
                  </Badge>
                ) : null}
                <span className="line-clamp-2 text-panel-text">{book.name}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
