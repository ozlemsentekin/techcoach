-- Göreve tek bir dosya eki (resim veya PDF). Uygulamanın geri kalanıyla tutarlı olacak
-- şekilde dosya, base64 data URL olarak attachment_url kolonunda saklanır; attachment_name
-- kullanıcının gördüğü orijinal dosya adıdır. Hem "Yeni Görev Ekle" (veli/öğrenci) hem de
-- öğretmenin "Konu Tekrarı" görevinde kullanılır.
IF COL_LENGTH('dbo.Tasks', 'attachment_url') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks ADD attachment_url NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.Tasks', 'attachment_name') IS NULL
BEGIN
    ALTER TABLE dbo.Tasks ADD attachment_name NVARCHAR(255) NULL;
END;
GO
