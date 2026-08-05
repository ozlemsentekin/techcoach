CREATE TABLE dbo.StudentManualTestCompletions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentManualTestCompletions_StudentId REFERENCES dbo.Users(id),
    test_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentManualTestCompletions_TestId REFERENCES dbo.ResourceBookTopicTests(id),
    marked_by_user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentManualTestCompletions_MarkedByUserId REFERENCES dbo.Users(id),
    marked_at DATETIME2 NOT NULL CONSTRAINT DF_StudentManualTestCompletions_MarkedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_StudentManualTestCompletions_StudentId_TestId
ON dbo.StudentManualTestCompletions (student_id, test_id);
GO

CREATE INDEX IX_StudentManualTestCompletions_TestId
ON dbo.StudentManualTestCompletions (test_id);
GO
