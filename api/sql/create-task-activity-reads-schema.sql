-- Bildirim merkezi: her izleyici (veli / öğretmen) için "okundu" durumu.
-- dbo.TaskActivityLogs satırları paylaşılır; okundu bilgisi kullanıcıya özeldir.
IF OBJECT_ID('dbo.TaskActivityReads', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.TaskActivityReads (
      activity_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_TaskActivityReads_ActivityId REFERENCES dbo.TaskActivityLogs(id) ON DELETE CASCADE,
      user_id UNIQUEIDENTIFIER NOT NULL
          CONSTRAINT FK_TaskActivityReads_UserId REFERENCES dbo.Users(id),
      read_at DATETIME2 NOT NULL CONSTRAINT DF_TaskActivityReads_ReadAt DEFAULT SYSUTCDATETIME(),
      CONSTRAINT PK_TaskActivityReads PRIMARY KEY (activity_id, user_id)
  );
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_TaskActivityReads_UserId'
    AND object_id = OBJECT_ID('dbo.TaskActivityReads')
)
BEGIN
  CREATE INDEX IX_TaskActivityReads_UserId
  ON dbo.TaskActivityReads (user_id);
END;
GO

-- Öğretmen bildirim akışı student_id filtresi olmadan (ilişki CTE'si üzerinden)
-- çalıştığından, son N kaydı taramak için actor_role + created_at üzerinde destek indexi.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_TaskActivityLogs_ActorRole_CreatedAt'
    AND object_id = OBJECT_ID('dbo.TaskActivityLogs')
)
BEGIN
  CREATE INDEX IX_TaskActivityLogs_ActorRole_CreatedAt
  ON dbo.TaskActivityLogs (actor_role, created_at DESC)
  INCLUDE (student_id, task_id, action);
END;
GO
