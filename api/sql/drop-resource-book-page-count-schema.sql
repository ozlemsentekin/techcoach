-- Kaynak kitap "sayfa sayısı" alanı kaldırıldı: kaynak ekleme/düzenleme ekranında
-- girişi kaldırıldı ve hiçbir yerde anlamlı şekilde kullanılmıyordu.
IF COL_LENGTH('dbo.ResourceBooks', 'page_count') IS NOT NULL
BEGIN
  -- CHECK / DEFAULT kısıtlamalarını isimlerinden bağımsız olarak temizle.
  DECLARE @constraint SYSNAME;

  SELECT @constraint = cc.name
  FROM sys.check_constraints cc
  JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
  WHERE cc.parent_object_id = OBJECT_ID('dbo.ResourceBooks') AND c.name = 'page_count';

  IF @constraint IS NOT NULL
    EXEC('ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT ' + @constraint);

  SET @constraint = NULL;
  SELECT @constraint = dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.ResourceBooks') AND c.name = 'page_count';

  IF @constraint IS NOT NULL
    EXEC('ALTER TABLE dbo.ResourceBooks DROP CONSTRAINT ' + @constraint);

  ALTER TABLE dbo.ResourceBooks DROP COLUMN page_count;
END
GO
