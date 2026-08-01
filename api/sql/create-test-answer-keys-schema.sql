CREATE TABLE dbo.TestAnswerKeys (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    test_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_TestAnswerKeys_TestId REFERENCES dbo.ResourceBookTopicTests(id),
    order_no INT NOT NULL CONSTRAINT CK_TestAnswerKeys_OrderNo CHECK (order_no > 0),
    correct_label NCHAR(1) NOT NULL CONSTRAINT CK_TestAnswerKeys_CorrectLabel CHECK (correct_label IN (N'A', N'B', N'C', N'D', N'E')),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_TestAnswerKeys_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_TestAnswerKeys_TestId ON dbo.TestAnswerKeys (test_id);
GO

CREATE UNIQUE INDEX UX_TestAnswerKeys_TestId_OrderNo ON dbo.TestAnswerKeys (test_id, order_no);
GO
