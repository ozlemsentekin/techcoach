-- Haftalık plan "taslak / Bu Günü Yayımla" akışı kaldırıldı.
--
-- Arka plan: Veli Haftalık Plan'da boş bir güne görev eklendiğinde görev gizli
-- taslak (is_draft = 1) olarak kaydediliyor, veli "Bu Günü Yayımla"ya basana
-- kadar hiçbir panelde görünmüyordu. Öğrenci paneli bu akışı zaten baypas
-- ediyordu. Artık tüm görevler doğrudan canlı yazılıyor; taslak kavramı,
-- weekly-plan-status uçları ve dbo.WeeklyPlanStatuses tablosu gereksiz.
--
-- Not: dbo.Tasks.is_draft kolonu bilinçli olarak bırakıldı — kod tabanında
-- çok sayıda savunma amaçlı "is_draft = 0" filtresi var ve artık taslak üreten
-- kod yolu kalmadığı için bu filtreler zararsız no-op. Kolonu düşürmek ayrı,
-- daha geniş bir migration konusu.

-- 1) Yayınlanmamış kalmış taslak görevleri canlıya al (aksi halde velinin
--    eklediğini sandığı görevler kalıcı olarak görünmez kalır).
UPDATE dbo.Tasks SET is_draft = 0 WHERE is_draft = 1;
GO

-- 2) Artık kullanılmayan haftalık plan durum tablosunu düşür.
IF OBJECT_ID('dbo.WeeklyPlanStatuses', 'U') IS NOT NULL
  DROP TABLE dbo.WeeklyPlanStatuses;
GO
