-- Performance pass for concurrent load: adds indexes for FK/lookup columns that
-- are hit on hot read paths (parent dashboard, homework listing/linking) but
-- were only ever created as plain columns/FKs, forcing table scans as data grows.

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_ParentId' AND object_id = OBJECT_ID('dbo.Users'))
BEGIN
  CREATE INDEX IX_Users_ParentId ON dbo.Users (parent_id) WHERE parent_id IS NOT NULL WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_HomeworkId' AND object_id = OBJECT_ID('dbo.Tasks'))
BEGIN
  CREATE INDEX IX_Tasks_HomeworkId ON dbo.Tasks (homework_id) WHERE homework_id IS NOT NULL WITH (ONLINE = ON);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WrongQuestions_TaskId_TestQuestion' AND object_id = OBJECT_ID('dbo.WrongQuestions'))
BEGIN
  CREATE INDEX IX_WrongQuestions_TaskId_TestQuestion
    ON dbo.WrongQuestions (task_id, test_id, question_number)
    WHERE task_id IS NOT NULL
    WITH (ONLINE = ON);
END
GO
