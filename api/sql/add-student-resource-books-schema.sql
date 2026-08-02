ALTER TABLE dbo.ResourceBooks ADD image_url NVARCHAR(1000) NULL;
GO

CREATE TABLE dbo.StudentResourceBooks (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentResourceBooks_StudentId REFERENCES dbo.Users(id),
    resource_book_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentResourceBooks_ResourceBookId REFERENCES dbo.ResourceBooks(id),
    assigned_at DATETIME2 NOT NULL CONSTRAINT DF_StudentResourceBooks_AssignedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_StudentResourceBooks_StudentId_ResourceBookId
ON dbo.StudentResourceBooks (student_id, resource_book_id);
GO

CREATE INDEX IX_StudentResourceBooks_ResourceBookId
ON dbo.StudentResourceBooks (resource_book_id);
GO
