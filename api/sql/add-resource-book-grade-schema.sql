ALTER TABLE dbo.ResourceBooks ADD grade NVARCHAR(20) NULL;
GO

-- Migrasyon anında sistemdeki tüm kaynaklar 8. sınıfa ait olduğu için geriye dönük doldurma.
UPDATE dbo.ResourceBooks SET grade = N'8' WHERE grade IS NULL;
GO
