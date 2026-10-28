IF OBJECT_ID('dbo.StudentHighSchoolGoals', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.StudentHighSchoolGoals (
    student_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY REFERENCES dbo.Users(id),
    [goals_json] NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
