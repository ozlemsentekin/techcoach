-- Veli hesapları için "anne" / "baba" ayrımını tutar (öğretmen/öğrenci hesaplarında NULL kalır).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'parent_type'
)
BEGIN
  ALTER TABLE dbo.Users
    ADD parent_type NVARCHAR(10) NULL;
END
GO
