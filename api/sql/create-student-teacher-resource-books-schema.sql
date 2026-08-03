IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_StudentTeachers_Id_StudentId'
      AND object_id = OBJECT_ID(N'dbo.StudentTeachers')
)
BEGIN
    CREATE UNIQUE INDEX UX_StudentTeachers_Id_StudentId
    ON dbo.StudentTeachers (id, student_id);
END;
GO

IF OBJECT_ID(N'dbo.StudentTeacherResourceBooks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StudentTeacherResourceBooks (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        teacher_id UNIQUEIDENTIFIER NOT NULL,
        student_id UNIQUEIDENTIFIER NOT NULL,
        resource_book_id UNIQUEIDENTIFIER NOT NULL,
        assigned_at DATETIME2 NOT NULL CONSTRAINT DF_StudentTeacherResourceBooks_AssignedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_StudentTeacherResourceBooks_Teacher
            FOREIGN KEY (teacher_id, student_id) REFERENCES dbo.StudentTeachers(id, student_id) ON DELETE CASCADE,
        CONSTRAINT FK_StudentTeacherResourceBooks_StudentResourceBook
            FOREIGN KEY (student_id, resource_book_id) REFERENCES dbo.StudentResourceBooks(student_id, resource_book_id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_StudentTeacherResourceBooks_TeacherId_ResourceBookId'
      AND object_id = OBJECT_ID(N'dbo.StudentTeacherResourceBooks')
)
BEGIN
    CREATE UNIQUE INDEX UX_StudentTeacherResourceBooks_TeacherId_ResourceBookId
    ON dbo.StudentTeacherResourceBooks (teacher_id, resource_book_id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_StudentTeacherResourceBooks_StudentId'
      AND object_id = OBJECT_ID(N'dbo.StudentTeacherResourceBooks')
)
BEGIN
    CREATE INDEX IX_StudentTeacherResourceBooks_StudentId
    ON dbo.StudentTeacherResourceBooks (student_id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_StudentTeacherResourceBooks_ResourceBookId'
      AND object_id = OBJECT_ID(N'dbo.StudentTeacherResourceBooks')
)
BEGIN
    CREATE INDEX IX_StudentTeacherResourceBooks_ResourceBookId
    ON dbo.StudentTeacherResourceBooks (resource_book_id);
END;
GO
