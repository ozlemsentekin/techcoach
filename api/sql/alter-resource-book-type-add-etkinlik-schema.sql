ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT CK_ResourceBooks_ResourceType;
GO

ALTER TABLE dbo.ResourceBooks ADD
    CONSTRAINT CK_ResourceBooks_ResourceType CHECK (resource_type IN (N'konu_anlatimi', N'soru_bankasi', N'okuma_kitabi', N'etkinlik'));
GO
