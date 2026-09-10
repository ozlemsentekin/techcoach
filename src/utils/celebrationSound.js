// %100 başarı kutlaması sesi. Ses dosyası yok — Web Audio API ile kısa, neşeli bir
// arpej + "parıltı" sentezlenir. Görev tamamlama kullanıcı etkileşimiyle tetiklendiği
// için tarayıcı autoplay engeline takılmaz. Hata durumunda sessizce vazgeçer.
export function playCelebrationSound() {
  if (typeof window === 'undefined') return

  // Kullanıcı hareket azaltmayı tercih ediyorsa ses de çalma.
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }
  } catch {
    // matchMedia yoksa devam et
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return

  let ctx
  try {
    ctx = new AudioCtx()
  } catch {
    return
  }

  try {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)

    // Yükselen arpej (C5 - E5 - G5 - C6)
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const start = now + i * 0.11
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.9, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.connect(gain)
      gain.connect(master)
      osc.start(start)
      osc.stop(start + 0.4)
    })

    // Sonda kısa "parıltı"
    const sparkle = ctx.createOscillator()
    const sparkleGain = ctx.createGain()
    const sparkleStart = now + notes.length * 0.11
    sparkle.type = 'sine'
    sparkle.frequency.setValueAtTime(1568, sparkleStart)
    sparkle.frequency.exponentialRampToValueAtTime(2637, sparkleStart + 0.25)
    sparkleGain.gain.setValueAtTime(0, sparkleStart)
    sparkleGain.gain.linearRampToValueAtTime(0.5, sparkleStart + 0.03)
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, sparkleStart + 0.45)
    sparkle.connect(sparkleGain)
    sparkleGain.connect(master)
    sparkle.start(sparkleStart)
    sparkle.stop(sparkleStart + 0.5)

    // Bağlamı serbest bırak
    window.setTimeout(() => {
      try {
        ctx.close()
      } catch {
        // yoksay
      }
    }, 1500)
  } catch {
    try {
      ctx.close()
    } catch {
      // yoksay
    }
  }
}
