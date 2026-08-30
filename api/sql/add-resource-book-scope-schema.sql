-- Kitaplık modülü: bir kaynak kitap ya sistem yöneticilerinin kurduğu ortak katalogda
-- (scope = 'catalog') ya da veli/öğretmen/öğrencinin eklediği "özel" kaynak olarak
-- (scope = 'private') yaşar. Özel kaynaklar ortak kataloğa asla girmez; yalnızca
-- atandıkları öğrencilerin üçgenlerine (veli + öğretmen + öğrencinin kendisi) görünür.
-- bkz. api/src/bookshelf.js, api/src/catalog.js (katalog sorgularında scope = 'catalog').

IF COL_LENGTH('dbo.ResourceBooks', 'scope') IS NULL
BEGIN
  ALTER TABLE dbo.ResourceBooks ADD
    scope NVARCHAR(20) NOT NULL
      CONSTRAINT DF_ResourceBooks_Scope DEFAULT 'catalog'
      CONSTRAINT CK_ResourceBooks_Scope CHECK (scope IN ('catalog','private'));
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_ResourceBooks_Scope' AND object_id = OBJECT_ID(N'dbo.ResourceBooks')
)
BEGIN
  CREATE INDEX IX_ResourceBooks_Scope ON dbo.ResourceBooks (scope);
END
GO

-- created_by_role: öğrenci de özel kaynak ekleyebilecek.
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = N'CK_ResourceBooks_CreatedByRole' AND parent_object_id = OBJECT_ID(N'dbo.ResourceBooks')
)
BEGIN
  ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT CK_ResourceBooks_CreatedByRole;
END
GO

ALTER TABLE dbo.ResourceBooks ADD CONSTRAINT CK_ResourceBooks_CreatedByRole
  CHECK (created_by_role IN ('admin','ogretmen','ebeveyn','ogrenci'));
GO
