-- Derslere aktif/pasif durumu ekler. Pasif dersler kayıt ve panel ders
-- seçicilerinde görünmez; mevcut öğrenci ders atamaları ve kaynaklar etkilenmez
-- (ders silme yok, yalnızca görünürlük). Admin "Dersler" ekranı pasif dersleri de
-- listeler ve tekrar aktife alınabilir.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Subjects') AND name = 'is_active'
)
BEGIN
  ALTER TABLE dbo.Subjects
    ADD is_active BIT NOT NULL CONSTRAINT DF_Subjects_IsActive DEFAULT 1;
END
GO

-- Talep üzerine Biyoloji ve Kimya dersleri pasife alınır.
UPDATE dbo.Subjects SET is_active = 0 WHERE name IN (N'Biyoloji', N'Kimya');
GO
