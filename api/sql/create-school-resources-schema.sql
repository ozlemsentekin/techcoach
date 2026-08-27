-- Okul + sınıf + ders bazlı "okul kaynağı" tanımları. Veli, öğrenciye "Okul Ödevi" görevi
-- eklerken öğrencinin okuluna/sınıfına/dersine tanımlı bu kaynakları (ad + profil resmi)
-- basit bir dropdown'da görür ve seçer (bkz. api/src/schoolResources.js,
-- src/panels/parent/components/AddTaskDrawer.jsx). Görsel ResourceBooks.image_url ile aynı
-- kurala tabidir: https URL veya data:image/(jpeg|png|webp) base64.
CREATE TABLE dbo.SchoolClassResources (
    id UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SchoolClassResources_Id DEFAULT NEWID() PRIMARY KEY,
    school_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SchoolClassResources_SchoolId REFERENCES dbo.Schools(id),
    grade NVARCHAR(20) NOT NULL,
    subject_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SchoolClassResources_SubjectId REFERENCES dbo.Subjects(id),
    name NVARCHAR(200) NOT NULL,
    image_url NVARCHAR(MAX) NULL,
    is_active BIT NOT NULL CONSTRAINT DF_SchoolClassResources_IsActive DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_SchoolClassResources_CreatedAt DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_SchoolClassResources_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_SchoolClassResources_School_Grade_Subject
    ON dbo.SchoolClassResources (school_id, grade, subject_id);
GO

CREATE OR ALTER TRIGGER dbo.TR_SchoolClassResources_SetUpdatedAt
ON dbo.SchoolClassResources
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE t
    SET updated_at = SYSUTCDATETIME()
    FROM dbo.SchoolClassResources t
    INNER JOIN inserted i ON i.id = t.id;
END;
GO
