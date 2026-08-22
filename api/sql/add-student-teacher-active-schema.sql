IF COL_LENGTH('dbo.StudentTeachers', 'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.StudentTeachers
    ADD is_active BIT NOT NULL CONSTRAINT DF_StudentTeachers_IsActive DEFAULT 1;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_StudentTeachers_TeacherUserId_IsActive'
    AND object_id = OBJECT_ID('dbo.StudentTeachers')
)
BEGIN
  CREATE INDEX IX_StudentTeachers_TeacherUserId_IsActive
  ON dbo.StudentTeachers (teacher_user_id, is_active)
  WHERE teacher_user_id IS NOT NULL;
END
GO
