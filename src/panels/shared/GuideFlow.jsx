import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Lightbulb } from 'lucide-react'

export default function GuideFlow({ phases, steps }) {
  const [selected, setSelected] = useState(0)
  const step = steps[selected]
  const phaseIndex = phases.findIndex((phase) => phase.steps.includes(selected))
  const Icon = step.icon || phases[phaseIndex].icon || BookOpen

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <nav aria-label="Kullanım yol haritası" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {phases.map((phase, index) => {
          const active = index === phaseIndex
          return (
            <button key={phase.title} type="button" aria-current={active ? 'step' : undefined} onClick={() => setSelected(phase.steps[0])} className={`flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue sm:gap-3 sm:p-4 ${active ? 'border-panel-blue bg-panel-blue text-white shadow-sm' : 'border-panel-border bg-panel-surface text-panel-text hover:bg-panel-blue-soft'}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-white/15' : 'bg-panel-blue-soft text-panel-blue'}`}><span className="text-sm font-bold">{index + 1}</span></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-5 sm:text-[15px] sm:leading-6">{phase.title}</span>
                {phase.description ? <span className={`mt-1 hidden text-xs leading-5 sm:block ${active ? 'text-white/90' : 'text-panel-text-muted'}`}>{phase.description}</span> : null}
              </span>
            </button>
          )
        })}
      </nav>
      <nav aria-label={`${phases[phaseIndex].title} alt adımları`} className="flex flex-wrap items-center gap-x-4 gap-y-0 px-1">
        {phases[phaseIndex].steps.map((index) => <button key={steps[index].id} type="button" aria-current={selected === index ? 'step' : undefined} onClick={() => setSelected(index)} className={`min-h-11 border-b-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-blue ${selected === index ? 'border-panel-warm font-bold text-panel-warm' : 'border-transparent font-medium text-panel-text-muted hover:text-panel-text'}`}>{steps[index].shortTitle || steps[index].title}</button>)}
      </nav>
      <section className="overflow-hidden rounded-2xl border border-panel-border bg-panel-surface" aria-label="Seçilen rehber adımı">
        <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
          <div className="flex items-center gap-4 lg:flex-col lg:justify-center lg:rounded-2xl lg:bg-panel-surface-soft lg:p-6">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-panel-accent-soft text-panel-warm sm:h-20 sm:w-20"><Icon size={36} strokeWidth={1.5} aria-hidden="true" /></span>
            <span className="text-sm font-semibold text-panel-text-muted">Adım {selected + 1} / {steps.length}</span>
          </div>
          <div className="min-w-0" aria-live="polite" aria-atomic="true">
            <h2 className="text-xl font-bold text-panel-text sm:text-2xl">{step.title}</h2>
            {step.optional ? <p className="mt-2 text-xs text-panel-text-muted">İsteğe bağlı adım</p> : step.done ? <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-panel-blue"><CheckCircle2 size={14} aria-hidden="true" />Bilgi mevcut</p> : null}
            <p className="mt-4 max-w-2xl text-base leading-7 text-panel-text-muted">{step.body}</p>
            {step.options ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{step.options.map((option) => (
              <div key={option.title} className="rounded-xl bg-panel-surface-soft p-4">
                <h3 className="text-sm font-bold text-panel-text">{option.title}</h3>
                <p className="mt-2 text-sm leading-6 text-panel-text-muted">{option.body}</p>
              </div>
            ))}</div> : null}
            <p className="mt-5 flex items-start gap-3 border-l-2 border-panel-warm pl-4 text-sm leading-6 text-panel-text"><Lightbulb size={18} className="mt-1 shrink-0 text-panel-warm" aria-hidden="true" />{step.tip}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link to={step.to} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-panel-warm px-5 py-3 text-sm font-bold text-white hover:opacity-90 sm:w-auto">{step.cta}<ArrowRight size={16} className="shrink-0" aria-hidden="true" /></Link>
              {step.secondary ? <Link to={step.secondary.to} className="inline-flex min-h-11 items-center text-sm font-semibold text-panel-blue underline underline-offset-4">{step.secondary.label}</Link> : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#1c2b5e] px-5 py-3 sm:px-8">
          <button type="button" disabled={selected === 0} onClick={() => setSelected(selected - 1)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-base font-bold text-white transition-colors enabled:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed"><ArrowLeft size={16} aria-hidden="true" />Önceki</button>
          <span className="hidden text-base font-semibold text-white sm:block">Adımları sırayla keşfet</span>
          <button type="button" disabled={selected === steps.length - 1} onClick={() => setSelected(selected + 1)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-base font-bold text-white transition-colors enabled:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed">Sonraki<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      </section>
    </div>
  )
}
