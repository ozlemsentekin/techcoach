-- Bir öğrenci bir öğretmenin panel kotasından eklendiyse funded_by_teacher_id set edilir.
-- Bu durumda veli sadece o öğretmenin tanımladığı ödev/plan/sonuçları görebilir (kısıtlı panel).
ALTER TABLE dbo.Users ADD funded_by_teacher_id UNIQUEIDENTIFIER NULL
    CONSTRAINT FK_Users_FundedByTeacherId REFERENCES dbo.Users(id);
GO

ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_FundedByTeacherRequiresStudent
    CHECK (funded_by_teacher_id IS NULL OR role = 'ogrenci');
GO

CREATE INDEX IX_Users_FundedByTeacherId
    ON dbo.Users (funded_by_teacher_id)
    WHERE funded_by_teacher_id IS NOT NULL;
GO

-- Öğretmen tarafından oluşturulan veli hesapları "onay bekliyor" durumunda açılır;
-- ilk girişte KVKK/aydınlatma onayı verilene kadar bu alanlar NULL kalır.
ALTER TABLE dbo.Users ALTER COLUMN aydinlatma_accepted_at DATETIME2 NULL;
GO

ALTER TABLE dbo.Users ALTER COLUMN kvkk_accepted_at DATETIME2 NULL;
GO
