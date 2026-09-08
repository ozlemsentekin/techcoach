// Tüm panel kenar çubukları için ortak dış kabuk: sabit genişlik, logo başlığı.
export default function SidebarShell({ children }) {
  return (
    <aside className="hidden shrink-0 flex-col bg-panel-surface px-2 py-5 shadow-panel-1 md:flex md:w-28 lg:w-64 lg:px-3">
      <div className="mb-6 flex h-12 flex-col items-center justify-center gap-1 border-b border-panel-border px-1 pb-5 lg:h-9 lg:flex-row lg:justify-start lg:gap-2 lg:px-2">
        <img src="/icon-192.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
        <span className="block max-w-full truncate text-[11px] font-bold tracking-wide text-panel-text lg:text-xl">
          TechCoach
        </span>
      </div>
      {children}
    </aside>
  )
}
