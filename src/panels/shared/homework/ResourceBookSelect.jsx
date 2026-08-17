import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import Badge from '../../ui/Badge'

function ResourceBookAvatar({ book }) {
  if (book?.imageUrl) {
    return (
      <img
        src={book.imageUrl}
        alt={`${book.name} görseli`}
        className="h-8 w-8 shrink-0 rounded-lg border border-panel-border object-cover"
      />
    )
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-student-theme-soft text-student-theme-text">
      <BookOpen size={15} aria-hidden="true" />
    </span>
  )
}

export default function ResourceBookSelect({ resourceBooks, value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

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
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-panel-border p-3 text-left text-sm text-panel-text disabled:opacity-60"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <ResourceBookAvatar book={selected} />
            {selected.publisherName ? (
              <Badge tone="lilac" className="shrink-0">
                {selected.publisherName}
              </Badge>
            ) : null}
            <span className="min-w-0 truncate">{selected.name}</span>
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
            className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-panel-text-muted hover:bg-student-theme-soft hover:text-student-theme-text"
          >
            {placeholder}
          </button>
          {resourceBooks?.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => selectOption(book.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-student-theme-soft"
            >
              <ResourceBookAvatar book={book} />
              {book.publisherName ? (
                <Badge tone="lilac" className="shrink-0">
                  {book.publisherName}
                </Badge>
              ) : null}
              <span className="truncate text-panel-text">{book.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
