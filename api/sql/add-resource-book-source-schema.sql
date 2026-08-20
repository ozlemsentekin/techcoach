ALTER TABLE dbo.ResourceBooks ADD
  resource_source NVARCHAR(20) NOT NULL CONSTRAINT DF_ResourceBooks_ResourceSource DEFAULT 'okul'
    CONSTRAINT CK_ResourceBooks_ResourceSource CHECK (resource_source IN ('okul','ozel'));
GO
