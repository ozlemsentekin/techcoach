IF COL_LENGTH('dbo.Tasks', 'timer_started_at') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD timer_started_at DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.Tasks', 'timer_stopped_at') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD timer_stopped_at DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.Tasks', 'timer_elapsed_seconds') IS NULL
BEGIN
  ALTER TABLE dbo.Tasks ADD timer_elapsed_seconds INT NULL;
END;
GO
