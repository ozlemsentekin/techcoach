-- Admin panelinden yönetilen, veli aboneliği (parent plan) için yüzdelik indirim kuponları.
-- Her kupon oluşturulduğunda dbo.PricingPlans('parent') üzerindeki GÜNCEL fiyattan hesaplanan
-- indirimli tutarla iyzico'da AYRI bir ürün/fiyat planı oluşturulur (referans kodları burada
-- saklanır) — iyzico'nun abonelik fiyat planlarında checkout anında indirim/override parametresi
-- olmadığından tek yol budur (bkz. pricing.js refreshIyzicoPlanHandler ile aynı desen).
-- İndirim %100 olsa bile en az 1 TL'lik bir plan oluşturulur (gerçek kart + tekrarlayan tahsilat
-- garantisi için) — bkz. coupons.js.
CREATE TABLE dbo.Coupons (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Coupons_Id DEFAULT NEWID() PRIMARY KEY,
    code NVARCHAR(50) NOT NULL,
    discount_percent INT NOT NULL CONSTRAINT CK_Coupons_DiscountPercent CHECK (discount_percent BETWEEN 1 AND 100),
    description NVARCHAR(255) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_Coupons_IsActive DEFAULT 1,
    -- Kupon oluşturulduğu anda dbo.PricingPlans('parent')'tan okunan taban fiyatlar — yalnızca
    -- referans/denetim amaçlı, checkout bu tutarları değil aşağıdaki plan referanslarını kullanır.
    base_monthly_price INT NOT NULL,
    base_yearly_price INT NULL,
    iyzico_monthly_plan_ref NVARCHAR(100) NOT NULL,
    iyzico_yearly_plan_ref NVARCHAR(100) NULL,
    created_by_user_id UNIQUEIDENTIFIER NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Coupons_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Coupons_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Coupons_Code ON dbo.Coupons (code);
GO
