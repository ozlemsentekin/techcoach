-- "Okul Ödevi" ödevlerinin bağlandığı okul kaynağı (bkz. dbo.SchoolClassResources).
-- resource_book_id dolu olan ödevler kütüphane soru bankası ödevi; school_resource_id
-- dolu olanlar okul + sınıf + ders bazlı okul ödevidir. İkisi karşılıklı dışlar.
IF COL_LENGTH('dbo.Homeworks', 'school_resource_id') IS NULL
BEGIN
  ALTER TABLE dbo.Homeworks ADD school_resource_id UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Homeworks_SchoolResourceId')
BEGIN
  ALTER TABLE dbo.Homeworks
    ADD CONSTRAINT FK_Homeworks_SchoolResourceId FOREIGN KEY (school_resource_id)
    REFERENCES dbo.SchoolClassResources(id);
END
GO
