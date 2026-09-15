// Sıcak Function örneği içinde, işlem-belleğinde kısa ömürlü TTL cache. Herkese aynı
// veriyi dönen (kullanıcıya özel olmayan, admin tarafından nadiren değişen) uçlar için:
// fiyat planları, ders/yayınevi listesi gibi. Duyuru/yoğun-giriş anında onlarca kullanıcı
// aynı anda aynı satırları istediğinde bunu tek bir DB sorgusuna indirir — Azure SQL'in
// (S0, 10 DTU) küçük CPU bütçesinde en yüksek kaldıraçlı, ücretsiz tasarruf burada.
//
// Ölçek-dışına çıkan her Function örneği kendi kopyasını tutar (paylaşılmaz), bu kasıtlı:
// Redis gibi paylaşılan bir katman eklemeden, her örneğin kendi TTL penceresinde en azından
// tekrarlayan sorguları önlüyoruz. TTL kısa tutulmalı (saniyeler-dakikalar), aksi halde admin
// bir fiyat/ders değiştirdiğinde diğer örnekler bunu geç görür.
//
// Bekleyen (henüz çözülmemiş) promise cache'lenir, sadece sonuç değil: aynı anahtara aynı
// anda gelen 100 eşzamanlı istek, ilk sorgu daha dönmeden hepsi cache'e düşer ve TEK DB
// sorgusunu paylaşır (klasik "cache stampede" önleme deseni).
const store = new Map()

async function cached(key, ttlMs, fetchFn) {
  const now = Date.now()
  const entry = store.get(key)
  if (entry && entry.expiresAt > now) {
    return entry.promise
  }

  const promise = Promise.resolve()
    .then(fetchFn)
    .catch((error) => {
      // Başarısız isteği cache'te tutma — bir sonraki istek yeniden denesin.
      if (store.get(key)?.promise === promise) {
        store.delete(key)
      }
      throw error
    })

  store.set(key, { promise, expiresAt: now + ttlMs })
  return promise
}

// Admin bir kaydı değiştirdiğinde ilgili anahtarı hemen düşürür — TTL dolana kadar bayat
// veri servis edilmesini önler (yazma yolu, cache'i kendi elleriyle temizler).
function invalidateCache(key) {
  store.delete(key)
}

module.exports = { cached, invalidateCache }
