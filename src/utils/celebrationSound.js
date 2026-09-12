// %100 başarı kutlaması sesi. Ses dosyası yok — Web Audio API ile kısa bir "alkış"
// sentezlenir: filtrelenmiş beyaz gürültü parçacıkları rastgele zamanlarda art arda
// tetiklenerek bir kalabalığın alkışına benzer bir doku oluşturur. Görev tamamlama
// kullanıcı etkileşimiyle tetiklendiği için tarayıcı autoplay engeline takılmaz.
// Hata durumunda sessizce vazgeçer.

function buildNoiseBuffer(ctx, duration) {
  const length = Math.max(1, Math.round(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

// Tek bir "el çırpma" darbesi: kısa gürültü + bant geçiren filtre + hızlı sönümlü zarf.
function scheduleClap(ctx, noiseBuffer, master, startTime, amplitude) {
  const clapDuration = 0.045 + Math.random() * 0.05
  const maxOffset = Math.max(0, noiseBuffer.duration - clapDuration)
  const offset = Math.random() * maxOffset

  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1000 + Math.random() * 2200
  filter.Q.value = 0.8 + Math.random() * 1.4

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(amplitude, startTime + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0008, startTime + clapDuration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)

  source.start(startTime, offset, clapDuration)
  source.stop(startTime + clapDuration + 0.01)
}

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
    const totalDuration = 1.1
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)

    const noiseBuffer = buildNoiseBuffer(ctx, totalDuration + 0.1)

    // Alkış "kalabalık" dokusu: art arda rastgele el çırpma darbeleri. Yoğunluk
    // başta hızlı yükselir, ortada yüksek kalır, sonda azalarak söner.
    const clapCount = 55
    for (let i = 0; i < clapCount; i += 1) {
      const progress = i / clapCount
      // Yoğunluk zarfı: 0->1 hızlı çıkış, 1 civarı platoda kalır, sona doğru söner.
      const envelope =
        progress < 0.15
          ? progress / 0.15
          : progress > 0.75
            ? Math.max(0, 1 - (progress - 0.75) / 0.25)
            : 1
      const jitter = (Math.random() - 0.5) * 0.02
      const startTime = now + progress * totalDuration + jitter
      const amplitude = (0.5 + Math.random() * 0.6) * (0.35 + envelope * 0.65)
      scheduleClap(ctx, noiseBuffer, master, Math.max(now, startTime), amplitude)
    }

    // Bağlamı serbest bırak
    window.setTimeout(() => {
      try {
        ctx.close()
      } catch {
        // yoksay
      }
    }, (totalDuration + 0.6) * 1000)
  } catch {
    try {
      ctx.close()
    } catch {
      // yoksay
    }
  }
}
