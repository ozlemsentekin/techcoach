ALTER TABLE dbo.StudentProfiles ADD school_schedule_json NVARCHAR(MAX) NULL;
GO

CREATE TABLE dbo.SchoolClassSchedules (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    school_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SchoolClassSchedules_SchoolId REFERENCES dbo.Schools(id),
    grade NVARCHAR(20) NOT NULL,
    schedule_json NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_SchoolClassSchedules_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_SchoolClassSchedules_School_Grade UNIQUE (school_id, grade)
);
GO

CREATE OR ALTER TRIGGER dbo.TR_SchoolClassSchedules_SetUpdatedAt
ON dbo.SchoolClassSchedules
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.SchoolClassSchedules t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO
