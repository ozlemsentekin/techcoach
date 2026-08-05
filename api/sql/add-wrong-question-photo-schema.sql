ALTER TABLE dbo.WrongQuestions ADD test_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_WrongQuestions_TestId REFERENCES dbo.ResourceBookTopicTests(id);
GO

ALTER TABLE dbo.WrongQuestions ADD test_name NVARCHAR(200) NULL;
GO

ALTER TABLE dbo.WrongQuestions ADD book_name NVARCHAR(200) NULL;
GO

ALTER TABLE dbo.WrongQuestions ADD publisher_name NVARCHAR(200) NULL;
GO

ALTER TABLE dbo.WrongQuestions ADD photo_url NVARCHAR(MAX) NULL;
GO

CREATE INDEX IX_WrongQuestions_TestId ON dbo.WrongQuestions (test_id);
GO
