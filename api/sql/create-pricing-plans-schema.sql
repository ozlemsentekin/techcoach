-- Üyelik paketi fiyatları ve pazarlama kartı içerikleri. Admin panelindeki
-- "Üyelik Paketleri" ekranından yönetilir; kayıt sayfası, ödeme sayfası ve
-- koltuk satın alma modalları fiyatları buradan (GET /api/pricing) okur.
--
-- NOT: Bu tablo yalnızca GÖRÜNEN fiyatı ve metinleri belirler. iyzico'da fiilen
-- tahsil edilen tutar hâlâ iyzico abonelik planlarına (IYZICO_*_PLAN_REF env
-- değişkenleri) bağlıdır; oradaki tutarı değiştirmek için yeni bir fiyat planı
-- oluşturup referans kodunu güncellemek gerekir (setup-iyzico-*.js scriptleri).
--
-- Idempotent — tekrar çalıştırılabilir.
IF OBJECT_ID('dbo.PricingPlans', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PricingPlans (
        plan_key           NVARCHAR(40)  NOT NULL PRIMARY KEY,
        title              NVARCHAR(120) NOT NULL,
        monthly_price      INT           NOT NULL,
        yearly_price       INT           NULL,
        yearly_badge       NVARCHAR(60)  NULL,
        features_json      NVARCHAR(MAX) NULL,
        note               NVARCHAR(400) NULL,
        sort_order         INT           NOT NULL CONSTRAINT DF_PricingPlans_SortOrder DEFAULT 0,
        updated_at         DATETIME2     NOT NULL CONSTRAINT DF_PricingPlans_UpdatedAt DEFAULT SYSUTCDATETIME(),
        updated_by_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_PricingPlans_UpdatedBy REFERENCES dbo.Users(id),
        CONSTRAINT CK_PricingPlans_MonthlyPrice CHECK (monthly_price >= 0),
        CONSTRAINT CK_PricingPlans_YearlyPrice CHECK (yearly_price IS NULL OR yearly_price >= 0)
    );
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_PricingPlans_SetUpdatedAt
ON dbo.PricingPlans
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE p
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.PricingPlans p
    INNER JOIN inserted i ON i.plan_key = p.plan_key;
END;
GO

-- Mevcut sabit-kodlu fiyatlarla ilk doldurma (yalnızca ilgili satır yoksa eklenir;
-- var olan satırlara dokunulmaz, böylece admin'in yaptığı değişiklikler korunur).
MERGE dbo.PricingPlans AS target
USING (VALUES
    ('parent', N'Veli Takip Paketi', 2999, 24000, N'%20 indirim',
        N'["2 öğrenciye kadar tam erişim","Günlük çalışma planı ve ders ajandası görünürlüğü","Hata defteri ile konu bazlı tekrar takibi","Haftalık ilerleme raporu ve risk uyarıları","Sınav takvimini fotoğrafla saniyeler içinde içe aktarma","Öğretmenle paylaşımlı görünüm ve bildirimler"]',
        NULL, 1),
    ('teacher', N'Öğretmen İş Paketi', 2999, NULL, NULL,
        N'["4 öğrenciye kadar dahil, ek öğrenci 299 TL / ay","Sınıf geneli hata yoğunluğu ve öncelik alanları analizi","Öğrenci bazlı haftalık performans raporları","Ödev ve sınav atama, teslim takibi","Velilerle otomatik paylaşım ve bildirim akışı","Öncelikli destek hattı"]',
        N'Kart tahsilatı yakında aktif olacak; üye olduğunuzda hesabınız deneme durumunda hemen açılır.', 2),
    ('teacher_seat', N'Öğretmen Ek Öğrenci Paketi', 299, 4990, N'2 ay bedava', NULL, NULL, 3),
    ('child_seat', N'Ek Çocuk Paketi', 1999, 14999, N'2 ay bedava', NULL, NULL, 4)
) AS source (plan_key, title, monthly_price, yearly_price, yearly_badge, features_json, note, sort_order)
ON target.plan_key = source.plan_key
WHEN NOT MATCHED BY TARGET THEN
    INSERT (plan_key, title, monthly_price, yearly_price, yearly_badge, features_json, note, sort_order)
    VALUES (source.plan_key, source.title, source.monthly_price, source.yearly_price, source.yearly_badge, source.features_json, source.note, source.sort_order);
GO
