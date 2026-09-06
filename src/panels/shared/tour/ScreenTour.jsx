import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../../ui/Button'
import { positionTourCard } from './tourPosition'

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

// Keep the actual target operable, while making the rest of the page inert.
function isolateTour(target, overlay) {
  const changed = []
  function visit(parent) {
    for (const child of parent.children) {
      if (!(child instanceof HTMLElement) || child === target || child === overlay) continue
      if (child.contains(target) || child.contains(overlay)) visit(child)
      else if (!child.inert) { child.inert = true; changed.push(child) }
    }
  }
  visit(document.body)
  return () => changed.forEach((element) => { element.inert = false })
}

export default function ScreenTour({ steps, totalSteps = steps.length, onClose }) {
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState({ status: 'loading' })
  const overlayRef = useRef(null)
  const cardRef = useRef(null)
  const targetRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const step = steps[index]
  const titleId = useId()
  const descriptionId = useId()
  const ownedTargetId = useId()
  const expectedRoute = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const frame = requestAnimationFrame(() => cardRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      const fallbackTarget = targetRef.current
      queueMicrotask(() => {
        const restore = previousFocus instanceof HTMLElement && previousFocus.isConnected ? previousFocus : fallbackTarget
        if (restore?.isConnected && document.activeElement === document.body) restore.focus({ preventScroll: true })
      })
    }
  }, [])

  useEffect(() => {
    if (!step) { onClose('unavailable'); return }
    expectedRoute.current = step.route
    navigate(step.route)
  }, [step, navigate, onClose])

  useEffect(() => {
    if (!step) return undefined
    let disposed = false
    let timer
    let frame
    let releaseIsolation = isolateTour(null, overlayRef.current)
    let observedTarget = null
    let reachedRoute = false
    const startedAt = Date.now()
    const resizeObserver = new ResizeObserver(() => schedule())
    resizeObserver.observe(cardRef.current)

    function measure() {
      if (disposed) return
      if (location.pathname !== step.route) {
        setView({ status: Date.now() - startedAt > 8000 ? 'missing' : 'loading' })
        return
      }
      reachedRoute = true
      let target
      try { target = document.querySelector(step.target) } catch { setView({ status: 'missing' }); return }
      const rect = target?.getBoundingClientRect()
      if (!target || !rect?.width || !rect?.height || target.disabled) {
        releaseIsolation()
        releaseIsolation = isolateTour(null, overlayRef.current)
        if (observedTarget) resizeObserver.unobserve(observedTarget)
        observedTarget = null
        targetRef.current = null
        setView({ status: Date.now() - startedAt > 8000 ? 'missing' : 'loading' })
        return
      }
      if (observedTarget !== target) {
        if (observedTarget) resizeObserver.unobserve(observedTarget)
        observedTarget = target
        resizeObserver.observe(target)
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
        releaseIsolation()
        releaseIsolation = isolateTour(target, overlayRef.current)
      }
      targetRef.current = target
      const box = target.getBoundingClientRect()
      const viewport = { width: document.documentElement.clientWidth, height: window.visualViewport?.height || window.innerHeight }
      // Scroll again after a viewport resize, orientation change, or user scroll.
      if (box.top < 12 || box.bottom > viewport.height - 12) {
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
      }
      const measured = target.getBoundingClientRect()
      const targetBox = { left: Math.max(4, measured.left - 6), top: Math.max(4, measured.top - 6), right: Math.min(viewport.width - 4, measured.right + 6), bottom: Math.min(viewport.height - 4, measured.bottom + 6) }
      targetBox.width = targetBox.right - targetBox.left
      const placement = positionTourCard(targetBox, viewport, { width: 352, height: cardRef.current.querySelector('[data-tour-content]').scrollHeight })
      setView({ status: 'ready', target: targetBox, placement, viewport })
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.visualViewport?.addEventListener('resize', schedule)
    timer = window.setInterval(measure, 500)
    schedule()
    return () => {
      disposed = true
      clearInterval(timer)
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.visualViewport?.removeEventListener('resize', schedule)
      releaseIsolation()
      // Do not drag the user back if they deliberately leave a resolved step.
      if (reachedRoute) expectedRoute.current = null
    }
  }, [step, location.pathname, attempt])

  useEffect(() => {
    if (expectedRoute.current === null && location.pathname !== step?.route) onClose('route-changed')
  }, [location.pathname, step, onClose])

  useEffect(() => {
    const target = targetRef.current
    if (view.status !== 'ready' || !target) return undefined
    const overlay = overlayRef.current
    const previousId = target.getAttribute('id')
    if (!previousId) target.id = ownedTargetId
    overlay.setAttribute('aria-owns', target.id)
    const previousDescription = target.getAttribute('aria-describedby')
    target.setAttribute('aria-describedby', [previousDescription, descriptionId].filter(Boolean).join(' '))
    return () => {
      overlay.removeAttribute('aria-owns')
      if (!previousId) target.removeAttribute('id')
      if (previousDescription === null) target.removeAttribute('aria-describedby')
      else target.setAttribute('aria-describedby', previousDescription)
    }
  }, [view.status, descriptionId, ownedTargetId, index, attempt])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose('skipped'); return }
      if (event.key !== 'Tab') return
      const target = targetRef.current
      const controls = [...cardRef.current.querySelectorAll(FOCUSABLE)]
      if (target?.matches(FOCUSABLE)) controls.unshift(target)
      if (!controls.length) return
      const current = controls.indexOf(document.activeElement)
      const next = event.shiftKey ? (current <= 0 ? controls.length - 1 : current - 1) : (current + 1) % controls.length
      event.preventDefault()
      controls[next].focus({ preventScroll: true })
    }
    const handleFocus = (event) => {
      if (!overlayRef.current?.contains(event.target) && event.target !== targetRef.current) cardRef.current?.focus({ preventScroll: true })
    }
    const handleTarget = (event) => {
      if (targetRef.current?.contains(event.target)) onClose('handed-off')
    }
    document.addEventListener('keydown', handleKey, true)
    document.addEventListener('focusin', handleFocus)
    document.addEventListener('click', handleTarget, true)
    return () => {
      document.removeEventListener('keydown', handleKey, true)
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('click', handleTarget, true)
    }
  }, [onClose])

  const next = () => {
    const target = targetRef.current
    if (!target?.isConnected) { setAttempt((value) => value + 1); return }
    if (step.activateTarget) {
      onClose('handed-off')
      // Let inert/focus cleanup finish before opening the existing form/modal.
      requestAnimationFrame(() => { target.focus({ preventScroll: true }); target.click() })
    } else if (index + 1 < steps.length) {
      setView({ status: 'loading' })
      setIndex((value) => value + 1)
    } else onClose('finished')
  }

  const ready = view.status === 'ready'
  const box = view.target
  const placement = view.placement
  const curtain = 'pointer-events-auto absolute bg-black/50'
  return (
    <div ref={overlayRef} className="pointer-events-none fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      {ready ? <>
        <div className={curtain} style={{ inset: '0 0 auto', height: box.top }} />
        <div className={curtain} style={{ top: box.bottom, bottom: 0, left: 0, right: 0 }} />
        <div className={curtain} style={{ top: box.top, height: box.bottom - box.top, left: 0, width: box.left }} />
        <div className={curtain} style={{ top: box.top, height: box.bottom - box.top, left: box.right, right: 0 }} />
        <div className="absolute rounded-2xl ring-2 ring-panel-warm ring-offset-2 ring-offset-panel-surface" style={{ top: box.top, left: box.left, width: box.right - box.left, height: box.bottom - box.top }} />
      </> : <div className={`${curtain} inset-0`} />}
      <section ref={cardRef} tabIndex={-1} className="pointer-events-auto absolute rounded-2xl border border-panel-border bg-panel-surface text-panel-text shadow-panel-2 outline-none" style={ready ? { top: placement.top, left: placement.left, width: placement.width } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(352px, calc(100vw - 24px))' }}>
        {ready ? <span aria-hidden="true" className="absolute h-3 w-3 rotate-45 border-panel-border bg-panel-surface" style={{ left: placement.arrowLeft - 6, ...(placement.side === 'bottom' ? { top: -7, borderTopWidth: 1, borderLeftWidth: 1 } : { bottom: -7, borderBottomWidth: 1, borderRightWidth: 1 }) }} /> : null}
        <div data-tour-content className="overflow-y-auto p-4 sm:p-5" style={{ maxHeight: ready ? placement.maxHeight : '80dvh' }}>
          <p className="text-xs font-bold tracking-wide text-panel-warm">{index + 1} / {totalSteps}</p>
          <h2 id={titleId} className="mt-2 text-lg font-bold">{step?.title || 'Başlangıç rehberi'}</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-panel-text-muted">{step?.description}</p>
          <p role="status" className="mt-2 text-sm text-panel-text-muted">{view.status === 'loading' ? 'İlgili alan hazırlanıyor…' : view.status === 'missing' ? 'Bu alan şu anda gösterilemiyor. Yeniden deneyebilir veya rehberi profil menüsünden daha sonra açabilirsiniz.' : ''}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => onClose('skipped')}>Turu geç</Button>
            {view.status === 'missing' ? <Button className="min-h-11" onClick={() => { navigate(step.route); setAttempt((value) => value + 1) }}>Yeniden dene</Button> : <Button className="min-h-11" disabled={!ready} onClick={next}>İleri</Button>}
          </div>
        </div>
      </section>
    </div>
  )
}
