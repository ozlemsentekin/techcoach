ALTER TABLE dbo.Homeworks ADD total_page_count INT NULL;
GO

ALTER TABLE dbo.Tasks ADD target_page_count INT NULL;
GO

ALTER TABLE dbo.Tasks ADD completed_page_count INT NULL;
GO

ALTER TABLE dbo.Tasks ADD current_page_number INT NULL;
GO
