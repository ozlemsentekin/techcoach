CREATE TABLE dbo.ResourceBookAnswerKeyPhotos (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    resource_book_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_ResourceBookAnswerKeyPhotos_ResourceBookId REFERENCES dbo.ResourceBooks(id),
    sort_order INT NOT NULL,
    photo_url NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_ResourceBookAnswerKeyPhotos_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_ResourceBookAnswerKeyPhotos_ResourceBookId ON dbo.ResourceBookAnswerKeyPhotos (resource_book_id);
GO
