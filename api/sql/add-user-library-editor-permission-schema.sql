-- Kütüphane kataloğunda (yayın evi, kaynak kitap, içerik, test, cevap anahtarı) veri
-- işlemi yapabilme yetkisi. Admin panelinden "Üyeyi Düzenle" ekranındaki onay kutusuyla
-- verilir. Admin hesapları bu bayrağa bakılmaksızın her zaman yetkilidir. Yetkisi
-- olmayan öğretmen/veli kütüphaneyi yalnızca görüntüleyebilir (bkz. api/src/admin.js
-- requireLibraryEditor, PublisherCatalogScreen.jsx canEdit).
IF COL_LENGTH('dbo.Users', 'can_manage_library') IS NULL
BEGIN
  ALTER TABLE dbo.Users
    ADD can_manage_library BIT NOT NULL CONSTRAINT DF_Users_CanManageLibrary DEFAULT 0;
END;
GO
