function TeeShape(props) {
  // Tek bir "T": sırtı (kolun dış kenarı) y=0 hizasında, gövdesi (dikey çubuk)
  // sırtın tersine, dışa doğru uzanır. Kalın çizgiler, geniş sırt.
  return (
    <g {...props}>
      <rect x="-44" y="0" width="88" height="30" rx="8" />
      <rect x="-15" y="30" width="30" height="58" rx="8" />
    </g>
  )
}

function LogoLoader({ size = 60 }) {
  // TechCoach logosundaki iki "T"; 45° eksende sırt sırta duruyor. Gövdeler dışa bakar,
  // sırtlar merkeze. Sırtlar birbirine değecek kadar yaklaşıp uzaklaşıyor — iç içe geçmiyor.
  return (
    <svg
      viewBox="-132 -132 264 264"
      width={size}
      height={size}
      className="text-panel-blue"
      aria-hidden="true"
    >
      <g transform="rotate(45)">
        <TeeShape className="tt-shoulder" fill="currentColor" />
      </g>
      <g transform="rotate(45) scale(1 -1)">
        <TeeShape className="tt-shoulder" fill="currentColor" opacity="0.8" />
      </g>
    </svg>
  )
}

export default function LoadingState({ label = 'Yükleniyor...', fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? 'flex min-h-screen flex-col items-center justify-center gap-6 bg-panel-bg px-6'
          : 'flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6'
      }
    >
      <LogoLoader size={fullScreen ? 112 : 100} />

      <p className="text-sm font-medium text-panel-text-muted">{label}</p>

      {fullScreen ? (
        <div className="mt-2 w-full max-w-md space-y-3" aria-hidden="true">
          <div className="loading-skeleton h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <div className="loading-skeleton h-20 rounded-2xl" />
            <div className="loading-skeleton h-20 rounded-2xl" />
          </div>
          <div className="loading-skeleton h-4 w-2/3 rounded-full" />
        </div>
      ) : null}
    </div>
  )
}
