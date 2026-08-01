ALTER TABLE dbo.ResourceBooks ADD resource_type NVARCHAR(30) NOT NULL
    CONSTRAINT DF_ResourceBooks_ResourceType DEFAULT N'soru_bankasi'
    CONSTRAINT CK_ResourceBooks_ResourceType CHECK (resource_type IN (N'konu_anlatimi', N'soru_bankasi', N'okuma_kitabi'));
GO
