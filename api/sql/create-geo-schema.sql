CREATE TABLE dbo.Provinces (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(50) NOT NULL,
    plate_code SMALLINT NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Provinces_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_Provinces_PlateCode ON dbo.Provinces (plate_code);
GO

CREATE UNIQUE INDEX UX_Provinces_Name ON dbo.Provinces (name);
GO

CREATE TABLE dbo.Districts (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    province_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Districts_ProvinceId REFERENCES dbo.Provinces(id),
    name NVARCHAR(50) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Districts_CreatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Districts_ProvinceId ON dbo.Districts (province_id);
GO

CREATE UNIQUE INDEX UX_Districts_ProvinceId_Name ON dbo.Districts (province_id, name);
GO

CREATE TABLE dbo.Schools (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    province_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Schools_ProvinceId REFERENCES dbo.Provinces(id),
    district_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Schools_DistrictId REFERENCES dbo.Districts(id),
    name NVARCHAR(200) NOT NULL,
    school_type NVARCHAR(20) NOT NULL CONSTRAINT CK_Schools_SchoolType CHECK (school_type IN (N'devlet', N'ozel')),
    is_active BIT NOT NULL CONSTRAINT DF_Schools_IsActive DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_Schools_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_Schools_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_Schools_DistrictId ON dbo.Schools (district_id);
GO

CREATE INDEX IX_Schools_ProvinceId ON dbo.Schools (province_id);
GO

CREATE UNIQUE INDEX UX_Schools_DistrictId_Name ON dbo.Schools (district_id, name);
GO

CREATE OR ALTER TRIGGER dbo.TR_Schools_SetUpdatedAt
ON dbo.Schools
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE s
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.Schools s
    INNER JOIN inserted i ON i.id = s.id;
END;
GO
