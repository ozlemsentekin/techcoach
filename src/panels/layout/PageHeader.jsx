export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-2xl font-bold leading-tight text-panel-text sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 break-words text-base text-panel-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
    </div>
  )
}
