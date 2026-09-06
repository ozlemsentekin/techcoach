// Pure positioning logic: keep the card in the viewport and outside the target.
export function positionTourCard(target, viewport, card) {
  const margin = 12
  const gap = 14
  const width = Math.min(card.width, viewport.width - margin * 2)
  const below = viewport.height - target.bottom - gap - margin
  const above = target.top - gap - margin
  const side = below >= card.height || below >= above ? 'bottom' : 'top'
  const available = Math.max(0, side === 'bottom' ? below : above)
  const height = Math.min(card.height, available)
  const left = Math.max(margin, Math.min(target.left + target.width / 2 - width / 2, viewport.width - width - margin))
  return {
    left, width, maxHeight: available,
    top: side === 'bottom' ? target.bottom + gap : target.top - gap - height,
    side,
    arrowLeft: Math.max(16, Math.min(target.left + target.width / 2 - left, width - 16)),
  }
}
