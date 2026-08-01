CREATE TABLE dbo.Questions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    test_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Questions_TestId REFERENCES dbo.ResourceBookTopicTests(id),
    order_no INT NOT NULL CONSTRAINT CK_Questions_OrderNo CHECK (order_no > 0),
    passage_text NVARCHAR(MAX) NULL,
    question_text NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Questions_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Questions_TestId ON dbo.Questions (test_id);
GO

CREATE UNIQUE INDEX UX_Questions_TestId_OrderNo ON dbo.Questions (test_id, order_no);
GO

CREATE TABLE dbo.QuestionOptions (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    question_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_QuestionOptions_QuestionId REFERENCES dbo.Questions(id),
    option_label NCHAR(1) NOT NULL CONSTRAINT CK_QuestionOptions_OptionLabel CHECK (option_label IN (N'A', N'B', N'C', N'D', N'E')),
    option_text NVARCHAR(MAX) NOT NULL,
    is_correct BIT NOT NULL CONSTRAINT DF_QuestionOptions_IsCorrect DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_QuestionOptions_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_QuestionOptions_QuestionId ON dbo.QuestionOptions (question_id);
GO

CREATE UNIQUE INDEX UX_QuestionOptions_QuestionId_OptionLabel ON dbo.QuestionOptions (question_id, option_label);
GO
