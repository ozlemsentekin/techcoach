CREATE TABLE dbo.StudentTeachers (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentTeachers_StudentId REFERENCES dbo.Users(id),
    subject_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentTeachers_SubjectId REFERENCES dbo.Subjects(id),
    created_by_parent_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentTeachers_CreatedByParentId REFERENCES dbo.Users(id),
    teacher_full_name NVARCHAR(120) NOT NULL,
    phone NVARCHAR(30) NOT NULL,
    teacher_type NVARCHAR(30) NOT NULL CONSTRAINT CK_StudentTeachers_TeacherType CHECK (teacher_type IN (N'ozel_ogretmen', N'okul_ogretmeni')),
    schedule_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_StudentTeachers_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_StudentTeachers_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_StudentTeachers_StudentId ON dbo.StudentTeachers (student_id);
GO

CREATE INDEX IX_StudentTeachers_SubjectId ON dbo.StudentTeachers (subject_id);
GO

CREATE OR ALTER TRIGGER dbo.TR_StudentTeachers_SetUpdatedAt
ON dbo.StudentTeachers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE st
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.StudentTeachers st
    INNER JOIN inserted i ON i.id = st.id;
END;
GO
