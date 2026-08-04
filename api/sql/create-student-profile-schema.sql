CREATE TABLE dbo.StudentProfiles (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    student_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_StudentProfiles_StudentId REFERENCES dbo.Users(id),
    province_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_StudentProfiles_ProvinceId REFERENCES dbo.Provinces(id),
    district_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_StudentProfiles_DistrictId REFERENCES dbo.Districts(id),
    school_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_StudentProfiles_SchoolId REFERENCES dbo.Schools(id),
    birth_date DATE NULL,
    supported_team NVARCHAR(100) NULL,
    phone NVARCHAR(30) NULL,
    photo_url NVARCHAR(MAX) NULL,
    interested_sports_json NVARCHAR(MAX) NULL,
    interested_arts_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_StudentProfiles_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_StudentProfiles_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_StudentProfiles_StudentId ON dbo.StudentProfiles (student_id);
GO

CREATE OR ALTER TRIGGER dbo.TR_StudentProfiles_SetUpdatedAt
ON dbo.StudentProfiles
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.StudentProfiles p
    INNER JOIN inserted i ON i.id = p.id;
END;
GO
