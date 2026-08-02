export default function PublisherBadge({ name }) {
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-student-theme-primary/20 bg-student-theme-soft px-2.5 py-1 text-[11px] font-medium text-student-theme-text">
      {name}
    </span>
  )
}
