IF OBJECT_ID('dbo.TaskActivityLogs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TaskActivityLogs (
      id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
      student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_TaskActivityLogs_StudentId REFERENCES dbo.Users(id),
      task_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_TaskActivityLogs_TaskId REFERENCES dbo.Tasks(id) ON DELETE SET NULL,
      action NVARCHAR(40) NOT NULL,
      actor_role NVARCHAR(20) NOT NULL,
      actor_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_TaskActivityLogs_ActorUserId REFERENCES dbo.Users(id),
      metadata_json NVARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL CONSTRAINT DF_TaskActivityLogs_CreatedAt DEFAULT SYSUTCDATETIME()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_TaskActivityLogs_StudentId_CreatedAt'
    AND object_id = OBJECT_ID('dbo.TaskActivityLogs')
)
BEGIN
  CREATE INDEX IX_TaskActivityLogs_StudentId_CreatedAt
  ON dbo.TaskActivityLogs (student_id, created_at DESC);
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_TaskActivityLogs_TaskId_CreatedAt'
    AND object_id = OBJECT_ID('dbo.TaskActivityLogs')
)
BEGIN
  CREATE INDEX IX_TaskActivityLogs_TaskId_CreatedAt
  ON dbo.TaskActivityLogs (task_id, created_at DESC);
END;
GO
