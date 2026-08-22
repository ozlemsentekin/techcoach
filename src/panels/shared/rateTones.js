export const RATE_TONES = {
  blue: { chip: 'bg-panel-blue-soft text-panel-blue', bar: 'bg-panel-blue', text: 'text-panel-blue' },
  sage: { chip: 'bg-panel-sage-soft text-panel-sage', bar: 'bg-panel-sage', text: 'text-panel-sage' },
  green: { chip: 'bg-panel-green-soft text-panel-green', bar: 'bg-panel-green', text: 'text-panel-green' },
  accent: { chip: 'bg-panel-accent-soft text-panel-accent', bar: 'bg-panel-accent', text: 'text-panel-accent' },
  warm: { chip: 'bg-panel-warm-soft text-panel-warm', bar: 'bg-panel-warm', text: 'text-panel-warm' },
  yellow: { chip: 'bg-panel-yellow-soft text-panel-yellow', bar: 'bg-panel-yellow', text: 'text-panel-yellow' },
  red: { chip: 'bg-panel-red-soft text-panel-red', bar: 'bg-panel-red', text: 'text-panel-red' },
  neutral: { chip: 'bg-panel-surface-soft text-panel-text-muted', bar: 'bg-panel-text-muted/40', text: 'text-panel-text-muted' },
}

// panel-sage her temada farklı bir tona boyandığı için (bazılarında sarıya çok yakın) başarı
// oranı eşikleri kasıtlı olarak temadan bağımsız sabit "green" tonunu kullanır — bkz. index.css.
export function successRateTone(value) {
  if (value === null || value === undefined) return 'neutral'
  if (value >= 0.9) return 'green'
  if (value >= 0.8) return 'yellow'
  return 'red'
}

export function completionRateTone(value) {
  if (!value) return 'neutral'
  return 'blue'
}
