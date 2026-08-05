ALTER TABLE dbo.Tasks ADD student_teacher_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_Tasks_StudentTeacherId REFERENCES dbo.StudentTeachers(id);
GO

CREATE INDEX IX_Tasks_StudentTeacherId ON dbo.Tasks (student_teacher_id);
GO
