ALTER TABLE dbo.Tasks ADD resource_book_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_Tasks_ResourceBookId REFERENCES dbo.ResourceBooks(id);
GO

ALTER TABLE dbo.Tasks ADD selected_test_ids_json NVARCHAR(MAX) NULL;
GO

ALTER TABLE dbo.Tasks ADD answers_json NVARCHAR(MAX) NULL;
GO

ALTER TABLE dbo.Tasks ADD test_results_json NVARCHAR(MAX) NULL;
GO

CREATE INDEX IX_Tasks_ResourceBookId ON dbo.Tasks (resource_book_id);
GO
