-- Kaynak kitap barkod alanı kaldırıldı: UI'da girişi yok, hiçbir yerde kullanılmıyor.
IF COL_LENGTH('dbo.ResourceBooks', 'barcode') IS NOT NULL
BEGIN
  DECLARE @constraint SYSNAME;
  SELECT @constraint = dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.ResourceBooks') AND c.name = 'barcode';

  IF @constraint IS NOT NULL
    EXEC('ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT ' + @constraint);

  ALTER TABLE dbo.ResourceBooks DROP COLUMN barcode;
END
GO
