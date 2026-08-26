ALTER TABLE dbo.Entitlements DROP CONSTRAINT CK_Entitlements_Source;
GO

ALTER TABLE dbo.Entitlements ADD CONSTRAINT CK_Entitlements_Source
    CHECK (source IN ('comp', 'app_store', 'play_store', 'iyzico'));
GO

ALTER TABLE dbo.Entitlements ADD subscription_reference_code NVARCHAR(100) NULL;
GO

CREATE UNIQUE INDEX UX_Entitlements_SubscriptionReferenceCode
    ON dbo.Entitlements (subscription_reference_code)
    WHERE subscription_reference_code IS NOT NULL;
GO
